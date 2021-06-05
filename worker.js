const Module = require('./dist/camaro')

let cachedInstance

function callWasmBinding(methodName, ...args) {
    if (!cachedInstance) throw new Error('camaro is not initialized yet.')
    return cachedInstance[methodName](...args)
}

const ready = new Promise((resolve, reject) => {
    if (!cachedInstance) {
        Module().then((instance) => {
            cachedInstance = instance
            resolve()
        })
    } else {        
        resolve()
    }
})

module.exports = async ({fn, args}) => {    
    await ready
    return callWasmBinding(fn, ...args)
}