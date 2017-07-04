const t = require('tape')
const transform = require('../')

const xml = `
    <root>
        <single>20.1</single>
        <number>10.2</number>
        <number>20.3</number>
        <boolean>TrUe</boolean>
        <items>
            <item>hEllo WorlD</item>
            <item>Hello World</item>
            <item>hello wOrld</item>
        </items>
    </root>
`

t.test('test function upper-case()', (t) => {
    const result = transform(xml, {
        upperCase: ['//items/item', 'upper-case(.)']
    })
    result.upperCase.forEach(u => {
        t.equal(u, 'HELLO WORLD')
    })
    t.end()
})

t.test('test function lower-case()', (t) => {
    const result = transform(xml, {
        lowerCase: ['//items/item', 'lower-case(.)']
    })
    result.lowerCase.forEach(u => {
        t.equal(u, 'hello world')
    })
    t.end()
})

t.test('test function title-case()', (t) => {
    const result = transform(xml, {
        titleCase: ['//items/item', 'title-case(.)']
    })
    result.titleCase.forEach(u => {
        t.equal(u, 'Hello World')
    })
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
