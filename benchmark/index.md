# Benchmark

Never mind about the actual number. You can check the percentage differences between package for reference.

Benchmark ran on AMD Ryzen 3800X.

## transform()

`node benchmark/transform`

```
camaro v6: 2003.2 ops/sec
fast-xml-parser: 296 ops/sec
xml2js: 50.2 ops/sec
xml-js: 50 ops/sec
```

## prettyPrint()

`node benchmark/pretty-print`

```
camaro x 274,438 ops/sec ±0.56% (87 runs sampled)
pretty-data x 155,168 ops/sec ±0.82% (94 runs sampled)
prettify-xml x 244,450 ops/sec ±0.28% (94 runs sampled)
```