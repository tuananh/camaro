const t = require('tape')
const { transform } = require('../')
const isWin = process.platform === 'win32'

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
            <item>twin/double@room (room only)</item>
        </special>
        <list>
            <item>item 1</item>
            <item>item 2</item>
        </list>
    </root>
`

t.test('test function upper-case()', async (t) => {
    
    const result = await transform(xml, {
        upperCase: ['//items/item', 'upper-case(.)']
    })
    result.upperCase.forEach(u => {
        t.equal(u, 'HELLO WORLD CAMARO')
    })
    t.end()
})

t.test('test function lower-case()', async (t) => {
    
    const result = await transform(xml, {
        lowerCase: ['//items/item', 'lower-case(.)']
    })
    result.lowerCase.forEach(u => {
        t.equal(u, 'hello world camaro')
    })
    t.end()
})

t.test('test function title-case()', async (t) => {
    
    const result = await transform(xml, {
        titleCase: ['//items/item', 'title-case(.)']
    })
    result.titleCase.forEach(u => {
        t.equal(u, 'Hello World Camaro')
    })
    t.end()
})

t.test('test function title-case() unicode', async (t) => {
    
    const result = await transform(xml, {
        titleCase: ['//unicode/item', 'title-case(.)']
    })
    result.titleCase.forEach(u => {
        t.equal(u, 'Phòng 2 Người')
    })
    t.end()
})

t.test('test function title-case() upper after symbols', async (t) => {
    
    const result = await transform(xml, {
        titleCase: ['//special/item', 'title-case(.)']
    })
    result.titleCase.forEach(u => {
        t.equal(u, 'Twin/Double@Room (Room Only)')
    })
    t.end()
})

t.test('test function camel-case()', async (t) => {
    
    const result = await transform(xml, {
        camelCase: ['//items/item', 'camel-case(.)']
    })
    result.camelCase.forEach(u => {
        t.equal(u, 'helloWorldCamaro')
    })
    t.end()
})

t.test('test function snake-case()', async (t) => {
    
    const result = await transform(xml, {
        snakeCase: ['//items/item', 'snake-case(.)']
    })
    result.snakeCase.forEach(u => {
        t.equal(u, 'hello_world_camaro')
    })
    t.end()
})

t.test('test nested function calls', async (t) => {
    
    const result = await transform(xml, {
        snakeCase: ['//items/item', 'snake-case(lower-case(.))']
    })
    result.snakeCase.forEach(u => {
        t.equal(u, 'hello_world_camaro')
    })
    t.end()
})

t.test('test function round()', async (t) => {
    
    const result = await transform(xml, { round: 'round(root/single)' })
    t.equal(result.round, 20)
    t.end()
})

t.test('test function floor()', async (t) => {
    
    const result = await transform(xml, { floor: 'floor(root/single)' })
    t.equal(result.floor, 20)
    t.end()
})

t.test('test function ceiling()', async (t) => {
    
    const result = await transform(xml, { ceiling: 'ceiling(root/single)' })
    t.equal(result.ceiling, 21)
    t.end()
})

t.test('test function sum()', async (t) => {
    
    const result = await transform(xml, { sum: 'sum(root/number)' })
    t.equal(result.sum, 30.5)
    t.end()
})

t.test('test function count()', async (t) => {
    
    const result = await transform(xml, { count: 'count(root/number)' })
    t.equal(result.count, 2)
    t.end()
})

t.test('test function boolean()', async (t) => {
    
    const result = await transform(xml, {
        boolean: 'boolean(root/boolean = "TrUe")',
        boolean_false: 'boolean(root/boolean = "true")'
    })
    t.equal(result.boolean, true, 'boolean should be true')
    t.equal(result.boolean_false, false, 'boolean_false should be false')
    t.end()
})

t.test('test function string-join() with delimeter', async (t) => {
    
    const { joinedString } = await transform(xml, {
        joinedString: 'string-join(//list/item, ", ")'
    })
    t.equal(joinedString, 'item 1, item 2')
    t.end()
})

t.test('test function string-join() without delimeter', async (t) => {
    
    const { joinedString } = await transform(xml, {
        joinedString: 'string-join(//list/item)'
    })
    t.equal(joinedString, 'item 1item 2')
    t.end()
})