const test = require('tape')
const transform = require('../')

const xml = `
    <root>
        <single>20.1</single>
        <number>10.2</number>
        <number>20.3</number>
        <boolean>TrUe</boolean>
    </root>
`
test('test function round()', (t) => {
    const result = transform(xml, { round: 'round(root/single)' })
    t.equal(result.round, 20)
    t.end()
})

test('test function floor()', (t) => {
    const result = transform(xml, { floor: 'floor(root/single)' })
    t.equal(result.floor, 20)
    t.end()
})

test('test function ceiling()', (t) => {
    const result = transform(xml, { ceiling: 'ceiling(root/single)' })
    t.equal(result.ceiling, 21)
    t.end()
})

test('test function sum()', (t) => {
    const result = transform(xml, { sum: 'sum(root/number)' })
    t.equal(result.sum, 30.5)
    t.end()
})

test('test function count()', (t) => {
    const result = transform(xml, { count: 'count(root/number)' })
    t.equal(result.count, 2)
    t.end()
})

test('test function boolean()', (t) => {
    const result = transform(xml, {
        boolean: 'boolean(root/boolean = "TrUe")',
        boolean_false: 'boolean(root/boolean = "true")'
    })
    t.equal(result.boolean, true, 'boolean should be true')
    t.equal(result.boolean_false, false, 'boolean_flase should be false')
    t.end()
})
