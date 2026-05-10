const tXml = require('txml')

module.exports = (xml) => {
    return tXml.parse(xml)
}
