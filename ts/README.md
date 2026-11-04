# camaro (TypeScript)

A standalone, dependency-free TypeScript port of camaro's XML/XPath
transformation core. This folder is its own package; the original JavaScript
package at the repository root is left untouched.

## Layout

- `src/xml.ts` — XML parser, `toJson` conversion and pugixml-compatible printer.
- `src/xpath.ts` — XPath 1.0 tokenizer/parser/evaluator plus camaro's custom
  `title-case`, `camel-case`, `snake-case`, `upper-case`, `lower-case`,
  `string-join` and `raw` functions.
- `src/template.ts` — camaro template parsing/evaluation, including the
  simple-navigation fast paths used by the native implementation.
- `src/index.ts` — public `transform`, `toJson`, `prettyPrint`, `destroy` API.
- `dist/` — compiled CommonJS output.
- `test-redirect.js` / `run-tests.js` — run the repository's original
  `../test/*.test.js` suite directly against this package.

The test suite is not copied. `run-tests.js` launches tape with a preload that
redirects the suite's `require('../')` from the original package entry point to
`dist/index.js`, so the tests always match the upstream repository.

## Install, build and test

```sh
cd ts
npm install
npm test        # builds with the latest tsc, then runs the original test suite
```

Use `npm run build` to build without running the tests.
