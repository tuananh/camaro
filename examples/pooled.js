const fs = require('fs')
const path = require('path')
const Pool = require('piscina')

;(async function main() {
    const workerPool = new Pool({
        filename: path.resolve(__dirname, 'worker.js'),
    })

    const xml = fs.readFileSync(__dirname + '/ean.xml', 'utf-8')

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
                                non_refundable:
                                    'boolean(nonRefundable = "true")',
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
    const start = process.hrtime()
    const ITERATIONS = 10000
    let promises = []
    for (let i = 0; i < ITERATIONS; i++) {
        promises.push(workerPool.runTask({ xml, template }))
    }

    await Promise.all(promises)
    const end = process.hrtime(start)
    const durationMs = (end[0] + end[1] / 1e9) * 1000
    console.log('camaro (pooled): finished %s iterations in %s ms', ITERATIONS, durationMs)
    console.log('camaro (pooled): %s ops/sec', ITERATIONS / durationMs * 1000)
})()
