const t = require('tape')
const { transform } = require('../')

t.test(
    'camaro should be able to parse an array template too (1)',
    async (t) => {
        const xml = `
        <root>
            <item>1</item>
            <item>2</item>
            <item>3</item>
        </root>
    `
        const result = await transform(xml, ['root/item', 'number(.)'])
        t.deepEqual(result, [1, 2, 3])

        const result2 = await transform(xml, [
            'root/item',
            {
                value: 'number(.)'
            }
        ])
        t.deepEqual(result2, [{ value: 1 }, { value: 2 }, { value: 3 }])

        t.end()
    }
)
