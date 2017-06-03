# camaro

[![NPM](https://nodei.co/npm/camaro.png)](https://npmjs.org/package/camaro)

camaro is an utility to transform XML to JSON, using Node.js binding to native XML parser [pugixml](http://pugixml.org/), one of the fastest XML parser around.

## Features

* Transform XML to JSON. Only take properties that you're interested in.
* Output is a ready to use JS object.
* SUPER FAST!! We're using [pugixml](http://pugixml.org/) underneath. It's one of the fastest xml parser around.

![intro](intro.png)

## Installation

```sh
npm install camaro
```

## Usage

You can use our custom template format powered by [XPath](https://developer.mozilla.org/en-US/docs/Web/XPath).

We also introduce some custom syntax such as:

* if a path start with `#`, that means it's a constant. E.g: `#1234` will return `1234`
* if a path is empty, return blank

The rest are pretty much vanilla XPath 1.0.


```js
const transform = require('../')
const fs = require('fs')

const xml = fs.readFileSync('ean.xml', 'utf-8')
const template = {
    cache_key: "/HotelListResponse/cacheKey",
    hotels: ["//HotelSummary", {
        hotel_id: "hotelId",
        name: "name",
        rooms: ["RoomRateDetailsList/RoomRateDetails", {
            rates: ["RateInfos/RateInfo", {
                currency: "ChargeableRateInfo/@currencyCode",
                non_refundable: "nonRefundable",
                price: "ChargeableRateInfo/@total"
            }],
            room_name: "roomDescription",
            room_type_id: "roomTypeCode"
        }]
    }],
    session_id: "/HotelListResponse/customerSessionId"
}

const result = transform(xml, template)
```

## Licence

The MIT License

Copyright (c) 2017 Tuan Anh Tran https://tuananh.org

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.