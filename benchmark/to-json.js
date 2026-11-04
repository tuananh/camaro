'use strict';

const fs = require('fs');
const camaro = require('..');
const camaroTs = require('../ts');
const { XMLParser } = require('fast-xml-parser');
const xml2js = require('xml2js');
const xmljs = require('xml-js');
const txml = require('txml');

const { toJson, destroy } = camaro;
const { toJson: toJsonTs } = camaroTs;

const fastXmlParser = new XMLParser();
const xml2jsParser = new xml2js.Parser();

const xml = fs.readFileSync(`${__dirname}/fixtures/60kb.xml`, 'utf-8');

(async () => {
	const { run, bench, summary } = await import('mitata');

	summary(() => {
		bench('camaro v6 toJson', function* () {
			yield async () => await toJson(xml);
		});

		bench('camaro v6 toJson (ts)', function* () {
			yield async () => await toJsonTs(xml);
		});

		bench('txml', () => {
			txml.parse(xml);
		});

		bench('fast-xml-parser', () => {
			fastXmlParser.parse(xml);
		});

		bench('xml2js', function* () {
			yield async () => await xml2jsParser.parseStringPromise(xml);
		});

		bench('xml-js', () => {
			xmljs.xml2js(xml);
		});
	});

	await run();
	await destroy();
})().catch((err) => {
	console.error(err);
	process.exitCode = 1;
});
