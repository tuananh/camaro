const t = require('tape')
const { ready, transform } = require('../')

t.test('test output is empty', async (t) => {
    try {
        await ready()
        await transform('Too Many Requests', { check: 'valid_xml' })
    } catch (err) {
        t.equal(err instanceof TypeError, true, 'should throw TypeError malformed xml')
    }

    try {
        await ready()
        await transform('<tag>invalid xml<ta/>', { check: 'valid_xml' })
    } catch (err) {
        t.equal(err instanceof TypeError, true, 'should throw TypeError malformed xml')
    }

    t.end()
})
