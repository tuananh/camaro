# Benchmark

## transform()

`node benchmark/transform`

```
camaro x 287 ops/sec ±0.74% (79 runs sampled)
rapidx2j x 233 ops/sec ±0.49% (87 runs sampled)
xml2json x 50.36 ops/sec ±1.08% (65 runs sampled)
xml2js x 40.71 ops/sec ±8.94% (56 runs sampled)
fast-xml-parser x 227 ops/sec ±1.07% (88 runs sampled)
xml-js x 38.52 ops/sec ±7.82% (53 runs sampled)
```

## prettyPrint()

`node benchmark/pretty-print`

```
camaro x 201,493 ops/sec ±1.25% (77 runs sampled)
pretty-data x 132,456 ops/sec ±3.72% (85 runs sampled)
prettify-xml x 199,420 ops/sec ±1.45% (91 runs sampled)
```