## Default value if a path value is empty

Related issue: [#78](https://github.com/tuananh/camaro/issues/78)

```js
const { transform } = require('camaro')

const xml = `
    <items>
        <item>hello</item>
        <item />
        <item>world</item>
    </items>
`
const textOrDefault = (defaultValue) => `concat(
    text(),
    substring(
        "${defaultValue}",
        1,
        number(not(text())) * string-length("${defaultValue}")
    )
)`
const template = {
    items: ['//items/item', textOrDefault('my default val')]
}

;(async function main() {
    const output = await transform(xml, template)
    console.log(JSON.stringify(output, null, 4))
})();
```

Output

```json
{
    "items": [
        "hello",
        "my default val",
        "world"
    ]
}
```