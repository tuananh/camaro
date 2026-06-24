const { resolve } = require('path')
const NODE_MAJOR_VERSION = process.versions.node.split('.')[0]
let pool = null

if (NODE_MAJOR_VERSION < 12 || process.env.CAMARO_FORCE_SINGLE_THREAD === 'true') {
    console.warn('[camaro] worker_threads is not available, expect performance drop. Try using Node version >= 12.')
    const workerFn = require('./worker')
    pool = {
        run(task, opts) {
            void opts
            return workerFn(task).then(parseCamaroJson)
        },
        destroy() {},
    }
} else {
    const { LeanPool } = require('./lean-pool')
    const { parseCamaroJson } = require('./json-parse')
    const leanPool = new LeanPool(resolve(__dirname, 'pool-worker.js'))
    pool = {
        run(task, opts) {
            return leanPool.run(task, opts).then(parseCamaroJson)
        },
        destroy() {
            return leanPool.destroy()
        },
    }
}

/** Wasm Embind Utf-16 string → std::string is slower than Utf-8 bytes + malloc; reuse the Utf-8 path. */
const textEncoderUtf8 =
    typeof TextEncoder !== 'undefined' ? new TextEncoder() : null
let xmlUtf8Scratch = null

function utf8BytesFromJsString(xml) {
    if (!textEncoderUtf8) {
        return Buffer.from(xml, 'utf8')
    }
    const worstCase = xml.length * 3
    if (!xmlUtf8Scratch || xmlUtf8Scratch.length < worstCase) {
        xmlUtf8Scratch = new Uint8Array(Math.max(worstCase, 65536))
    }
    const { written } = textEncoderUtf8.encodeInto(xml, xmlUtf8Scratch)
    return xmlUtf8Scratch.subarray(0, written)
}

/**
 * Owned Utf-8 from `TextEncoder`/Buffer-from-string can be transferred; user-supplied Binaries skip (avoid detach).
 * @returns {{ xmlWire: Uint8Array|Buffer|ArrayBuffer, poolOpts?: { transferList: ArrayBuffer[] } }}
 */
function xmlPayloadForWorkerThread(xml) {
    if (typeof xml === 'string') {
        // Reuse scratch + structured clone; transfer detaches and forces re-allocation.
        return { xmlWire: utf8BytesFromJsString(xml) }
    }
    // User-supplied binaries: structured clone only (transfer would detach caller's buffer).
    return { xmlWire: xml }
}

function dispatchPool(taskBody, poolOpts) {
    return pool.run(taskBody, poolOpts ?? {})
}

function isNonEmptyString(str) {
    return typeof str === 'string' && str.length > 0
}

function utf8PayloadByteLength(xml) {
    if (typeof Buffer !== 'undefined' && Buffer.isBuffer(xml)) return xml.length
    if (xml instanceof ArrayBuffer) return xml.byteLength
    if (ArrayBuffer.isView(xml)) return xml.byteLength
    return 0
}

function isNonEmptyUtf8Payload(xml) {
    return utf8PayloadByteLength(xml) > 0
}

/** Reject invalid xml types before crossing to the WASM worker */
function validateXml(xml) {
    if (typeof xml === 'string') {
        if (!isNonEmptyString(xml)) {
            throw new TypeError(
                '1st argument (xml) must be a non-empty string, Buffer, Uint8Array, or ArrayBuffer'
            )
        }
        return
    }
    if (!isNonEmptyUtf8Payload(xml)) {
        throw new TypeError(
            '1st argument (xml) must be a non-empty string, Buffer, Uint8Array, or ArrayBuffer'
        )
    }
}

function isEmptyObject(obj) {
    return Object.entries(obj).length === 0 && obj.constructor === Object
}

const templateStringCache = new WeakMap()

function templateString(template) {
    let cached = templateStringCache.get(template)
    if (cached === undefined) {
        cached = JSON.stringify(template)
        templateStringCache.set(template, cached)
    }
    return cached
}

/**
 * convert xml to json base on the template object
 * @param {string|Buffer|Uint8Array|ArrayBuffer} xml xml as UTF-8 string or raw bytes
 * @param {object} template template object
 * @returns {object} xml converted to json object based on the template
 */
function transform(xml, template) {
    validateXml(xml)

    if (!template || typeof template !== 'object' || isEmptyObject(template)) {
        throw new TypeError('2nd argument (template) must be an object')
    }

    const payload = xmlPayloadForWorkerThread(xml)
    return dispatchPool(
        {
            fn: 'transform',
            args: [payload.xmlWire, templateString(template)],
        },
        payload.poolOpts,
    )
}

/**
 * convert xml to json
 * @param {string|Buffer|Uint8Array|ArrayBuffer} xml UTF-8 string or raw UTF-8 bytes of the XML
 * @returns {object} json object converted from the input xml
 */
function toJson(xml) {
    validateXml(xml)

    const payload = xmlPayloadForWorkerThread(xml)
    return dispatchPool({ fn: 'toJson', args: [payload.xmlWire] }, payload.poolOpts)
}

/**
 * pretty print xml string
 * @param {string|Buffer|Uint8Array|ArrayBuffer} xml UTF-8 string or raw UTF-8 bytes
 * @param {object} opts pretty print options
 * @param {number} [opts.indentSize=2] indent size, default=2
 * @returns {string} xml pretty print string
 */
function prettyPrint(xml, opts = { indentSize: 2 }) {
    validateXml(xml)

    const payload = xmlPayloadForWorkerThread(xml)
    return dispatchPool(
        { fn: 'prettyPrint', args: [payload.xmlWire, opts] },
        payload.poolOpts,
    )
}

/**
 * destroy the worker pool
 */
function destroy() {
    if (pool && typeof pool.destroy === 'function') {
        return pool.destroy();
    }
}

module.exports = { transform, toJson, prettyPrint, destroy }
