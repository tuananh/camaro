'use strict'

const fs = require('fs')
const path = require('path')
const { transform, destroy } = require('..')

const fixtureName = process.env.CAMARO_BENCH_FIXTURE || '60kb.xml'
const iterations = Math.max(1, Number(process.env.CAMARO_BENCH_ITERATIONS || 500))
const warmup = Math.max(0, Number(process.env.CAMARO_BENCH_WARMUP || 3))

const xmlPath = path.join(__dirname, 'fixtures', fixtureName)
const xml = fs.readFileSync(xmlPath, 'utf8')

/** Same shape as benchmark/transform.js — exercises XPath + nested arrays */
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

async function main() {
  for (let i = 0; i < warmup; i++) {
    await transform(xml, template)
  }

  const t0 = process.hrtime.bigint()
  for (let i = 0; i < iterations; i++) {
    await transform(xml, template)
  }
  const elapsedMs = Number(process.hrtime.bigint() - t0) / 1e6

  const opsPerSec = iterations / (elapsedMs / 1000)
  console.log('camaro transform only')
  console.log(`  fixture: ${fixtureName} (${xml.length} bytes)`)
  console.log(`  iterations: ${iterations} (serial await, after ${warmup} warmup)`)
  console.log(`  total: ${elapsedMs.toFixed(1)} ms`)
  console.log(`  mean: ${(elapsedMs / iterations).toFixed(3)} ms/op`)
  console.log(`  ops/sec: ${opsPerSec.toFixed(0)}`)

  await destroy()
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
