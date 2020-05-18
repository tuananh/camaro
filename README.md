# camaro

> camaro is an utility to transform XML to JSON, using Node.js binding to native XML parser [pugixml](http://pugixml.org/), one of the fastest XML parser around.

[![npm](https://badgen.net/npm/v/camaro)](https://npm.im/camaro)
![npm bundle size](https://badgen.net/packagephobia/publish/camaro)
[![Build Status](https://dev.azure.com/me0499/camaro/_apis/build/status/tuananh.camaro?branchName=develop)](https://dev.azure.com/me0499/camaro/_build/latest?definitionId=1&branchName=develop)
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
* Scale well with multi-core processor by use of `worker_threads` pool (Node >= 12).
* AWS Lambda friendly (or serverless in general).
* SUPER FAST!! We're using [pugixml](http://pugixml.org/) underneath. It's one of the fastest XML parser around.
* Small footprint (Zero dependencies).
* Pretty print XML.

## 🔥 Benchmark

```
camaro v6: 1,395.6 ops/sec
fast-xml-parser: 153 ops/sec
xml2js: 47.6 ops/sec
xml-js: 51 ops/sec
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

const xml = `
    <players>
        <player jerseyNumber="10">
            <name>wayne rooney</name>
            <isRetired>false</isRetired>
            <yearOfBirth>1985</yearOfBirth>
        </player>
        <player jerseyNumber="7">
            <name>cristiano ronaldo</name>
            <isRetired>false</isRetired>
            <yearOfBirth>1985</yearOfBirth>
        </player>
        <player jerseyNumber="7">
            <name>eric cantona</name>
            <isRetired>true</isRetired>
            <yearOfBirth>1966</yearOfBirth>
        </player>
    </players>
`

/**
 * the template can be an object or an array depends on what output you want the XML to be transformed to.
 * 
 * ['players/player', {name, ...}] means that: Get all the nodes with this XPath expression `players/player`.
 *      - the first param is the XPath path to get all the XML nodes.
 *      - the second param is a string or an object that describe the shape of the array element and how to get it.
 * 
 * For each of those XML node
 *      - call the XPath function `title-case` on field `name` and assign it to `name` field of the output.
 *      - get the attribute `jerseyNumber` from XML node player
 *      - get the `yearOfBirth` attribute from `yearOfBirth` and cast it to number.
 *      - cast `isRetired` to true if its string value equals to "true", and false otherwise.
 */

const template = ['players/player', {
    name: 'title-case(name)',
    jerseyNumber: '@jerseyNumber',
    yearOfBirth: 'number(yearOfBirth)',
    isRetired: 'boolean(isRetired = "true")'
}]

;(async function () {
    await ready()
    const result = await transform(xml, template)
    console.log(result)

    const prettyStr = await prettyPrint(xml, { indentSize: 4})
    console.log(prettyStr)
})()
```

Output of `transform()`

```
[
    {
        name: 'Wayne Rooney',
        jerseyNumber: 10,
        yearOfBirth: 1985,
        isRetired: false,
    },
    {
        name: 'Cristiano Ronaldo',
        jerseyNumber: 7,
        yearOfBirth: 1985,
        isRetired: false,
    },
    {
        name: 'Eric Cantona',
        jerseyNumber: 7,
        yearOfBirth: 1966,
        isRetired: true,
    }
]
```

And output of `prettyPrint()`

```
<players>
    <player jerseyNumber="10">
        <name>Wayne Rooney</name>
        <isRetired>false</isRetired>
        <yearOfBirth>1985</yearOfBirth>
    </player>
    <player jerseyNumber="7">
        <name>Cristiano Ronaldo</name>
        <isRetired>false</isRetired>
        <yearOfBirth>1985</yearOfBirth>
    </player>
    <player jerseyNumber="7">
        <name>Eric Cantona</name>
        <isRetired>true</isRetired>
        <yearOfBirth>1966</yearOfBirth>
    </player>
</players>
```

## Licence

[The MIT License](LICENSE)
