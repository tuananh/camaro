const t = require('tape')

// delete require cache to force module to reinitialize
delete require.cache[require.resolve('../')]

const { transform } = require('../')

t.test('throw not ready error if `ready()` is not called', async t => {
    try {
        await transform('<foo>bar</foo>', { foo: 'foo' })
        t.end()
    } catch (err) {
        t.equal(err.message, 'camaro is not yet initialized. You need to call `ready()` first.')        
        t.end()
    }
})