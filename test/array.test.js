const fs = require('fs');
const t = require('tape');
const { transform } = require('../');

t.test('array test', async (t) => {
	const xml = fs.readFileSync('examples/recipe.xml', 'utf-8');
	const recipeTemplate = {
		id: '/recipe/@xml:id',
		ingredients: [
			'//list/listItem',
			{
				quantity: 'measure/quantity',
				unit: 'measure/unit',
				descriptor: 'ingredientphrase/descriptor',
			},
		],
	};

	const result = await transform(xml, recipeTemplate);
	t.equal(typeof result, 'object', 'result is expected to be object');
	t.equal(result.id, 'moco09596c01s001r002');
	t.equal(Array.isArray(result.ingredients), true, 'typeof result.ingredients === array');
	t.equal(result.ingredients.length, 10, 'length result.ingredients === 10');

	t.end();
});

// https://github.com/tuananh/camaro/issues/178
t.test('array path traverses every matching parent', async (t) => {
	const xml = `
        <players>
            <group>
                <player><name>wayne rooney</name></player>
                <player><name>cristiano ronaldo</name></player>
            </group>
            <group>
                <player><name>eric cantona</name></player>
            </group>
        </players>
    `;
	const result = await transform(xml, ['players/group/player', { name: 'name' }]);

	t.deepEqual(result, [{ name: 'wayne rooney' }, { name: 'cristiano ronaldo' }, { name: 'eric cantona' }]);
	t.end();
});
