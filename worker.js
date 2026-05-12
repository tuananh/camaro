const Module = require('./dist/camaro')

let cachedInstance

function callWasmBinding(methodName, ...args) {
    if (!cachedInstance) throw new Error('camaro is not initialized yet.')
    return cachedInstance[methodName](...args)
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
    const ptr = M._malloc(n)
    if (!ptr && n !== 0) throw new Error('camaro WASM heap allocation failed')
    try {
        M.HEAPU8.set(u8View.subarray(0, n), ptr)
        return wasmCall(ptr, n)
    } finally {
        if (ptr) M._free(ptr)
    }
}

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

module.exports = async ({fn, args}) => {
    await ready
    if (fn === 'transform') {
        const [xml, tmplStr] = args
        const u8 = asUint8View(xml)
        if (u8 !== null)
            return withMallocUtf8(u8, (ptr, len) =>
                callWasmBinding('transformFromUtf8', ptr, len, tmplStr))
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
