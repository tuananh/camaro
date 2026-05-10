const t = require('tape')
const { toJson } = require('../')

/** Inputs that must throw before WASM (non-empty string guard). */
const INVALID_INPUTS = [
    { label: 'empty string', input: '' },
    { label: 'null', input: null },
    { label: 'undefined', input: undefined },
    { label: 'number zero', input: 0 },
    { label: 'plain object', input: {} },
    { label: 'array', input: [] },
    { label: 'NaN', input: NaN },
    { label: 'false', input: false },
]

/** Valid XML strings and the exact JSON shape we expect from `toJson`. */
const TO_JSON_CASES = [
    // --- Root & leaf shapes (JSON string vs empty object) ---
    {
        name: 'single self-closing root',
        xml: '<doc/>',
        expected: { doc: {} },
    },
    {
        name: 'leaf text collapses to JS string (digits stay string)',
        xml: '<n>42</n>',
        expected: { n: '42' },
    },
    {
        name: 'leaf text preserves literal true/false as strings',
        xml: '<flag>true</flag><other>false</other>',
        expected: { flag: 'true', other: 'false' },
    },
    {
        name: 'empty element child is empty object',
        xml: '<root><leaf/></root>',
        expected: { root: { leaf: {} } },
    },

    // --- Nested objects (JSON object type, arbitrary depth) ---
    {
        name: 'two-level nesting',
        xml: '<root><a>1</a><b><c>hi</c></b></root>',
        expected: {
            root: {
                a: '1',
                b: { c: 'hi' },
            },
        },
    },
    {
        name: 'five-level linear nesting',
        xml: '<a><b><c><d><e>deep</e></d></c></b></a>',
        expected: { a: { b: { c: { d: { e: 'deep' } } } } },
    },
    {
        name: 'inner wrapper acts as nested root',
        xml: '<doc><inner-root><x>1</x><y><z/></y></inner-root></doc>',
        expected: {
            doc: {
                'inner-root': {
                    x: '1',
                    y: { z: {} },
                },
            },
        },
    },

    // --- Attributes → object under `$` ---
    {
        name: 'attributes map to $ object',
        xml: '<item id="42" flag="true">content</item>',
        expected: {
            item: {
                $: { id: '42', flag: 'true' },
                _text: 'content',
            },
        },
    },
    {
        name: 'attributes-only element ($ only, empty string attr)',
        xml: '<meta charset="utf-8" data-empty=""/>',
        expected: {
            meta: {
                $: { charset: 'utf-8', 'data-empty': '' },
            },
        },
    },
    {
        name: '$ plus nested element children',
        xml: '<root><box id="1"><inner>x</inner></box></root>',
        expected: {
            root: {
                box: {
                    $: { id: '1' },
                    inner: 'x',
                },
            },
        },
    },

    // --- Arrays (duplicate sibling tag names) ---
    {
        name: 'duplicate siblings become JS array of strings',
        xml: '<list><x>1</x><x>2</x><y>a</y></list>',
        expected: {
            list: {
                x: ['1', '2'],
                y: 'a',
            },
        },
    },
    {
        name: 'three duplicates extend array',
        xml: '<r><n>1</n><n>2</n><n>3</n></r>',
        expected: { r: { n: ['1', '2', '3'] } },
    },
    {
        name: 'array of nested objects',
        xml:
            '<items>' +
            '<item><id>a</id></item>' +
            '<item><id>b</id></item>' +
            '</items>',
        expected: {
            items: {
                item: [{ id: 'a' }, { id: 'b' }],
            },
        },
    },
    {
        name: 'heterogeneous array (text leaf vs subtree)',
        xml: '<r><n>plain</n><n><k>v</k></n></r>',
        expected: {
            r: {
                n: ['plain', { k: 'v' }],
            },
        },
    },

    // --- Text / CDATA / entities / unicode ---
    {
        name: 'CDATA becomes plain string',
        xml: '<root><![CDATA[<tag>&]]></root>',
        expected: { root: '<tag>&' },
    },
    {
        name: 'character entities expanded in text',
        xml: '<root>a&amp;b&lt;c&gt;</root>',
        expected: { root: 'a&b<c>' },
    },
    {
        name: 'unicode including emoji',
        xml: '<root><t>日本語 🚗</t></root>',
        expected: { root: { t: '日本語 🚗' } },
    },

    // --- Mixed content (`_text` + element children) ---
    {
        name: 'mixed text and elements merge adjacent text into _text',
        xml: '<wrap>before<mid/>after</wrap>',
        expected: {
            wrap: {
                _text: 'beforeafter',
                mid: {},
            },
        },
    },

    // --- Whitespace trimming ---
    {
        name: 'formatting whitespace between tags ignored',
        xml: '<root>\n\t  \n\t<a>ok</a>\n\n</root>',
        expected: { root: { a: 'ok' } },
    },
    {
        name: 'only-whitespace body collapses to {}',
        xml: '<root>   \n\t   </root>',
        expected: { root: {} },
    },

    // --- Declaration, comments, invalid XML ---
    {
        name: 'XML declaration does not add JSON keys',
        xml: '<?xml version="1.0" encoding="UTF-8"?><doc><x>1</x></doc>',
        expected: { doc: { x: '1' } },
    },
    {
        name: 'comments omitted from output',
        xml: '<root><!-- ignored --><a>1</a><!-- tail --></root>',
        expected: { root: { a: '1' } },
    },
    {
        name: 'malformed XML yields empty object',
        xml: '<not-xml',
        expected: {},
    },
    {
        name: 'non-markup whitespace yields empty object',
        xml: '   \n\t  ',
        expected: {},
    },

    // --- One composite document (several JSON shapes at once) ---
    {
        name: 'kitchen sink: strings, $, array, nesting',
        xml:
            '<response ok="1">' +
            '<msg>ok</msg>' +
            '<rows>' +
            '<row><cell>a</cell><cell>b</cell></row>' +
            '<row><cell>c</cell></row>' +
            '</rows>' +
            '<meta/>' +
            '</response>',
        expected: {
            response: {
                $: { ok: '1' },
                msg: 'ok',
                rows: {
                    row: [
                        { cell: ['a', 'b'] },
                        { cell: 'c' },
                    ],
                },
                meta: {},
            },
        },
    },
]

t.test('toJson rejects invalid xml arguments', async (t) => {
    for (const { label, input } of INVALID_INPUTS) {
        try {
            await toJson(input)
            t.fail(`expected TypeError (${label})`)
        } catch (e) {
            t.ok(e instanceof TypeError, `TypeError: ${label}`)
        }
    }
    t.end()
})

t.test('toJson table: xml input vs expected JSON', async (t) => {
    for (const { name, xml, expected } of TO_JSON_CASES) {
        const actual = await toJson(xml)
        t.deepEqual(actual, expected, name)
    }
    t.end()
})

t.test('toJson table: array branches are real Arrays', async (t) => {
    const needsArrayPath = [
        {
            name: 'list.x is Array',
            xml: '<list><x>1</x><x>2</x></list>',
            path: (r) => r.list.x,
        },
        {
            name: 'items.item is Array',
            xml: '<items><item/><item/></items>',
            path: (r) => r.items.item,
        },
        {
            name: 'row.cell array inside kitchen-sink shape',
            xml: '<row><cell>a</cell><cell>b</cell></row>',
            path: (r) => r.row.cell,
        },
    ]
    for (const { name, xml, path } of needsArrayPath) {
        const actual = await toJson(xml)
        const branch = path(actual)
        t.ok(Array.isArray(branch), `${name}: Array.isArray`)
    }
    t.end()
})
