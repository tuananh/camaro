'use strict'

const fs = require('fs')
const { transform } = require('..')
const { XMLParser } = require('fast-xml-parser')
const xml2js = require('xml2js')
const xmljs = require('xml-js')
const txml = require('txml')

const fastXmlParser = new XMLParser()
const xml2jsParser = new xml2js.Parser()

const xml = fs.readFileSync(__dirname + '/./fixtures/60kb.xml', 'utf-8')
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

;(async () => {
  const { run, bench, summary } = await import('mitata')

  summary(() => {
    bench('camaro v6', function* () {
      yield async () => await transform(xml, template)
    })

    bench('txml', () => {
      txml.parse(xml)
    })

    bench('fast-xml-parser', () => {
      fastXmlParser.parse(xml)
    })

    bench('xml2js', function* () {
      yield async () => await xml2jsParser.parseStringPromise(xml)
    })

    bench('xml-js', () => {
      xmljs.xml2js(xml)
    })
  })

  await run()
})().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
