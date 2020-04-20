const t = require('tape')
const { transform } = require('../')

t.test('camaro should be able to parse an array template too', async (t) => {
    const xml = `
        <root>
            <item>1</item>
            <item>2</item>
            <item>3</item>
        </root>
    `
    const result = await transform(xml, ['root/item', 'number(.)'])    
    t.deepEqual(result, [1, 2, 3])
    t.end()
})