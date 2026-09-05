'use strict';

const fs = require('fs');
const path = require('path');
const { transform, destroy } = require('..');

// CAMARO_BENCH_FIXTURE / CAMARO_BENCH_WARMUP still apply. Sampling is driven by mitata (CAMARO_BENCH_ITERATIONS is unused).
const fixtureName = process.env.CAMARO_BENCH_FIXTURE || '60kb.xml';
const warmup = Math.max(0, Number(process.env.CAMARO_BENCH_WARMUP || 3));

const xmlPath = path.join(__dirname, 'fixtures', fixtureName);
const xml = fs.readFileSync(xmlPath, 'utf8');

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
};

(async () => {
	const { run, bench } = await import('mitata');

	for (let i = 0; i < warmup; i++) {
		await transform(xml, template);
	}

	bench(`baseline (${fixtureName}, ${xml.length} bytes, ${warmup} warmup)`, function* () {
		yield async () => await transform(xml, template);
	});

	await run();
	await destroy();
})().catch((err) => {
	console.error(err);
	process.exitCode = 1;
});
