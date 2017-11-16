# camaro

[![NPM](https://nodei.co/npm/camaro.png?downloads=true)](https://npmjs.org/package/camaro)

> camaro is an utility to transform XML to JSON, using Node.js binding to native XML parser [pugixml](http://pugixml.org/), one of the fastest XML parser around.

[![npm](https://img.shields.io/npm/v/camaro.svg?style=flat-square)](https://npm.im/camaro)
[![Travis](https://img.shields.io/travis/tuananh/camaro/master.svg?label=Linux%20%26%20macOS%20build&style=flat-square)](https://travis-ci.org/tuananh/camaro)
[![AppVeyor](https://img.shields.io/appveyor/ci/tuananh/camaro/master.svg?label=Windows%20build&style=flat-square)](https://ci.appveyor.com/project/tuananh/camaro)
[![David](https://img.shields.io/david/tuananh/camaro.svg?style=flat-square)](https://david-dm.org/tuananh/camaro)
[![npm](https://img.shields.io/npm/dt/camaro.svg?style=flat-square)](https://npm.im/camaro)
## Features

* Transform XML to JSON. Only take properties that you're interested in.
* Output is a ready to use JS object.
* Work on all major platforms (OS X, Linux and Windows). See Travis CI and AppVeyor build status for details.
* SUPER FAST!! We're using [pugixml](http://pugixml.org/) underneath. It's one of the fastest xml parser around.

Here are the benchmarks:

```
camaro x 606 ops/sec ±1.02% (84 runs sampled)
rapidx2j x 175 ops/sec ±2.32% (78 runs sampled)
xml2json x 19.54 ops/sec ±2.23% (36 runs sampled)
xml2js x 32.90 ops/sec ±8.11% (59 runs sampled)
fast-xml-parser x 154 ops/sec ±4.06% (64 runs sampled)
nkit4nodejs x 80.14 ops/sec ±2.99% (68 runs sampled)
xml-js x 28.51 ops/sec ±8.18% (53 runs sampled)
libxmljs x 107 ops/sec ±18.57% (48 runs sampled)
```

* Please note that this is an unfair game for camaro because it only transform what it needs.
The whole reason of me creating this is because most of the time, I'm just interested in some of the data in the whole XML mess.

* Benchmark run with Intel Core i5-5257U CPU @ 2.70GHz using Node v7.10.0

* I may expose another method to transform the whole XML tree so that the benchmark will better reflect the real performance.

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
* Some string manipulation functions which are not availble in XPath 1.0 such as `lower-case`, `upper-case`, `title-case`, `camel-case` and `snake-case`

The rest are pretty much vanilla XPath 1.0.


```js
const transform = require('camaro')
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

const result = transform(xml, template)
```

### Namespaces

By default, a path `'//HotelSummary'` will transform all `HotelSummary` elements regardless of their namespaces. To only transform elements under a specific namespace, say `http://v3.hotel.wsapi.ean.com`, you can append the path with a filter:

    '//HotelSummary[namespace-uri() = "http://v3.hotel.wsapi.ean.com"]'

## Using camaro on AWS Lambda

In order to use `camaro` on AWS Lambda, you should download a copy of prebuilt camaro from [Releases](https://github.com/tuananh/camaro/releases) and put to this folder path `node_modules/camaro/lib/binding/camaro.node`.

As of currently, AWS Lambda only supports node 6 on Linux so you're looking for `camaro-v2.1.0-node-v48-linux-x64.tar.gz`.

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
