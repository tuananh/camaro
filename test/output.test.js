const t = require('tape')
const { transform } = require('../')

t.test('test output is empty', async (t) => {
    try {
        const result = await transform('Too Many Requests', { check: 'valid_xml' })
    } catch (err) {
        t.equal(err instanceof TypeError, true, 'should throw TypeError malformed xml')
    }

    try {
        const result = await transform('<tag>invalid xml<ta/>', { check: 'valid_xml' })
    } catch (err) {
        t.equal(err instanceof TypeError, true, 'should throw TypeError malformed xml')
    }

    t.end()
})
