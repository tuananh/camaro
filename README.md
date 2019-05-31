# camaro

[![NPM](https://nodei.co/npm/camaro.png?downloads=true)](https://npmjs.org/package/camaro)

> camaro is an utility to transform XML to JSON, using Node.js binding to native XML parser [pugixml](http://pugixml.org/), one of the fastest XML parser around.

[![npm](https://badgen.net/npm/v/camaro)](https://npm.im/camaro)
![npm bundle size](https://badgen.net/packagephobia/publish/camaro)
[![Travis](https://badgen.net/travis/tuananh/camaro/master)](https://travis-ci.org/tuananh/camaro)
[![AppVeyor](https://badgen.net/appveyor/ci/tuananh/camaro/master)](https://ci.appveyor.com/project/tuananh/camaro)
[![TypeScript definitions on DefinitelyTyped](https://badgen.net/badge/DefinitelyTyped/.d.ts)](http://definitelytyped.org)
[![npm](https://badgen.net/npm/dt/camaro)](https://npm.im/camaro)

[Demo on CodeSandbox.io](https://codesandbox.io/s/static-deg9w?fontsize=14)

## 🤘 Features

* Transform XML to JSON. Only take properties that you're interested in.
* Output is a ready to use JS object.
* Written in C++ and compiled down to WebAssembly so no compilation needed.
* Work on all major platforms (OS X, Linux and Windows and the web). See Travis CI and AppVeyor build status for details.
* No need to build binary whenever a new Node version released.
* AWS Lambda friendly (or serverless in general).
* SUPER FAST!! We're using [pugixml](http://pugixml.org/) underneath. It's one of the fastest xml parser around.
* Small footprint (Zero dependencies).
* Pretty print XML.

## 🚧 Upgrading notes from version 3 🚧

- camaro v4 slows down quite a bit since switching to WebAssembly. It's still the fastest but slower by big margin. WebAssembly and Emscripten are rather new to me so bare with me while I'm figuring out the performance issue. If you need pure speed, just use camaro v3.
- 🚨BREAKING: `transform()` is now an async function.
- 🚨BREAKING: change the way transform is imported `const { transform } = require('camaro')`
- plan to add `toJson()` function to convert the whole XML input.
- DONE: plan to add `prettyPrint()` to pretty print XML.

## 🔥 Benchmark

```
camaro x 287 ops/sec ±0.74% (79 runs sampled)
rapidx2j x 233 ops/sec ±0.49% (87 runs sampled)
xml2json x 50.36 ops/sec ±1.08% (65 runs sampled)
xml2js x 40.71 ops/sec ±8.94% (56 runs sampled)
fast-xml-parser x 227 ops/sec ±1.07% (88 runs sampled)
xml-js x 38.52 ops/sec ±7.82% (53 runs sampled)
```

* Please note that **this is an unfair game for camaro** because it only transform those fields specified in template.
The whole reason of me creating this is because most of the time, I'm just interested in some of the data in the whole XML mess.

* Benchmark run on MacBookPro14,1 - Intel Core i5 CPU @ 2.30GHz using Node v8.10.0.

* I may expose another method to transform the whole XML tree so that the benchmark will better reflect the real performance.

For complete benchmark, see [benchmark/index.md](benchmark/index.md).

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

For complete API documentation, please see [API.md](API.md)

```js
const { transform, prettyPrint } = require('camaro')
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

    const prettyStr = await prettyPrint(xml, { indentSize: 4})
    console.log(prettyStr)
})()


```

## Licence

[The MIT License](LICENSE)
