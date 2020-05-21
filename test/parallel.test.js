const t = require('tape')
const { transform } = require('../')

t.test('parallel test', async t => {
    
    const doit = () => transform('<foo>bar</foo>', { foo: 'foo' })
    let called = 0
    await doit().then(_ => { called += 1 })
    await doit().then(_ => { called += 1 })

    t.equal(called, 2, '`called` should equal to 2')
    t.end()
})