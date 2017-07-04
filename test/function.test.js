const t = require('tape')
const transform = require('../')

const xml = `
    <root>
        <single>20.1</single>
        <number>10.2</number>
        <number>20.3</number>
        <boolean>TrUe</boolean>
        <string>HELLO WORLD</string>
        <string2>Room Superior</string2>
    </root>
`

t.test('test function upper-case()', (t) => {
    const result = transform(xml, {
        upperCase: 'upper-case(root/string)',
        upperCase2: 'upper-case(root/string2)'
    })
    t.equal(result.upperCase, 'HELLO WORLD')
    t.equal(result.upperCase2, 'ROOM SUPERIOR')
    t.end()
})

t.test('test function lower-case()', (t) => {
    const result = transform(xml, {
        lowerCase: 'lower-case(root/string)',
        lowerCase2: 'lower-case(root/string2)'
    })
    t.equal(result.lowerCase, 'hello world')
    t.equal(result.lowerCase2, 'room superior')
    t.end()
})

t.test('test function title-case()', (t) => {
    const result = transform(xml, {
        titleCase: 'title-case(root/string)',
        titleCase2: 'title-case(root/string2)'
    })
    t.equal(result.titleCase, 'Hello World')
    t.equal(result.titleCase2, 'Room Superior')
    t.end()
})


t.test('test function round()', (t) => {
    const result = transform(xml, { round: 'round(root/single)' })
    t.equal(result.round, 20)
    t.end()
})

t.test('test function floor()', (t) => {
    const result = transform(xml, { floor: 'floor(root/single)' })
    t.equal(result.floor, 20)
    t.end()
})

t.test('test function ceiling()', (t) => {
    const result = transform(xml, { ceiling: 'ceiling(root/single)' })
    t.equal(result.ceiling, 21)
    t.end()
})

t.test('test function sum()', (t) => {
    const result = transform(xml, { sum: 'sum(root/number)' })
    t.equal(result.sum, 30.5)
    t.end()
})

t.test('test function count()', (t) => {
    const result = transform(xml, { count: 'count(root/number)' })
    t.equal(result.count, 2)
    t.end()
})

t.test('test function boolean()', (t) => {
    const result = transform(xml, {
        boolean: 'boolean(root/boolean = "TrUe")',
        boolean_false: 'boolean(root/boolean = "true")'
    })
    t.equal(result.boolean, true, 'boolean should be true')
    t.equal(result.boolean_false, false, 'boolean_false should be false')
    t.end()
})
