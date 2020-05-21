const t = require('tape')
const { transform } = require('../')

t.test('empty path test', async t => {
    const xml = '<hello>world</hello>'
    const template = {
        empty: ''
    }
    
    const result = await transform(xml, template)
    t.equal(result.empty,'','empty path => empty string')
    t.end()
})
