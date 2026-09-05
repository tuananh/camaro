const t = require('tape');
const { transform } = require('../');

t.test('reusing a template does not cache transform results', async (t) => {
	const template = {
		id: 'root/id',
		value: 'root/value',
	};

	const first = await transform('<root><id>1</id><value>one</value></root>', template);
	const second = await transform('<root><id>2</id><value>two</value></root>', template);

	t.deepEqual(first, { id: '1', value: 'one' }, 'returns the first payload values');
	t.deepEqual(second, { id: '2', value: 'two' }, 'returns the second payload values');
	t.end();
});
