const t = require('tape')
const { ready, transform } = require('../')

t.test('test invalid xml string',async (t) => {
    try {
        await ready()
        await transform('', {})
    } catch (err) {
        t.equal(err instanceof TypeError, true, 'should throw TypeError invalid xml string')
    }

    t.end()
})

t.test('test invalid template argument',async (t) => {
    try {
        await ready()
        await transform('<xml/>', null)
    } catch (err) {
        t.equal(err instanceof TypeError, true, 'should throw TypeError invalid template')
    }

    try {
        await ready()
        await transform('<xml/>', {})
    } catch (err) {
        t.equal(err instanceof TypeError, true, 'should throw TypeError invalid template')
    }

    t.end()
})
