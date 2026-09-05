'use strict';

const { resolve } = require('path');
const { parseCamaroJson } = require('./json-parse');

const force_main_thread = process.env.CAMARO_FORCE_SINGLE_THREAD === 'true';
const pool_size = Number(process.env.CAMARO_POOL_SIZE || 0);
const { sabEnabled, fitsSabXmlPayload } = require('./sab-ipc');
const use_sab_ipc = sabEnabled() && !force_main_thread;

let pool = null;

if (force_main_thread) {
	const worker_fn = require('./worker');
	pool = {
		run(task, opts) {
			void opts;
			return worker_fn(task).then(parseCamaroJson);
		},
		destroy() {},
	};
} else {
	const { LeanPool } = require('./lean-pool');
	const worker_fn = require('./worker');
	const lean_pool = new LeanPool(resolve(__dirname, 'pool-worker.js'), {
		maxThreads: pool_size > 0 ? pool_size : undefined,
		onRecycleXml: recycleXmlUtf8Buffer,
		useSab: use_sab_ipc,
	});
	let direct_task_active = false;

	function directTask(task) {
		if (!task.sab) return task;
		return {
			...task,
			sab: false,
			recycleXml: false,
			args: [typeof task.xmlString === 'string' ? utf8BytesFromJsString(task.xmlString) : task.args[0], ...task.args.slice(1)],
		};
	}

	pool = {
		run(task, opts) {
			// A single request does not benefit from crossing a worker boundary.
			// Keep the first in-flight request local, but retain the pool for
			// concurrent work so multi-core throughput remains available.
			if (!direct_task_active) {
				const local_task = directTask(task);
				direct_task_active = true;
				return worker_fn(local_task)
					.then(parseCamaroJson)
					.finally(() => {
						direct_task_active = false;
					});
			}
			return lean_pool.run(task, opts);
		},
		destroy() {
			return lean_pool.destroy();
		},
	};
}

/** Wasm Embind Utf-16 string → std::string is slower than Utf-8 bytes + malloc; reuse the Utf-8 path. */
const text_encoder_utf8 = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;
/** Recycled after worker transfers XML buffers back post-transform. */
let xml_utf8_scratch = null;

function recycleXmlUtf8Buffer(buf) {
	if (
		buf instanceof Uint8Array &&
		buf.buffer &&
		buf.buffer.byteLength > 0 &&
		(!xml_utf8_scratch || buf.byteLength >= xml_utf8_scratch.byteLength)
	) {
		xml_utf8_scratch = buf;
	}
}

function utf8BytesFromJsString(xml) {
	if (!text_encoder_utf8) {
		return Buffer.from(xml, 'utf8');
	}
	const worst_case = xml.length * 3;
	if (!xml_utf8_scratch || xml_utf8_scratch.length < worst_case || xml_utf8_scratch.buffer.byteLength === 0) {
		xml_utf8_scratch = new Uint8Array(Math.max(worst_case, 65536));
	}
	const { written } = text_encoder_utf8.encodeInto(xml, xml_utf8_scratch);
	return xml_utf8_scratch.subarray(0, written);
}

/**
 * Owned Utf-8 from `TextEncoder`/Buffer-from-string can be transferred; user-supplied Binaries skip (avoid detach).
 * @returns {{ xmlWire: Uint8Array|Buffer|ArrayBuffer, poolOpts?: { transferList: ArrayBuffer[] } }}
 */
function xmlPayloadForWorkerThread(xml) {
	if (typeof xml === 'string') {
		if (use_sab_ipc && fitsSabXmlPayload(xml)) {
			return { sab: true };
		}
		const xml_wire = utf8BytesFromJsString(xml);
		if (!force_main_thread && xml_wire.buffer && xml_wire.buffer.byteLength > 0) {
			return {
				xmlWire: xml_wire,
				poolOpts: { transferList: [xml_wire.buffer] },
			};
		}
		return { xmlWire: xml_wire };
	}
	if (use_sab_ipc && fitsSabXmlPayload(xml)) {
		return { xmlWire: xml, sab: true };
	}
	// User-supplied binaries: structured clone only (transfer would detach caller's buffer).
	return { xmlWire: xml };
}

function buildPoolTask(fn, xml, payload, extra_args = []) {
	const task = {
		fn,
		args: [payload.sab ? null : payload.xmlWire, ...extra_args],
		sab: payload.sab,
		recycleXml: Boolean(payload.poolOpts?.transferList?.length),
	};
	if (payload.sab && typeof xml === 'string') {
		task.xmlString = xml;
	} else if (payload.sab && payload.xmlWire != null) {
		task.args[0] = payload.xmlWire;
	}
	return task;
}

function dispatchPool(task_body, pool_opts) {
	return pool.run(task_body, pool_opts ?? {});
}

function isNonEmptyString(str) {
	return typeof str === 'string' && str.length > 0;
}

function utf8PayloadByteLength(xml) {
	if (typeof Buffer !== 'undefined' && Buffer.isBuffer(xml)) return xml.length;
	if (xml instanceof ArrayBuffer) return xml.byteLength;
	if (ArrayBuffer.isView(xml)) return xml.byteLength;
	return 0;
}

function isNonEmptyUtf8Payload(xml) {
	return utf8PayloadByteLength(xml) > 0;
}

/** Reject invalid xml types before crossing to the WASM worker */
function validateXml(xml) {
	if (typeof xml === 'string') {
		if (!isNonEmptyString(xml)) {
			throw new TypeError('1st argument (xml) must be a non-empty string, Buffer, Uint8Array, or ArrayBuffer');
		}
		return;
	}
	if (!isNonEmptyUtf8Payload(xml)) {
		throw new TypeError('1st argument (xml) must be a non-empty string, Buffer, Uint8Array, or ArrayBuffer');
	}
}

function isEmptyObject(obj) {
	return Object.entries(obj).length === 0 && obj.constructor === Object;
}

const template_string_cache = new WeakMap();

function templateString(template) {
	let cached = template_string_cache.get(template);
	if (cached === undefined) {
		cached = JSON.stringify(template);
		template_string_cache.set(template, cached);
	}
	return cached;
}

/**
 * convert xml to json base on the template object
 * @param {string|Buffer|Uint8Array|ArrayBuffer} xml xml as UTF-8 string or raw bytes
 * @param {object} template template object
 * @returns {object} xml converted to json object based on the template
 */
function transform(xml, template) {
	validateXml(xml);

	if (!template || typeof template !== 'object' || isEmptyObject(template)) {
		throw new TypeError('2nd argument (template) must be an object');
	}

	const payload = xmlPayloadForWorkerThread(xml);
	return dispatchPool(buildPoolTask('transform', xml, payload, [templateString(template)]), payload.poolOpts);
}

/**
 * convert xml to json
 * @param {string|Buffer|Uint8Array|ArrayBuffer} xml UTF-8 string or raw UTF-8 bytes of the XML
 * @returns {object} json object converted from the input xml
 */
function toJson(xml) {
	validateXml(xml);

	const payload = xmlPayloadForWorkerThread(xml);
	return dispatchPool(buildPoolTask('toJson', xml, payload), payload.poolOpts);
}

/**
 * pretty print xml string
 * @param {string|Buffer|Uint8Array|ArrayBuffer} xml UTF-8 string or raw UTF-8 bytes
 * @param {object} opts pretty print options
 * @param {number} [opts.indentSize=2] indent size, default=2
 * @returns {string} xml pretty print string
 */
function prettyPrint(xml, opts = { indentSize: 2 }) {
	validateXml(xml);

	const payload = xmlPayloadForWorkerThread(xml);
	return dispatchPool(buildPoolTask('prettyPrint', xml, payload, [opts]), payload.poolOpts);
}

/**
 * destroy the worker pool
 */
function destroy() {
	if (pool && typeof pool.destroy === 'function') {
		return pool.destroy();
	}
}

module.exports = { transform, toJson, prettyPrint, destroy };
