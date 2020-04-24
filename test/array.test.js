const fs = require('fs')
const t = require('tape')
const { ready, transform } = require('../')

t.test('array test', async t => {
    const xml = fs.readFileSync('examples/recipe.xml', 'utf-8')
    const recipeTemplate = {
        id: '/recipe/@xml:id',
        ingredients: [
            '//list/listItem',
            {
                quantity: 'measure/quantity',
                unit: 'measure/unit',
                descriptor: 'ingredientphrase/descriptor'
            }
        ]
    }
    await ready()
    const result = await transform(xml, recipeTemplate)
    t.equal(typeof result, 'object', 'result is expected to be object')
    t.equal(result.id, 'moco09596c01s001r002')
    t.equal(Array.isArray(result.ingredients), true, 'typeof result.ingredients === array')
    t.equal(result.ingredients.length, 10, 'length result.ingredients === 10')

    t.end()
})
