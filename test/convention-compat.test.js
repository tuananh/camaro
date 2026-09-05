'use strict';

const t = require('tape');
const camaro = require('../');
const { transform, toJson, prettyPrint } = camaro;

t.test('public API names stay compatible', (t) => {
	t.equal(typeof camaro.transform, 'function');
	t.equal(typeof camaro.toJson, 'function');
	t.equal(typeof camaro.prettyPrint, 'function');
	t.equal(typeof camaro.destroy, 'function');
	t.end();
});

t.test('malformed template values yield an empty object', async (t) => {
	const xml = '<root><id>1</id></root>';
	t.deepEqual(await transform(xml, { id: 1 }), {});
	t.deepEqual(await transform(xml, { nested: { ok: true } }), {});
	t.end();
});

t.test('invalid xpath expressions stay empty strings', async (t) => {
	const result = await transform('<root/>', { invalidXPath: 'concat()' });
	t.equal(result.invalidXPath, '');
	t.end();
});

t.test('registered templates can be reused across payloads', async (t) => {
	const template = {
		id: 'root/id',
		flag: 'boolean(root/flag = "yes")',
		count: 'number(root/count)',
	};
	const first = await transform('<root><id>a</id><flag>yes</flag><count>2</count></root>', template);
	const second = await transform('<root><id>b</id><flag>no</flag><count>7</count></root>', template);
	t.deepEqual(first, { id: 'a', flag: true, count: 2 });
	t.deepEqual(second, { id: 'b', flag: false, count: 7 });
	t.end();
});

t.test('NaN from number() is restored through the adapter', async (t) => {
	const result = await transform('<item value="3"/>', {
		present: 'number(/item/@value)',
		absent: 'number(/item/@missing)',
	});
	t.equal(result.present, 3);
	t.ok(Number.isNaN(result.absent));
	t.end();
});

t.test('UTF-8 bytes match the string path for public APIs', async (t) => {
	const xml = '<doc><title>café</title></doc>';
	const bytes = Buffer.from(xml, 'utf8');
	const template = { title: 'doc/title' };

	t.deepEqual(await transform(bytes, template), await transform(xml, template));
	t.deepEqual(await toJson(bytes), await toJson(xml));
	t.equal(await prettyPrint(bytes), await prettyPrint(xml));
	t.end();
});
