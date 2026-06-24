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

module.exports = async (task) => {
    await ready
    return runTask(task)
}
module.exports.whenReady = () => ready
module.exports.runSync = (task) => {
    if (!cachedInstance) throw new Error('camaro is not initialized yet.')
    return runTask(task)
}
