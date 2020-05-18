const fs = require('fs')
const { prettyPrint, pool } = require('..')
const prettyData = require('pretty-data')
const prettifyXml = require('prettify-xml')

/**
 *
 * @param {object} param0
 * @param {string} param0.name name of the benchmark
 * @param {function} param0.fn function to benchmark
 * @param {number} param0.duration duration in millisecond
 */
async function bench({ name = '', fn, duration = 5000, async = false } = {}) {
    const start = process.hrtime.bigint()
    let done = 0

    if (async) {
        let results = []

        // TODO(anh): I'm exposing pool for benchmarking purpose
        // should remove this. There's no reason user should know about internal implementation
        while (pool.queueSize === 0) {
            results.push(scheduleTasks())
        }

        async function scheduleTasks() {
            while ((process.hrtime.bigint() - start) / 1_000_000n < duration) {
                await fn()
                done++
            }
        }

        await Promise.all(results)
    } else {
        while ((process.hrtime.bigint() - start) / 1_000_000n < duration) {
            fn()
            done++
        }
    }

    const opsPerSecond = done / duration * 1e3;
    console.log(`${name}: %s ops/sec`, opsPerSecond.toLocaleString())

    return {
        name,
        duration,
        opsPerSecond
    }
}

const xml = fs.readFileSync(__dirname + '/../examples/simple.xml', 'utf-8')

async function runBenchmarks() {
    await bench({
        name: 'camaro v6',
        fn: () => prettyPrint(xml),
        async: true,
    })

    await bench({name: 'pretty-data', fn: () => prettyData.pd.xml(xml) })

    await bench({name: 'prettifyXml', fn: () => prettifyXml(xml) })

}

runBenchmarks()
