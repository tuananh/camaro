const t = require('tape')
const { Buffer } = require('node:buffer')
const { transform, toJson, prettyPrint } = require('../')

const enc = new TextEncoder()

/** Same cases as test/to-json.test.js — Utf-8 bytes should match string path */
const SAMPLE_TO_JSON_CASES = [
    { xml: '<doc/>', expected: { doc: {} } },
    { xml: '<n>42</n>', expected: { n: '42' } },
    {
        xml: '<root><list><x>1</x><x>2</x></list></root>',
        expected: { root: { list: { x: ['1', '2'] } } },
    },
    {
        xml: '<root><t>日本語 🚗</t></root>',
        expected: { root: { t: '日本語 🚗' } },
    },
]

t.test('utf8 rejects empty binary payloads like empty strings', async (t) => {
    const emptyBinaries = [
        { label: 'Buffer.alloc(0)', input: Buffer.alloc(0) },
        { label: 'Uint8Array(0)', input: new Uint8Array() },
        { label: 'ArrayBuffer(0)', input: new ArrayBuffer(0) },
    ]

    for (const { label, input } of emptyBinaries) {
        try {
            await transform(input, { k: '//k' })
            t.fail(`transform should throw for ${label}`)
        } catch (e) {
            t.ok(e instanceof TypeError, `transform TypeError: ${label}`)
        }
        try {
            await toJson(input)
            t.fail(`toJson should throw for ${label}`)
        } catch (e) {
            t.ok(e instanceof TypeError, `toJson TypeError: ${label}`)
        }
        try {
            await prettyPrint(input)
            t.fail(`prettyPrint should throw for ${label}`)
        } catch (e) {
            t.ok(e instanceof TypeError, `prettyPrint TypeError: ${label}`)
        }
    }

    t.end()
})

t.test('toJson from Utf-8 bytes matches string path', async (t) => {
    for (const { xml, expected } of SAMPLE_TO_JSON_CASES) {
        const utf8bytes = enc.encode(xml)
        const fromU8 = await toJson(utf8bytes)
        const fromBuf = await toJson(Buffer.from(utf8bytes))
        const fromAb = await toJson(utf8bytes.buffer.slice(utf8bytes.byteOffset, utf8bytes.byteOffset + utf8bytes.byteLength))
        const fromStr = await toJson(xml)

        t.deepEqual(fromU8, expected, xml)
        t.deepEqual(fromBuf, expected, `${xml} (Buffer)`)
        t.deepEqual(fromAb, expected, `${xml} (ArrayBuffer)`)
        t.deepEqual(fromStr, expected, `${xml} (string control)`)
    }
    t.end()
})

t.test('transform from Utf-8 bytes', async (t) => {
    const xmlStr = `<root><single>42</single></root>`
    const template = {
        single: 'number(root/single)',
    }
    const bytes = enc.encode(xmlStr)
    const r1 = await transform(bytes, template)
    const r2 = await transform(Buffer.from(bytes), template)
    const r3 = await transform(xmlStr, template)
    t.equal(r1.single, 42)
    t.deepEqual(r1, r2)
    t.deepEqual(r1, r3)
    t.end()
})

t.test('prettyPrint from Utf-8 bytes preserves output', async (t) => {
    const xml = '<root><x/></root>'
    const bytes = enc.encode(xml)
    const a = await prettyPrint(bytes)
    const b = await prettyPrint(Buffer.from(bytes))
    const c = await prettyPrint(xml)
    t.equal(a, b)
    t.equal(b, c)
    t.ok(a.includes('root'))
    t.end()
})
