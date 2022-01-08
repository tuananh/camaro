const { XMLParser } = require('fast-xml-parser');
const parser = new XMLParser();

module.exports = (xml) => {
    return parser.parse(xml);
}