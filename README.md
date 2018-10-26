# camaro

[![NPM](https://nodei.co/npm/camaro.png?downloads=true)](https://npmjs.org/package/camaro)

> camaro is an utility to transform XML to JSON, using Node.js binding to native XML parser [pugixml](http://pugixml.org/), one of the fastest XML parser around.

[![npm](https://badgen.net/npm/v/camaro)](https://npm.im/camaro)
[![Travis](https://badgen.net/travis/tuananh/camaro/master)](https://travis-ci.org/tuananh/camaro)
[![AppVeyor](https://badgen.net/appveyor/ci/tuananh/camaro/master)](https://ci.appveyor.com/project/tuananh/camaro)
[![TypeScript definitions on DefinitelyTyped](https://badgen.net/badge/DefinitelyTyped/.d.ts)](http://definitelytyped.org)
[![npm](https://badgen.net/npm/dt/camaro)](https://npm.im/camaro)
## Features

* Transform XML to JSON. Only take properties that you're interested in.
* Output is a ready to use JS object.
* Work on all major platforms (OS X, Linux and Windows). See Travis CI and AppVeyor build status for details.
* SUPER FAST!! We're using [pugixml](http://pugixml.org/) underneath. It's one of the fastest xml parser around.

Here are the benchmarks:

```
camaro x 809 ops/sec ±1.51% (86 runs sampled)
rapidx2j x 204 ops/sec ±1.22% (81 runs sampled)
xml2json x 53.73 ops/sec ±0.58% (68 runs sampled)
xml2js x 40.57 ops/sec ±7.59% (56 runs sampled)
fast-xml-parser x 148 ops/sec ±3.43% (74 runs sampled)
xml-js x 33.38 ops/sec ±6.69% (60 runs sampled)
libxmljs x 127 ops/sec ±15.36% (50 runs sampled)
```

* Please note that **this is an unfair game for camaro** because it only transform those fields specified in template.
The whole reason of me creating this is because most of the time, I'm just interested in some of the data in the whole XML mess.

* Benchmark run on MacBookPro14,1 - Intel Core i5 CPU @ 2.30GHz using Node v8.10.0.

* I may expose another method to transform the whole XML tree so that the benchmark will better reflect the real performance.

* Performance on small XML strings is not very good due to crossing between JS and C++ is expensive.

![intro](intro.png)

## Installation

```sh
yarn add camaro
# npm install camaro
```

## Usage

You can use our custom template format powered by [XPath](https://developer.mozilla.org/en-US/docs/Web/XPath).

We also introduce some custom syntax such as:

* if a path start with `#`, that means it's a constant. E.g: `#1234` will return `1234`
* if a path is empty, return blank
* Some string manipulation functions which are not availble in XPath 1.0 such as `lower-case`, `upper-case`, `title-case`, `camel-case`, `snake-case` and `string-join`. Eventually, I'm hoping to add all XPath 2.0 functions but these are all that I need for now. PRs welcome.

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

[The MIT License](LICENSE)