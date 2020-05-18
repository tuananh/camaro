const fs = require('fs')
const { transform, pool } = require('..')
const fastXmlParser = require('fast-xml-parser')
const xml2js = require('xml2js')
const xmljs = require('xml-js')

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
    console.log(`${name}: %s ops/sec`, opsPerSecond)

    return {
        name,
        duration,
        opsPerSecond
    }
}

const xml = fs.readFileSync(__dirname + '/../examples/ean.xml', 'utf-8')
const template = {
    cache_key: '/HotelListResponse/cacheKey',
    hotels: [
        '//HotelSummary',
        {
            hotel_id: 'hotelId',
            name: 'name',
            rooms: [
                'RoomRateDetailsList/RoomRateDetails',
                {
                    rates: [
                        'RateInfos/RateInfo',
                        {
                            currency: 'ChargeableRateInfo/@currencyCode',
                            non_refundable: 'boolean(nonRefundable = "true")',
                            price: 'number(ChargeableRateInfo/@total)',
                        },
                    ],
                    room_name: 'roomDescription',
                    room_type_id: 'roomTypeCode',
                },
            ],
        },
    ],
    session_id: '/HotelListResponse/customerSessionId',
}

async function runBenchmarks() {
    await bench({
        name: 'camaro v6',
        fn: () => transform(xml, template),
        async: true,
    })

    await bench({name: 'fast-xml-parser', fn: () => fastXmlParser.parse(xml)})

    await bench({name: 'xml2js', fn: () => xml2js.parseString(xml) })

    await bench({name: 'xml-js', fn: () => xmljs.xml2js(xml) })

}

runBenchmarks()
