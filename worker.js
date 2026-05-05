const Module = require('./dist/camaro')

let cachedInstance

function callWasmBinding(methodName, ...args) {
    if (!cachedInstance) throw new Error('camaro is not initialized yet.')
    return cachedInstance[methodName](...args)
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
    return callWasmBinding(fn, ...args)
}