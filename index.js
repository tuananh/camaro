const Module = require('./dist/camaro')

function isNonEmptyString(str) {
    return typeof str === 'string' && str.length > 0
}

function isEmptyObject(obj) {
    return Object.entries(obj).length === 0 && obj.constructor === Object
}

let cachedInstance

function callWasmBinding(methodName, ...args) {
    if (!cachedInstance) throw new Error('camaro is not yet initialized. You need to call `ready()` first.')
    return cachedInstance[methodName](...args)
}

const ready = () => {
    return new Promise((resolve, reject) => {
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
}

/**
 * convert xml to json base on the template object
 * @param {string} xml xml string
 * @param {object} template template object
 * @returns {object} xml converted to json object based on the template
 */
async function transform(xml, template) {
    if (!isNonEmptyString(xml)) {
        throw new TypeError('1st argument (xml) must be a non-empty string')
    }

    if (!template || typeof template !== 'object' || isEmptyObject(template)) {
        throw new TypeError('2nd argument (template) must be an object')
    }

    const templateString = JSON.stringify(template)
    return callWasmBinding('transform', xml, templateString)
}

/**
 * convert xml to json
 * @param {string} xml xml string
 * @returns {object} json object converted from the input xml
 */
async function toJson(xml) {
    if (!isNonEmptyString(xml)) {
        throw new TypeError('expecting xml input to be non-empty string')
    }

    return callWasmBinding('toJson', xml)
}

/**
 * pretty print xml string
 * @param {string} xml xml string
 * @param {object} opts pretty print options
 * @param {number} [opts.indentSize=2] indent size, default=2
 * @returns {string} xml pretty print string
 */
async function prettyPrint(xml, opts={indentSize: 2}) {
    if (!isNonEmptyString(xml)) {
        throw new TypeError('expecting xml input to be non-empty string')
    }

    return callWasmBinding('prettyPrint', xml, opts)
}

module.exports = { ready, transform, toJson, prettyPrint }