const fs = require('fs')
const { transform } = require('../')

;(async function main() {
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
        promises.push(transform(xml, template))
    }

    await Promise.all(promises)
    const end = process.hrtime(start)
    const durationMs = (end[0] + end[1] / 1e9) * 1000
    console.log('camaro (v6): finished %s iterations in %s ms', ITERATIONS, durationMs)
    console.log('camaro (v6): %s ops/sec', ITERATIONS / durationMs * 1000)
})()
