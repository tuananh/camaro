# Benchmark

Never mind about the actual number. You can check the percentage differences between package for reference.

Benchmark ran on AMZ Ryzen 3800X.

## transform()

`node benchmark/transform`

```
camaro x 362 ops/sec ±0.31% (87 runs sampled)
rapidx2j x 226 ops/sec ±0.27% (88 runs sampled)
xml2json x 46.32 ops/sec ±1.39% (61 runs sampled)
xml2js x 50.51 ops/sec ±7.22% (68 runs sampled)
fast-xml-parser x 256 ops/sec ±0.63% (86 runs sampled)
xml-js x 45.05 ops/sec ±6.19% (61 runs sampled)
```

## prettyPrint()

`node benchmark/pretty-print`

```
camaro x 274,438 ops/sec ±0.56% (87 runs sampled)
pretty-data x 155,168 ops/sec ±0.82% (94 runs sampled)
prettify-xml x 244,450 ops/sec ±0.28% (94 runs sampled)
```