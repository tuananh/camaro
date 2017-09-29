const t = require('tape')
const transform = require('../')

const xml = `
    <root>
        <single>20.1</single>
        <number>10.2</number>
        <number>20.3</number>
        <boolean>TrUe</boolean>
        <items>
            <item>hEllo WorlD camaRo</item>
            <item>Hello World cAmaro</item>
            <item>hello wOrld caMaro</item>
            <item>hEllO wOrlD camaRo</item>
        </items>
        <unicode>
            <item>phòng 2 người</item>
        </unicode>
        <special>
            <item>twin/double@room</item>
        </special>
    </root>
`

t.test('test function upper-case()', (t) => {
    const result = transform(xml, {
        upperCase: ['//items/item', 'upper-case(.)']
    })
    result.upperCase.forEach(u => {
        t.equal(u, 'HELLO WORLD CAMARO')
    })
    t.end()
})

t.test('test function lower-case()', (t) => {
    const result = transform(xml, {
        lowerCase: ['//items/item', 'lower-case(.)']
    })
    result.lowerCase.forEach(u => {
        t.equal(u, 'hello world camaro')
    })
    t.end()
})

t.test('test function title-case()', (t) => {
    const result = transform(xml, {
        titleCase: ['//items/item', 'title-case(.)']
    })
    result.titleCase.forEach(u => {
        t.equal(u, 'Hello World Camaro')
    })
    t.end()
})

t.test('test function title-case() unicode', (t) => {
    const result = transform(xml, {
        titleCase: ['//unicode/item', 'title-case(.)']
    })
    result.titleCase.forEach(u => {
        t.equal(u, 'Phòng 2 Người')
    })
    t.end()
})

t.test('test function title-case() upper after symbols', (t) => {
    const result = transform(xml, {
        titleCase: ['//special/item', 'title-case(.)']
    })
    result.titleCase.forEach(u => {
        t.equal(u, 'Twin/Double@Room')
    })
    t.end()
})

t.test('test function camel-case()', (t) => {
    const result = transform(xml, {
        camelCase: ['//items/item', 'camel-case(.)']
    })
    result.camelCase.forEach(u => {
        t.equal(u, 'helloWorldCamaro')
    })
    t.end()
})

t.test('test function snake-case()', (t) => {
    const result = transform(xml, {
        snakeCase: ['//items/item', 'snake-case(.)']
    })
    result.snakeCase.forEach(u => {
        t.equal(u, 'hello_world_camaro')
    })
    t.end()
})

t.test('test nested function calls', (t) => {
    const result = transform(xml, {
        snakeCase: ['//items/item', 'snake-case(lower-case(.))']
    })
    result.snakeCase.forEach(u => {
        t.equal(u, 'hello_world_camaro')
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
