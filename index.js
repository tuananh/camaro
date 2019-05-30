const Module = require('./dist/camaro')

function isNonEmptyString(str) {
    return typeof str === 'string' && str.length > 0
}

function isEmptyObject(obj) {
    if (Object.keys(obj).length === 0 && obj.constructor === Object) {
        return true
    }

    for (const prop in obj) {
        if (obj.hasOwnProperty(prop)) {
            return false
        }
    }

    return JSON.stringify(obj) === JSON.stringify({})
}

let cachedInstance
const instance = Module()
instance.onRuntimeInitialized = () => {
    cachedInstance = instance
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
    return new Promise((resolve) => {
        if (!cachedInstance) {
            instance.onRuntimeInitialized = () => {
                cachedInstance = instance
                const result = instance.transform(xml, templateString)
                resolve(result)
            }
        } else {
            const result = cachedInstance.transform(xml, templateString)
            resolve(result)
        }
    })
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

    return new Promise((resolve) => {
        if (!cachedInstance) {
            instance.onRuntimeInitialized = () => {
                cachedInstance = instance
                resolve(instance.toJson(xml))
            }
        } else {
            resolve(cachedInstance.toJson(xml))
        }
    })
}

/**
 * pretty print xml string
 * @param {string} xml xml string
 * @param {object} opts pretty print options
 * @param {number} opts.indentSize indent size, default=2
 * @returns {string} xml pretty print string
 */
async function prettyPrint(xml, opts={indentSize: 2}) {
    if (!isNonEmptyString(xml)) {
        throw new TypeError('expecting xml input to be non-empty string')
    }

    return new Promise((resolve) => {
        if (!cachedInstance) {
            instance.onRuntimeInitialized = () => {
                cachedInstance = instance
                resolve(instance.prettyPrint(xml, opts))
            }
        } else {
            resolve(cachedInstance.prettyPrint(xml, opts))
        }
    })
}

module.exports = { transform, toJson, prettyPrint }