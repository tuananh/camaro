# Contributing to camaro

* [Issues](#issues)
* [Pull Requests](#pull-requests)
* [Setup development environment](#setup-development-environment)
* [Code style](#code-style)

## Issues

* State version of node/camaro/OS.
* Include a minimal script which can reproduce the issue.

## Pull Requests

* Make sure all tests pass.
* If new feature(s) is included, write test(s) for them as well.
* Check the benchmark script to see if there's any performance regression.

## Setup development environment

Install [Nix](https://nixos.org/download/) with flakes enabled, then enter the
project's pinned development environment:

```sh
nix develop

npm install

# for fetching c++ dependencies using napa
npm run install-deps

# build the WebAssembly module
npm run build

# tests
npm test
```

## Code style

Run `npm run format` before submitting changes and use `npm run format:check`
to verify formatting without modifying files.

C and C++ code uses tabs with a width of four, Allman braces, and left-aligned
pointers. Variables use `snake_case`, functions use `lowerCamelCase`, types use
`UpperCamelCase`, global constants use `kCamelCase`, and macros use
`SCARY_CASE`. Public native symbols have a `camaro_` prefix.

The core implementation is C++98 and does not use the STL, RTTI, or exceptions.
Pugixml is its sole dependency and is built with exceptions disabled. The
Emscripten/Embind adapter is compiled separately with a modern C++ standard and
may use the STL required at the JavaScript boundary.

JavaScript and TypeScript follow the repository Prettier configuration: tabs,
single quotes, semicolons, and a 150-column print width. Existing public
JavaScript and WebAssembly names are compatibility constraints and do not
change to match private naming rules.

The files in `dist/` are generated. Do not edit them directly; run
`npm run build` after native changes and commit both regenerated artifacts.
Before submitting a native change, run a warning-clean build, `npm test`, and
the relevant benchmark.
