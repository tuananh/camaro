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

I have included the test for various XML file sizes: 300KB/ 100KB / 60KB and 7KB. As you can see `camaro` is not very good with small XML file. However, it excels with big XML file.

The tested XML files are included in `benchmarks/fixtures` folder.

## 300 KB XML file

![](fixtures/300kb.png)


## 100 KB XML file

![](fixtures/100kb.png)


## 60 KB XML file

![](fixtures/60kb.png)


## 7 KB XML file

![](fixtures/7kb.png)

## prettyPrint()

`node benchmark/pretty-print`

`camaro` loses big time here.

```
camaro v6: 62,363.2 ops/sec
pretty-data: 141,257.8 ops/sec
prettifyXml: 258,408 ops/sec
```