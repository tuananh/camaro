## Getting raw xml of a node

Related issue: [#82](https://github.com/tuananh/camaro/issues/82)

```js
const { ready, transform } = require('camaro')

const xml = `
    <items>
        <item>hello</item>
        <item />
        <item>world</item>
    </items>
`

const template = {
    rawXml: 'raw(/items)'
}

;(async function main() {
    await ready()
    const output = await transform(xml, template)
    console.log(JSON.stringify(output, null, 4))
})();
```

Output

```json
{
    "rawXml": "<items>\n\t<item>hello</item>\n\t<item />\n\t<item>world</item>\n</items>\n"
}
```