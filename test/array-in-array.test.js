const t = require('tape')
const { transform } = require('../')

const xml = `
    <element>
        <item>outer0.arr0.0</item>
        <item>outer0.arr0.1</item>
        <item>outer0.arr0.2</item>
    </element>
    <element>
        <item>outer0.arr1.0</item>
        <item>outer0.arr1.1</item>
        <item>outer0.arr1.2</item>
    </element>
    <element>
        <item>outer1.arr0.0</item>
        <item>outer1.arr0.1</item>
        <item>outer1.arr0.2</item>
    </element>
    <element>
        <item>outer1.arr1.0</item>
        <item>outer1.arr1.1</item>
        <item>outer1.arr1.2</item>
    </element>
`

t.test('array-in-array test .// should only match nodes inside current node', async (t) => {
    const template = {
        elements: ['//element', {
            items: ['.//item', '.']
        }]
    }
    
    const result = await transform(xml, template)

    t.equal(result.elements[0].items.length, 3, 'elements[0].items should have only 3 elements')
    t.equal(result.elements[0].items[0], 'outer0.arr0.0', 'outer0.arr0.0')
    t.equal(result.elements[0].items[1], 'outer0.arr0.1', 'outer0.arr0.1')
    t.equal(result.elements[0].items[2], 'outer0.arr0.2', 'outer0.arr0.2')

    t.end()
})