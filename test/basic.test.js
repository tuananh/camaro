const fs = require('fs')
const t = require('tape')
const transform = require('../')

t.test('basic test', (t) => {
    const xml = fs.readFileSync('examples/ean.xml', 'utf-8')
    const template = {
        cache_key: '/HotelListResponse/cacheKey',
        hotels: ['//HotelSummary', {
            hotel_id: 'hotelId',
            name: 'name',
            rooms: ['RoomRateDetailsList/RoomRateDetails', {
                rates: ['RateInfos/RateInfo', {
                    currency: 'ChargeableRateInfo/@currencyCode',
                    non_refundable: 'boolean(nonRefundable = "true")',
                    price: 'number(ChargeableRateInfo/@total)'
                }],
                room_name: 'roomDescription',
                room_type_id: 'roomTypeCode'
            }]
        }],
        session_id: '/HotelListResponse/customerSessionId',
        path_not_exist: '/HotelListResponse/nonExistenPath',
        empty_array: []
    }

    const result = transform(xml, template)
    t.equal(typeof result, 'object', 'result is expected to be object')
    t.equal(result.cache_key, '-48a4e19f:15bec159775:50eb', 'parse cache_key ok')
    t.equal(result.session_id, 'yuvb3jdpifp2t13y43pass2p', 'parse session_id ok')
    t.equal(Array.isArray(result.hotels), true, 'result.hotels is expected to be array')
    t.equal(result.path_not_exist, '', 'path_not_exist should be empty string')
    t.ok(result.empty_array && Array.isArray(result.empty_array), 'empty_array should be an empty array')

    result.hotels.forEach(h => {
        t.test(`checking node [hotel_id= ${h.hotel_id}]`, function(tt) {
            tt.ok(h.hotel_id, `node [hotel_id=${h.hotel_id}] has hotel_id`)
            tt.ok(h.name, `node [hotel_id=${h.hotel_id}] has name`)
            tt.ok(Array.isArray(h.rooms), `node [hotel_id=${h.hotel_id}] has rooms array`)
            h.rooms.forEach(room => {
                tt.ok(room.room_name, 'room_name is there')
                tt.ok(room.room_type_id, 'room_type_id is there')
            })
            tt.end()
        })
    })

    t.end()
})