const t = require('tape')
const { ready, transform } = require('../')

t.test(
    'camaro should be able to parse an array template',
    async (t) => {
        const xml = `
            <root>
                <item>1</item>
                <item>2</item>
                <item>3</item>
            </root>
        `
        await ready()
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
