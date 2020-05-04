const fs = require('fs')
const t = require('tape')
const { ready, transform } = require('../')

t.test('invalid xpath test', async t => {
    const xml = fs.readFileSync('examples/ean.xml', 'utf-8')
    const template = {
        invalidXPath: 'concat()'
    }
    await ready()
    const result = await transform(xml, template)
    t.equal(result.invalidXPath, '')
    t.end()
})
