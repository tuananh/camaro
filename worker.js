'use strict';

const Module = require('./dist/camaro');
const { parseCamaroJson } = require('./json-parse');

let cached_instance;
const template_ids = new Map();
const profile_text_encoder = new TextEncoder();
let profile_utf8_scratch = null;

function callWasmBinding(method_name, ...args) {
	if (!cached_instance) throw new Error('camaro is not initialized yet.');
	return cached_instance[method_name](...args);
}

function templateId(template) {
	let id = template_ids.get(template);
	if (id === undefined) {
		id = callWasmBinding('registerTemplate', template);
		template_ids.set(template, id);
	}
	return id;
}

function profileUtf8Bytes(xml) {
	if (typeof xml !== 'string') return asUint8View(xml);
	const worst_case = xml.length * 3;
	if (!profile_utf8_scratch || profile_utf8_scratch.length < worst_case) {
		profile_utf8_scratch = new Uint8Array(Math.max(worst_case, 65536));
	}
	const { written } = profile_text_encoder.encodeInto(xml, profile_utf8_scratch);
	return profile_utf8_scratch.subarray(0, written);
}

function asUint8View(input) {
	if (input instanceof Uint8Array) return input;
	if (typeof Buffer !== 'undefined' && Buffer.isBuffer(input)) {
		return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
	}
	if (input instanceof ArrayBuffer) return new Uint8Array(input);
	return null;
}

function withMallocUtf8(u8_view, wasm_call) {
	const instance = cached_instance;
	const size = u8_view.byteLength;
	if (size === 0) return wasm_call(0, 0);
	const need = size + 1;
	if (!withMallocUtf8.scratch || withMallocUtf8.cap < need) {
		if (withMallocUtf8.scratch) instance._free(withMallocUtf8.scratch);
		withMallocUtf8.cap = Math.max(need, withMallocUtf8.cap * 2 || 65536);
		withMallocUtf8.scratch = instance._malloc(withMallocUtf8.cap);
		if (!withMallocUtf8.scratch) throw new Error('camaro WASM heap allocation failed');
	}
	instance.HEAPU8.set(u8_view.subarray(0, size), withMallocUtf8.scratch);
	instance.HEAPU8[withMallocUtf8.scratch + size] = 0;
	return wasm_call(withMallocUtf8.scratch, size);
}
withMallocUtf8.scratch = 0;
withMallocUtf8.cap = 0;

// Non-MODULARIZE emscripten exports the Module object; wasm init is async.
const ready = new Promise((resolve) => {
	const finish = () => {
		cached_instance = Module;
		resolve();
	};
	if (Module.calledRun) {
		finish();
	} else {
		const previous = Module.onRuntimeInitialized;
		Module.onRuntimeInitialized = function () {
			if (typeof previous === 'function') previous();
			finish();
		};
	}
});

function runTask({ fn, args }) {
	if (fn === 'transform') {
		const [xml, tmpl_str] = args;
		const bytes = asUint8View(xml);
		if (bytes !== null)
			return withMallocUtf8(bytes, (ptr, len) => callWasmBinding('transformFromUtf8WithTemplateId', ptr, len, templateId(tmpl_str)));
		return callWasmBinding(fn, xml, tmpl_str);
	}
	if (fn === 'toJson') {
		const [xml] = args;
		const bytes = asUint8View(xml);
		if (bytes !== null) return withMallocUtf8(bytes, (ptr, len) => callWasmBinding('toJsonFromUtf8', ptr, len));
		return callWasmBinding(fn, xml);
	}
	if (fn === 'prettyPrint') {
		const [xml, opts] = args;
		const bytes = asUint8View(xml);
		if (bytes !== null) return withMallocUtf8(bytes, (ptr, len) => callWasmBinding('prettyPrintFromUtf8', ptr, len, opts));
		return callWasmBinding(fn, xml, opts);
	}
	return callWasmBinding(fn, ...args);
}

module.exports = async (task) => {
	await ready;
	return runTask(task);
};
module.exports.whenReady = () => ready;
module.exports.runSync = (task) => {
	if (!cached_instance) throw new Error('camaro is not initialized yet.');
	return runTask(task);
};
module.exports.profileTransform = async (xml, template) => {
	await ready;
	const encode_started = performance.now();
	const bytes = profileUtf8Bytes(xml);
	const encode_finished = performance.now();
	if (bytes === null) throw new TypeError('XML must be a string or UTF-8 byte view');

	let copy_ms = 0;
	const native_profile = withMallocUtf8(bytes, (ptr, len) => {
		const copy_finished = performance.now();
		copy_ms = copy_finished - encode_finished;
		return callWasmBinding('profileTransformFromUtf8WithTemplateId', ptr, len, templateId(template));
	});
	const decode_started = performance.now();
	const result = parseCamaroJson(native_profile.result);
	const decode_finished = performance.now();

	return {
		result,
		timings: {
			encodeMs: encode_finished - encode_started,
			copyMs: copy_ms,
			parseMs: native_profile.parseMs,
			extractMs: native_profile.extractMs,
			decodeMs: decode_finished - decode_started,
		},
	};
};
module.exports.profileParse = async (xml) => {
	await ready;
	const bytes = profileUtf8Bytes(xml);
	return withMallocUtf8(bytes, (ptr, len) => callWasmBinding('profileParseFromUtf8', ptr, len));
};
