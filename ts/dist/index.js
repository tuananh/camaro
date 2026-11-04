"use strict";
/**
 * camaro - TypeScript implementation
 *
 * Public API compatible with upstream camaro: transform(), toJson(),
 * prettyPrint() and destroy().
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.transform = transform;
exports.toJson = toJson;
exports.prettyPrint = prettyPrint;
exports.destroy = destroy;
const xml_1 = require("./xml");
const xpath_1 = require("./xpath");
const template_1 = require("./template");
const INVALID_XML_MESSAGE = '1st argument (xml) must be a non-empty string, Buffer, Uint8Array, or ArrayBuffer';
function validateXml(xml) {
    if (typeof xml === 'string') {
        if (xml.length === 0)
            throw new TypeError(INVALID_XML_MESSAGE);
        return;
    }
    if (xml instanceof ArrayBuffer) {
        if (xml.byteLength === 0)
            throw new TypeError(INVALID_XML_MESSAGE);
        return;
    }
    if (ArrayBuffer.isView(xml)) {
        if (xml.byteLength === 0)
            throw new TypeError(INVALID_XML_MESSAGE);
        return;
    }
    throw new TypeError(INVALID_XML_MESSAGE);
}
function isEmptyObject(value) {
    return Object.entries(value).length === 0 && value.constructor === Object;
}
function validateTemplate(template) {
    if (!template || typeof template !== 'object' || isEmptyObject(template)) {
        throw new TypeError('2nd argument (template) must be an object');
    }
}
function xmlText(xml) {
    if (typeof xml === 'string')
        return xml;
    if (xml instanceof ArrayBuffer)
        return new TextDecoder('utf-8').decode(new Uint8Array(xml));
    const view = xml;
    return new TextDecoder('utf-8').decode(new Uint8Array(view.buffer, view.byteOffset, view.byteLength));
}
const templateCache = new Map();
function parseTemplateJson(template) {
    // Upstream camaro serialises the template to JSON before crossing into the
    // native module, so honour toJSON/undefined omission the same way. Parsed
    // templates are cached by that serialised form, just like the native core.
    const json = JSON.stringify(template);
    let parsed = templateCache.get(json);
    if (parsed !== undefined)
        return parsed;
    parsed = (0, template_1.parseTemplate)(JSON.parse(json));
    if (templateCache.size >= 256)
        templateCache.clear();
    templateCache.set(json, parsed);
    return parsed;
}
/**
 * Convert XML to JSON based on a template object.
 */
async function transform(xml, template) {
    validateXml(xml);
    validateTemplate(template);
    const parsedTemplate = parseTemplateJson(template);
    if (!parsedTemplate)
        return {};
    const document = (0, xml_1.parseXml)(xmlText(xml));
    if (!document)
        return {};
    const result = (0, template_1.evaluateTemplate)(parsedTemplate, (0, xpath_1.createDocumentContext)(document));
    return (result.valid ? result.value : {});
}
/**
 * Convert XML to JSON.
 */
async function toJson(xml) {
    validateXml(xml);
    const document = (0, xml_1.parseXml)(xmlText(xml));
    if (!document)
        return {};
    return (0, xml_1.toJsonValue)(document);
}
/**
 * Pretty print an XML string.
 */
async function prettyPrint(xml, opts = { indentSize: 2 }) {
    validateXml(xml);
    const document = (0, xml_1.parseXml)(xmlText(xml));
    if (!document)
        return '';
    const indentSize = opts && typeof opts.indentSize === 'number' && Number.isFinite(opts.indentSize) ? opts.indentSize : 2;
    if (indentSize < 0)
        return '';
    return (0, xml_1.prettyPrintValue)(document, Math.trunc(indentSize));
}
/**
 * Release resources. The TypeScript implementation is synchronous, so this is
 * only kept for API compatibility.
 */
async function destroy() {
    // no-op
}
