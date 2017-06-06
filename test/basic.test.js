const fs = require('fs')
const test = require('tape')
const transform = require('../')

test('basic test', (t) => {
    const xml = fs.readFileSync('examples/ean.xml', 'utf-8')
    const template = {
        cache_key: '/HotelListResponse/cacheKey',
        hid_sum: 'sum(//hotelId)',
        hid_count: 'count(//hotelId)',
        hotels: ['//HotelSummary', {
            hotel_id: 'hotelId',
            hid_number: 'number(hotelId)',
            hid_ceiling: 'ceiling(highRate)',
            hid_floor: 'floor(highRate)',
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
        session_id: '/HotelListResponse/customerSessionId'
    }

    const result = transform(xml, template)
    t.equal(typeof result, 'object', 'result is expected to be object')
    t.equal(result.cache_key, '-48a4e19f:15bec159775:50eb', 'parse cache_key ok')
    t.equal(result.session_id, 'yuvb3jdpifp2t13y43pass2p', 'parse session_id ok')
    t.equal(Array.isArray(result.hotels), true, 'result.hotels is expected to be array')
    t.equal(result.hid_sum, 289664, 'sum of all hotels id should be 289,664')
    t.equal(result.hid_count, 2, 'sum of all hotels id should be 2')

    result.hotels.forEach(h => {
        t.test(`checking node [hotel_id= ${h.hotel_id}]`, function(tt) {
            tt.ok(h.hotel_id, `node [hotel_id=${h.hotel_id}] has hotel_id`)
            tt.ok(h.name, `node [hotel_id=${h.hotel_id}] has name`)
            tt.equal(typeof h.hid_number, 'number', `hid_number ${h.hid_number} should be number`)
            tt.equal(typeof h.hid_ceiling, 'number', `hid_ceiling ${h.hid_ceiling} should be number`)
            tt.equal(typeof h.hid_floor, 'number', `hid_floor ${h.hid_floor} should be number`)

            tt.end()
        })
    })

    t.end()
})

test('test invalid xml string', (t) => {
    try {
        const result = transform('', {})
    } catch(err) {
        t.equal(err instanceof TypeError, true, 'should throw TypeError invalid xml string')
    }

    t.end()
})

test('test invalid template argument', (t) => {
    try {
        const result = transform('<xml/>', null)
    } catch(err) {
        t.equal(err instanceof TypeError, true, 'should throw TypeError invalid template')
    }

    t.end()
})
