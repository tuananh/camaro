const t = require('tape')
const { ready, transform } = require('../')

t.test('parallel test', async t => {
    await ready()
    const doit = () => transform('<foo>bar</foo>', { foo: 'foo' })
    let called = 0
    await doit().then(_ => { called += 1 })
    await doit().then(_ => { called += 1 })

    t.equal(called, 2, '`called` should equal to 2')
    t.end()
})