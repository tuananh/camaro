'use strict';

const fs = require('fs');
const camaro = require('..');
const camaroTs = require('../ts');
const { prettyPrint } = camaro;
const { prettyPrint: prettyPrintTs } = camaroTs;

const prettyData = require('pretty-data');
const prettifyXml = require('prettify-xml');

const xml = fs.readFileSync(__dirname + '/../examples/simple.xml', 'utf-8');

(async () => {
	const { run, bench, summary } = await import('mitata');

	summary(() => {
		bench('camaro v6', () => prettyPrint(xml));
		bench('camaro v6 (ts)', () => prettyPrintTs(xml));
		bench('pretty-data', () => prettyData.pd.xml(xml));
		bench('prettifyXml', () => prettifyXml(xml));
	});

	await run();
})().catch((err) => {
	console.error(err);
	process.exitCode = 1;
});
