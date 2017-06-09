# camaro

[![NPM](https://nodei.co/npm/camaro.png?downloads=true)](https://npmjs.org/package/camaro)

> camaro is an utility to transform XML to JSON, using Node.js binding to native XML parser [pugixml](http://pugixml.org/), one of the fastest XML parser around.

[![npm version](https://badge.fury.io/js/camaro.svg)](https://badge.fury.io/js/camaro)
[![Build Status: Linux](https://travis-ci.org/tuananh/camaro.svg?branch=master)](https://travis-ci.org/tuananh/camaro)
[![Build Status: Windows](https://ci.appveyor.com/api/projects/status/2jqxopf614tvwl7o/branch/master?svg=true)](https://ci.appveyor.com/project/tuananh/camaro)
[![Dependency Status](https://dependencyci.com/github/tuananh/camaro/badge)](https://dependencyci.com/github/tuananh/camaro)
[![Greenkeeper badge](https://badges.greenkeeper.io/tuananh/camaro.svg)](https://greenkeeper.io/)

## Features

* Transform XML to JSON. Only take properties that you're interested in.
* Output is a ready to use JS object.
* Work on all major platforms (OS X, Linux and Windows). See Travis CI and AppVeyor build status for details.
* SUPER FAST!! We're using [pugixml](http://pugixml.org/) underneath. It's one of the fastest xml parser around.

Here are the benchmarks:

```
camaro x 513 ops/sec ±0.86% (86 runs sampled)
rapidx2j x 175 ops/sec ±0.91% (79 runs sampled)
xml2json x 21.61 ops/sec ±0.83% (39 runs sampled)
xml2js x 21.64 ops/sec ±6.27% (41 runs sampled)
fast-xml-parser x 87.52 ops/sec ±3.49% (64 runs sampled)
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
                non_refundable: 'boolean(nonRefundable == "true")',
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