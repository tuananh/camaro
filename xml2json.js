const fs = require('fs')
const xml2json = require('xml2json')

const xml = fs.readFileSync('examples/ean.xml', 'utf-8')

const output = xml2json.toJson(xml)
console.log(output);
