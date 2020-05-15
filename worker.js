const Module = require('./dist/camaro')

let cachedInstance

function callWasmBinding(methodName, ...args) {
    if (!cachedInstance) throw new Error('camaro is not yet initialized. You need to call `ready()` first.')
    return cachedInstance[methodName](...args)
}

const ready = new Promise((resolve, reject) => {
    if (!cachedInstance) {
        const instance = Module()
        instance.onRuntimeInitialized = () => {
            cachedInstance = instance
            resolve()
        }
    } else {            
        resolve()
    }
})

module.exports = async ({fn, xml, template}) => {    
    await ready
    return callWasmBinding(fn, xml, template)
}