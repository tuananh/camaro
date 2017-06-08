const fs = require('fs')
const test = require('tape')
const transform = require('../')

test('basic test', (t) => {
    const xml = fs.readFileSync('examples/ean.xml', 'utf-8')
    const template = {
        cache_key: '/HotelListResponse/cacheKey',
        hotels: ['//HotelSummary', {
            hotel_id: 'hotelId',
            name: 'name',
            rooms: ['RoomRateDetailsList/RoomRateDetails', {
                rates: ['RateInfos/RateInfo', {
                    currency: 'ChargeableRateInfo/@currencyCode',
                    non_refundable: 'nonRefundable',
                    price: 'ChargeableRateInfo/@total'
                }],
                room_name: 'roomDescription',
                room_type_id: 'roomTypeCode'
            }]
        }],
        session_id: '/HotelListResponse/customerSessionId',
        path_not_exist: '/HotelListResponse/nonExistenPath',
        number_path_not_exist: 'number(/HotelListResponse/nonExistenPath)',
        round_path_not_exist: 'round(/HotelListResponse/nonExistenPath)',
        number_path_exist: 'number(/HotelListResponse/numberOfRoomsRequested)',
        number_path_exist_but_invalid: 'number(/HotelListResponse/customerSessionId)'
    }

    const result = transform(xml, template)
    t.equal(typeof result, 'object', 'result is expected to be object')
    t.equal(result.cache_key, '-48a4e19f:15bec159775:50eb', 'parse cache_key ok')
    t.equal(result.session_id, 'yuvb3jdpifp2t13y43pass2p', 'parse session_id ok')
    t.equal(Array.isArray(result.hotels), true, 'result.hotels is expected to be array')
    t.equal(result.path_not_exist, "", 'path_not_exist should be empty string')
    t.equal(result.number_path_not_exist, null, 'number_path_not_exist should be null')
    t.equal(result.round_path_not_exist, null, 'round_path_not_exist should be null')
    t.equal(result.number_path_exist, 1, 'number_path_exist should be 1')
    t.equal(result.number_path_exist_but_invalid, null, 'number_path_exist_but_invalid should be null')

    result.hotels.forEach(h => {
        t.test(`checking node [hotel_id= ${h.hotel_id}]`, function(tt) {
            tt.ok(h.hotel_id, `node [hotel_id=${h.hotel_id}] has hotel_id`)
            tt.ok(h.name, `node [hotel_id=${h.hotel_id}] has name`)

            tt.end()
        })
    })

    t.end()
})