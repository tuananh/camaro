const benchmark = require('benchmark')
const fs = require('fs')
const camaro = require('../')
const x2j = require('rapidx2j')
const xml2json = require('xml2json')
const xml2js = require('xml2js').parseString
const fastXmlParser = require('fast-xml-parser')

const suite = new benchmark.Suite()
const xml = fs.readFileSync('examples/ean.xml', 'utf-8')

suite.add('camaro', function() {
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
    camaro(xml, template)
})

suite.add('rapidx2j', function() {
    x2j.parse(xml)
})

suite.add('xml2json', function() {
    xml2json.toJson(xml)
})

suite.add('xml2js', function() {
    xml2js(xml, () => {})
})

suite.add('fast-xml-parser', function() {
    fastXmlParser.parse(xml)
})

suite.on('cycle', cycle)
suite.run()

function cycle(e) {
    console.log(e.target.toString())
}
