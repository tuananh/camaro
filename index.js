const binary = require('node-pre-gyp')
const path = require('path')
const bindingPath = binary.find(path.resolve(path.join(__dirname,'./package.json')))
const camaro = require(bindingPath)

function isNonEmptyString(str) {
    return typeof str === 'string' && str.length > 0
}

function transform(xml, template) {
    if (!isNonEmptyString(xml)) {
        throw new TypeError('1st argument (xml) must be a non-empty string')
    }

    if (!template || typeof template !== 'object') {
        throw new TypeError('2nd argument (template) must be an object')
    }

    const template_string = JSON.stringify(template)
    let result = camaro.transform(xml, template_string)

    if (!result) {
        throw new TypeError('Invalid input: Malformed xml')
    }

    return result
}

module.exports = transform
