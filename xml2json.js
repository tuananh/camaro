const fs = require('fs')
const xml2json = require('xml2json')
const xml2js = require('xml2js').parseString

const xml = `
    <root text="im root">
        <items>
            <item>1</item>
            <item>2</item>
        </items>
    </root>`

xml2js(xml, (err, result) => {
    console.log(JSON.stringify(result, null, 2));

})