const fs = require('fs')
const t = require('tape')
const { transform } = require('..')

t.test('raw() test', async t => {
    const xml = fs.readFileSync('examples/simple.xml', 'utf-8')

    const template = {
        raw0InArray: ['root/items', 'raw()'],
        raw1: 'raw(root/items)',
        raw1NodeSet: 'raw(//item)'
    }
    const result = await transform(xml, template)

    const rawXml = '<items>\n\t<item>1</item>\n\t<item>2</item>\n</items>\n'
    t.deepEqual(result.raw0InArray, [rawXml])
    t.equal(result.raw1, rawXml)
    t.equal(result.raw1NodeSet, '<item>1</item>\n')

    t.end()
})