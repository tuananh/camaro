const { resolve } = require('path')
const NODE_MAJOR_VERSION = process.versions.node.split('.')[0]
let pool = null

if (NODE_MAJOR_VERSION < 12 || process.env.CAMARO_FORCE_SINGLE_THREAD === 'true') {
    console.warn('[camaro] worker_threads is not available, expect performance drop. Try using Node version >= 12.')
    const workerFn = require('./worker')
    pool = {
        run: async (args) => workerFn(args)
    }
} else {
    const WorkerPool = require('piscina')
    pool = new WorkerPool({ filename: resolve(__dirname, 'worker.js') })
}

/** Wasm Embind Utf-16 string → std::string is slower than Utf-8 bytes + malloc; reuse the Utf-8 path. */
const textEncoderUtf8 =
    typeof TextEncoder !== 'undefined' ? new TextEncoder() : null

function utf8BytesFromJsString(xml) {
    return textEncoderUtf8
        ? textEncoderUtf8.encode(xml)
        : Buffer.from(xml, 'utf8')
}

function xmlInputForWorker(xml) {
    return typeof xml === 'string' ? utf8BytesFromJsString(xml) : xml
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

    return pool.run({
        fn: 'transform',
        args: [xmlInputForWorker(xml), JSON.stringify(template)],
    })
}

/**
 * convert xml to json
 * @param {string|Buffer|Uint8Array|ArrayBuffer} xml UTF-8 string or raw UTF-8 bytes of the XML
 * @returns {object} json object converted from the input xml
 */
function toJson(xml) {
    validateXml(xml)

    return pool.run({ fn: 'toJson', args: [xmlInputForWorker(xml)] })
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

    return pool.run({ fn: 'prettyPrint', args: [xmlInputForWorker(xml), opts] })
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
