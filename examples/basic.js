const transform = require('../')
const fs = require('fs')

const xml = fs.readFileSync(__dirname + '/ean6mb.xml', 'utf-8')
const template = {
    cache_key: "/HotelListResponse/cacheKey",
    hotels: ["//HotelSummary", {
        hotel_id: "hotelId",
        name: "name",
        rooms: ["RoomRateDetailsList/RoomRateDetails", {
            rates: ["RateInfos/RateInfo", {
                currency: "ChargeableRateInfo/@currencyCode",
                non_refundable: "nonRefundable",
                price: "ChargeableRateInfo/@total"
            }],
            room_name: "roomDescription",
            room_type_id: "roomTypeCode"
        }]
    }],
    session_id: "/HotelListResponse/customerSessionId"
}

console.time('parse')
const result = transform(xml, template)
// console.log(JSON.stringify(result, null, 4))
console.timeEnd('parse')