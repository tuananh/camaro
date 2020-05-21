# 4.0.2 API Reference

- [camaro](#camaro)
  - [`transform(xml, template)`](#transformxml-template)
  - [`toJson(xml)`](#tojsonxml)
  - [`prettyPrint(xml)`](#prettyprintxml)

## camaro

### `transform(xml, template)`

Transform xml string to JSON using the given template powered by XPath where:
- `xml` - the input xml string
- `template` - the XPath template object, powered by XPath.

```js
const { transform } = require('camaro')
const fs = require('fs')

const xml = fs.readFileSync('examples/ean.xml', 'utf-8')
const template = {
    cache_key: '/HotelListResponse/cacheKey',
    hotels: ['//HotelSummary', {
        hotel_id: 'hotelId',
        name: 'name',
        rooms: ['RoomRateDetailsList/RoomRateDetails', {
            rates: ['RateInfos/RateInfo', {
                currency: 'ChargeableRateInfo/@currencyCode',
                non_refundable: 'boolean(nonRefundable = "true")',
                price: 'number(ChargeableRateInfo/@total)'
            }],
            room_name: 'roomDescription',
            room_type_id: 'roomTypeCode'
        }]
    }],
    session_id: '/HotelListResponse/customerSessionId'
}

;(async function () {
    const result = await transform(xml, template)
    console.log(result)
})()
```

### `toJson(xml)`

**Not yet implemented**

Transform xml string to JSON where:
- `xml` - the input xml string

```js
const { toJson } = require('camaro')
const fs = require('fs')

const xml = fs.readFileSync('examples/ean.xml', 'utf-8')

;(async function () {
    const result = await toJson(xml)
    console.log(result)
})()
```

### `prettyPrint(xml)`

Pretty print xml string where:
- `xml` - the input xml string
- `options` - an optional object with the following optional keys:
    - `indentSize` - a number of space to use for indenting

```js
const { prettyPrint } = require('camaro')
const fs = require('fs')

const xml = fs.readFileSync('examples/ean.xml', 'utf-8')

;(async function () {
    const result = await prettyPrint(xml, { indentSize: 4 })
    console.log(result)
})()
```
