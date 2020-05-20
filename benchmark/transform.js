const fs = require('fs')
const { transform } = require('..')
const fastXmlParser = require('fast-xml-parser')
const xml2js = require('xml2js')
const xmljs = require('xml-js')

/**
 *
 * @param {object} param0
 * @param {string} param0.name name of the benchmark
 * @param {function} param0.fn function to benchmark
 * @param {number} param0.iterations number of iterations
 */
async function bench({ name = '', fn, iterations = 10000, async = false } = {}) {
    const start = process.hrtime.bigint()

    if (async) {
        let results = []
        for (let i = 0; i < iterations; i++) {
            results.push(fn())
        }
        await Promise.all(results)
    } else {
        for (let i = 0; i < iterations; i++) {
            fn()
        }
    }
    const duration = Number((process.hrtime.bigint() - start) / 1_000_000n)
    const opsPerSecond = iterations / duration * 1e3;
    console.log(`${name}: %s ops/sec`, opsPerSecond.toFixed(0))

    return {
        name,
        duration,
        opsPerSecond
    }
}

const xml = fs.readFileSync(__dirname + '/./fixtures/100kb.xml', 'utf-8')
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
