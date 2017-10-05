const t = require('tape')
const transform = require('../')

const xml =
`
    <root>
        <arrayOuter>
            <arrayInner>
                <item>outer0.arr0.0</item>
                <item>outer0.arr0.1</item>
                <item>outer0.arr0.2</item>
            </arrayInner>
            <arrayInner>
                <item>outer0.arr1.0</item>
                <item>outer0.arr1.1</item>
                <item>outer0.arr1.2</item>
            </arrayInner>
        </arrayOuter>
        <arrayOuter>
            <arrayInner>
                <item>outer1.arr0.0</item>
                <item>outer1.arr0.1</item>
                <item>outer1.arr0.2</item>
            </arrayInner>
            <arrayInner>
                <item>outer1.arr1.0</item>
                <item>outer1.arr1.1</item>
                <item>outer1.arr1.2</item>
            </arrayInner>
        </arrayOuter>
    </root>
`

t.test('array-in-array test', (t) => {
    const template = {
        arrayOuter: ['//arrayOuter', {
            arrayInner: ['//arrayInner', {
                item: 'item'
            }]
        }]
    }

    const result = transform(xml, template)
    // console.log(JSON.stringify(result, null, 4))
    t.equal(result.arrayOuter[0].arrayInner.length, 2, 'inner should have only 2 elements')
    t.equal(result.arrayOuter[0].arrayInner[0].item, 'outer0.arr0.0', 'outer0.arr0.0')
    t.equal(result.arrayOuter[0].arrayInner[1].item, 'outer0.arr0.1', 'outer0.arr0.1')

    t.end()
})