# Benchmark

Never mind about the actual number. You can check the percentage differences between package for reference.

Benchmark ran on Macbook 16".

## transform()

`node benchmark/transform`

```
camaro v6: 1,395.6 ops/sec
fast-xml-parser: 153 ops/sec
xml2js: 47.6 ops/sec
xml-js: 51 ops/sec
```

## prettyPrint()

`node benchmark/pretty-print`

`camaro` loses big time here.

```
camaro v6: 62,363.2 ops/sec
pretty-data: 141,257.8 ops/sec
prettifyXml: 258,408 ops/sec
```