'use strict'

const t = require('tape')
const { transform } = require('../')

t.test('worker result IPC preserves JSON and NaN values', async (t) => {
    const [, result] = await Promise.all([
        transform('<warmup/>', { value: 'warmup' }),
        transform('<root><item>one</item><item>two</item></root>', {
            items: ['root/item', '.'],
            missing: 'number(root/@missing)',
        }),
    ])

    t.deepEqual(result.items, ['one', 'two'], 'parses the worker JSON result')
    t.ok(Number.isNaN(result.missing), 'restores NaN from the worker result')
    t.end()
})
