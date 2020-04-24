const t = require('tape')
const { ready, transform } = require('../')

const xml = `
    <root>
        <first_name>john</first_name>
        <last_name>doe</last_name>
        <middle_name>whatever</middle_name>
    </root>
`
t.test('template key order test', async (t) => {
    const template = {
        'b': 'root/first_name',
        'a': 'root/last_name',
        'c': 'root/middle_name'
    }
    await ready()
    const output = await transform(xml, template)
    t.deepEqual(Object.keys(output), Object.keys(template), 'keys are in original order')

    t.end()
})