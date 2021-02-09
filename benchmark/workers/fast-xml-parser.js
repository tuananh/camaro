const fastXmlParser = require('fast-xml-parser');

module.exports = (xml) => {
    return fastXmlParser.parse(xml);
}