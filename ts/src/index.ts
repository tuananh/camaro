/**
 * camaro - TypeScript implementation
 *
 * Public API compatible with upstream camaro: transform(), toJson(),
 * prettyPrint() and destroy().
 */

import { parseXml, prettyPrintValue, toJsonValue } from './xml';
import { createDocumentContext } from './xpath';
import { evaluateTemplate, parseTemplate } from './template';
import { compileStreamPlan, StreamPlan, streamTransform } from './stream';

export type XmlInput = string | Uint8Array | ArrayBuffer;

type Mapped<T> = T extends readonly []
	? []
	: T extends ''
		? ''
		: T extends `boolean(${string}`
			? boolean
			: T extends `count(${string}`
				? number
				: T extends `ceiling(${string}`
					? number
					: T extends `floor(${string}`
						? number
						: T extends `number(${string}`
							? number
							: T extends `sum(${string}`
								? number
								: T extends string
									? string
									: T extends readonly [string, infer X]
										? X extends Readonly<Record<string, any>>
											? Transformed<X>[]
											: Mapped<X>[]
										: never;

export type Transformed<T extends Record<string, any>> = {
	[K in keyof T]: Mapped<T[K]>;
};

type TransformResult<T> = T extends readonly [string, any]
	? Mapped<T>
	: T extends Record<string, any>
		? Transformed<T>
		: never;

const INVALID_XML_MESSAGE =
	'1st argument (xml) must be a non-empty string, Buffer, Uint8Array, or ArrayBuffer';

function validateXml(xml: unknown): asserts xml is XmlInput {
	if (typeof xml === 'string') {
		if (xml.length === 0) throw new TypeError(INVALID_XML_MESSAGE);
		return;
	}

	if (xml instanceof ArrayBuffer) {
		if (xml.byteLength === 0) throw new TypeError(INVALID_XML_MESSAGE);
		return;
	}

	if (ArrayBuffer.isView(xml)) {
		if (xml.byteLength === 0) throw new TypeError(INVALID_XML_MESSAGE);
		return;
	}

	throw new TypeError(INVALID_XML_MESSAGE);
}

function isEmptyObject(value: object): boolean {
	return Object.entries(value).length === 0 && value.constructor === Object;
}

function validateTemplate(template: unknown): asserts template is object {
	if (!template || typeof template !== 'object' || isEmptyObject(template)) {
		throw new TypeError('2nd argument (template) must be an object');
	}
}

function xmlText(xml: XmlInput): string {
	if (typeof xml === 'string') return xml;
	if (xml instanceof ArrayBuffer) return new TextDecoder('utf-8').decode(new Uint8Array(xml));
	const view = xml as Uint8Array;
	return new TextDecoder('utf-8').decode(new Uint8Array(view.buffer, view.byteOffset, view.byteLength));
}

const templateCache = new Map<string, ReturnType<typeof parseTemplate>>();
const streamPlanCache = new WeakMap<object, StreamPlan | null>();

function compileOrCache(template: object): StreamPlan | null {
	let plan = streamPlanCache.get(template);
	if (plan !== undefined) return plan;

	const parsedTemplate = parseTemplateJson(template);
	plan = parsedTemplate ? compileStreamPlan(parsedTemplate) : null;
	streamPlanCache.set(template, plan);
	return plan;
}

function parseTemplateJson(template: object): ReturnType<typeof parseTemplate> {
	// Upstream camaro serialises the template to JSON before crossing into the
	// native module, so honour toJSON/undefined omission the same way. Parsed
	// templates are cached by that serialised form, just like the native core.
	const json = JSON.stringify(template);
	let parsed = templateCache.get(json);
	if (parsed !== undefined) return parsed;

	parsed = parseTemplate(JSON.parse(json));
	if (templateCache.size >= 256) templateCache.clear();
	templateCache.set(json, parsed);
	return parsed;
}

/**
 * Convert XML to JSON based on a template object.
 */
export async function transform<const T>(xml: XmlInput, template: T): Promise<TransformResult<T>> {
	validateXml(xml);
	validateTemplate(template);

	const streamPlan = compileOrCache(template);
	if (streamPlan) {
		const result = streamTransform(xmlText(xml), streamPlan);
		return (result === null ? {} : result) as TransformResult<T>;
	}

	const parsedTemplate = parseTemplateJson(template);
	if (!parsedTemplate) return {} as TransformResult<T>;

	const document = parseXml(xmlText(xml));
	if (!document) return {} as TransformResult<T>;

	const result = evaluateTemplate(parsedTemplate, createDocumentContext(document));
	return (result.valid ? result.value : {}) as TransformResult<T>;
}

/**
 * Convert XML to JSON.
 */
export async function toJson(xml: XmlInput): Promise<any> {
	validateXml(xml);

	const document = parseXml(xmlText(xml));
	if (!document) return {};
	return toJsonValue(document);
}

/**
 * Pretty print an XML string.
 */
export async function prettyPrint(xml: XmlInput, opts: { indentSize: number } = { indentSize: 2 }): Promise<string> {
	validateXml(xml);

	const document = parseXml(xmlText(xml));
	if (!document) return '';

	const indentSize = opts && typeof opts.indentSize === 'number' && Number.isFinite(opts.indentSize) ? opts.indentSize : 2;
	if (indentSize < 0) return '';
	return prettyPrintValue(document, Math.trunc(indentSize));
}

/**
 * Release resources. The TypeScript implementation is synchronous, so this is
 * only kept for API compatibility.
 */
export async function destroy(): Promise<void> {
	// no-op
}

export type { XmlDocument } from './xml';
