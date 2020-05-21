## Transform to array

```xml
<root>
    <items>
        <item>
            <name>item 1</name>
            <value>value 1</value>
        </item>
        <item>
            <name>item 2</name>
            <value>value 2</value>
        </item>
        <item>
            <name>item 3</name>
            <value>value 3</value>
        </item>
        <item>
            <name>item 4</name>
            <value>value 4</value>
        </item>
    </items>
</root>
```

### Example 1

```js
const { transform } = require('camaro')

;(async function() {
    const template = {
        items: ['/root/items/item', {
            name: 'name',
            value: 'value'
        }]
    }
    const result = await transform(xml, template)
    console.log(JSON.stringify(result, null, 2))
})()
```

Output: 
```
{
  "items": [
    {
      "name": "item 1",
      "value": "value 1"
    },
    {
      "name": "item 2",
      "value": "value 2"
    },
    {
      "name": "item 3",
      "value": "value 3"
    },
    {
      "name": "item 4",
      "value": "value 4"
    }
  ]
}
```


### Example 2

Getting just names only as array of name string

```js
const { transform } = require('camaro')

;(async function() {
    const template = {
        names: ['/root/items/item', 'name']
    }
    const result = await transform(xml, template)
    console.log(JSON.stringify(result, null, 2))
})()
```

Output: 
```
{
  "names": [
    "item 1",
    "item 2",
    "item 3",
    "item 4"
  ]
}
```