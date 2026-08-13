const Module = require('./dist/camaro')
const { parseCamaroJson } = require('./json-parse')

let cachedInstance
const templateIds = new Map()
const profileTextEncoder = new TextEncoder()
let profileUtf8Scratch = null

function callWasmBinding(methodName, ...args) {
    if (!cachedInstance) throw new Error('camaro is not initialized yet.')
    return cachedInstance[methodName](...args)
}

function templateId(template) {
    let id = templateIds.get(template)
    if (id === undefined) {
        id = callWasmBinding('registerTemplate', template)
        templateIds.set(template, id)
    }
    return id
}

function profileUtf8Bytes(xml) {
    if (typeof xml !== 'string') return asUint8View(xml)
    const worstCase = xml.length * 3
    if (!profileUtf8Scratch || profileUtf8Scratch.length < worstCase) {
        profileUtf8Scratch = new Uint8Array(Math.max(worstCase, 65536))
    }
    const { written } = profileTextEncoder.encodeInto(xml, profileUtf8Scratch)
    return profileUtf8Scratch.subarray(0, written)
}

function asUint8View(input) {
    if (input instanceof Uint8Array) return input
    if (typeof Buffer !== 'undefined' && Buffer.isBuffer(input)) {
        return new Uint8Array(input.buffer, input.byteOffset, input.byteLength)
    }
    if (input instanceof ArrayBuffer) return new Uint8Array(input)
    return null
}

function withMallocUtf8(u8View, wasmCall) {
    const M = cachedInstance
    const n = u8View.byteLength
    if (n === 0) return wasmCall(0, 0)
    const need = n + 1
    if (!withMallocUtf8.scratch || withMallocUtf8.cap < need) {
        if (withMallocUtf8.scratch) M._free(withMallocUtf8.scratch)
        withMallocUtf8.cap = Math.max(need, withMallocUtf8.cap * 2 || 65536)
        withMallocUtf8.scratch = M._malloc(withMallocUtf8.cap)
        if (!withMallocUtf8.scratch) throw new Error('camaro WASM heap allocation failed')
    }
    M.HEAPU8.set(u8View.subarray(0, n), withMallocUtf8.scratch)
    M.HEAPU8[withMallocUtf8.scratch + n] = 0
    return wasmCall(withMallocUtf8.scratch, n)
}
withMallocUtf8.scratch = 0
withMallocUtf8.cap = 0

// Non-MODULARIZE emscripten exports the Module object; wasm init is async.
const ready = new Promise((resolve) => {
    const finish = () => {
        cachedInstance = Module
        resolve()
    }
    if (Module.calledRun) {
        finish()
    } else {
        const prev = Module.onRuntimeInitialized
        Module.onRuntimeInitialized = function () {
            if (typeof prev === 'function') prev()
            finish()
        }
    }
})

function runTask({ fn, args }) {
    if (fn === 'transform') {
        const [xml, tmplStr] = args
        const u8 = asUint8View(xml)
        if (u8 !== null)
            return withMallocUtf8(u8, (ptr, len) =>
                callWasmBinding(
                    'transformFromUtf8WithTemplateId',
                    ptr,
                    len,
                    templateId(tmplStr),
                ))
        return callWasmBinding(fn, xml, tmplStr)
    }
    if (fn === 'toJson') {
        const [xml] = args
        const u8 = asUint8View(xml)
        if (u8 !== null)
            return withMallocUtf8(u8, (ptr, len) =>
                callWasmBinding('toJsonFromUtf8', ptr, len))
        return callWasmBinding(fn, xml)
    }
    if (fn === 'prettyPrint') {
        const [xml, opts] = args
        const u8 = asUint8View(xml)
        if (u8 !== null)
            return withMallocUtf8(u8, (ptr, len) =>
                callWasmBinding('prettyPrintFromUtf8', ptr, len, opts))
        return callWasmBinding(fn, xml, opts)
    }
    return callWasmBinding(fn, ...args)
}

module.exports = async (task) => {
    await ready
    return runTask(task)
}
module.exports.whenReady = () => ready
module.exports.runSync = (task) => {
    if (!cachedInstance) throw new Error('camaro is not initialized yet.')
    return runTask(task)
}
module.exports.profileTransform = async (xml, template) => {
    await ready
    const encodeStarted = performance.now()
    const bytes = profileUtf8Bytes(xml)
    const encodeFinished = performance.now()
    if (bytes === null) throw new TypeError('XML must be a string or UTF-8 byte view')

    let copyMs = 0
    const nativeProfile = withMallocUtf8(bytes, (ptr, len) => {
        const copyFinished = performance.now()
        copyMs = copyFinished - encodeFinished
        return callWasmBinding(
            'profileTransformFromUtf8WithTemplateId',
            ptr,
            len,
            templateId(template),
        )
    })
    const decodeStarted = performance.now()
    const result = parseCamaroJson(nativeProfile.result)
    const decodeFinished = performance.now()

    return {
        result,
        timings: {
            encodeMs: encodeFinished - encodeStarted,
            copyMs,
            parseMs: nativeProfile.parseMs,
            extractMs: nativeProfile.extractMs,
            decodeMs: decodeFinished - decodeStarted,
        },
    }
}
module.exports.profileParse = async (xml) => {
    await ready
    const bytes = profileUtf8Bytes(xml)
    return withMallocUtf8(bytes, (ptr, len) =>
        callWasmBinding('profileParseFromUtf8', ptr, len))
}
