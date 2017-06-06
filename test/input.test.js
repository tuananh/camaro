const test = require('tape')
const transform = require('../')

test('test invalid xml string', (t) => {
    try {
        const result = transform('', {})
    } catch(err) {
        t.equal(err instanceof TypeError, true, 'should throw TypeError invalid xml string')
    }

    t.end()
})

test('test invalid template argument', (t) => {
    try {
        const result = transform('<xml/>', null)
    } catch(err) {
        t.equal(err instanceof TypeError, true, 'should throw TypeError invalid template')
    }

    t.end()
})
