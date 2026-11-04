/**
 * Template-aware streaming transform.
 *
 * When a template only uses the fast paths that the native camaro core
 * implements directly (simple child/descendant navigation, attributes,
 * `number(simplePath)`, `boolean(name = "literal")`, constants and empty
 * strings), the XML can be transformed in a single pass without building a
 * DOM. Templates using general XPath, predicates, or custom functions fall
 * back to the DOM-based evaluator.
 */

import {
	decodeEntities,
	ParseState,
	readName,
	skipDeclaration,
	skipWhitespace,
	XML_WHITESPACE,
} from './xml';
import { asDouble, isSimpleNavPath, parseNavPath, TemplateNode } from './template';

export type StreamPath = { kind: 'nav'; segments: string[] } | { kind: 'descendant'; name: string };

export type StreamScalar =
	| { kind: 'const'; value: string }
	| { kind: 'empty' }
	| { kind: 'path'; valueKind: 'string' | 'number'; segments: string[]; attribute: string | null }
	| { kind: 'boolean'; left: string; right: string };

export type StreamObject = { kind: 'object'; members: { key: string; plan: StreamValue }[] };
export type StreamArray = { kind: 'array'; path: StreamPath | null; item: StreamItem | null };
export type StreamItem = StreamObject | StreamScalar;
export type StreamValue = StreamObject | StreamArray | StreamScalar;
export type StreamPlan = StreamObject | StreamArray;

interface Attr {
	name: string;
	value: string;
}

type Slot = { output: Record<string, any>; key: string } | { array: any[]; index: number };

interface PendingCapture {
	slot: Slot;
	segments: string[];
	attribute: string | null;
	valueKind: 'string' | 'number' | 'boolean';
	booleanRight?: string;
	targetSeen: boolean;
	textCaptured: boolean;
}

interface ActiveArray {
	path: StreamPath | null;
	item: StreamItem | null;
	output: any[];
}

type Frame =
	| {
			kind: 'object';
			depth: number;
			output: Record<string, any>;
			capturesByRel: Record<number, PendingCapture[]>;
			navArraysByRel: Record<number, ActiveArray[]>;
			descendantArrays: ActiveArray[];
	  }
	| { kind: 'array'; depth: number; output: any[]; path: StreamPath | null; item: StreamItem | null };

function writeSlot(slot: Slot, value: any): void {
	if ('key' in slot) slot.output[slot.key] = value;
	else slot.array[slot.index] = value;
}

function findAttr(attributes: Attr[] | null, name: string): string | null {
	if (!attributes) return null;
	for (const attribute of attributes) {
		if (attribute.name === name) return attribute.value;
	}
	return null;
}

function trimWs(value: string): string {
	let start = 0;
	let end = value.length;
	while (start < end && (value.charCodeAt(start) === 0x20 || value.charCodeAt(start) === 0x09)) start++;
	while (end > start && (value.charCodeAt(end - 1) === 0x20 || value.charCodeAt(end - 1) === 0x09)) end--;
	return value.slice(start, end);
}

/* -------------------------------------------------------------------------- */
/* Compiler                                                                   */
/* -------------------------------------------------------------------------- */

export function compileStreamPlan(template: TemplateNode): StreamPlan | null {
	if (template.kind === 'object') {
		const members: { key: string; plan: StreamValue }[] = [];
		for (const member of template.members) {
			const plan = compileStreamValue(member.value, true);
			if (!plan) return null;
			members.push({ key: member.key, plan });
		}
		return { kind: 'object', members };
	}

	if (template.kind === 'array') {
		if (template.items.length === 0) return { kind: 'array', path: null, item: null };
		if (template.items.length !== 2) return null;
		const pathNode = template.items[0];
		const inner = template.items[1];
		if (pathNode.kind !== 'string') return null;
		const path = compileArrayPath(pathNode.value, true);
		if (!path) return null;
		const item = compileStreamItem(inner);
		if (!item) return null;
		return { kind: 'array', path, item };
	}

	return null;
}

function compileStreamValue(template: TemplateNode, contextIsDocument: boolean): StreamValue | null {
	if (template.kind === 'object') {
		const members: { key: string; plan: StreamValue }[] = [];
		for (const member of template.members) {
			const plan = compileStreamValue(member.value, contextIsDocument);
			if (!plan) return null;
			members.push({ key: member.key, plan });
		}
		return { kind: 'object', members };
	}

	if (template.kind === 'array') {
		if (template.items.length === 0) return { kind: 'array', path: null, item: null };
		if (template.items.length !== 2) return null;
		const pathNode = template.items[0];
		const inner = template.items[1];
		if (pathNode.kind !== 'string') return null;
		const path = compileArrayPath(pathNode.value, contextIsDocument);
		if (!path) return null;
		const item = compileStreamItem(inner);
		if (!item) return null;
		return { kind: 'array', path, item };
	}

	if (template.kind === 'string') return compileStreamScalar(template.value);
	return null;
}

function compileStreamItem(template: TemplateNode): StreamItem | null {
	if (template.kind === 'object') {
		const members: { key: string; plan: StreamValue }[] = [];
		for (const member of template.members) {
			const plan = compileStreamValue(member.value, false);
			if (!plan) return null;
			members.push({ key: member.key, plan });
		}
		return { kind: 'object', members };
	}
	if (template.kind === 'string') return compileStreamScalar(template.value);
	return null;
}

function compileArrayPath(value: string, contextIsDocument: boolean): StreamPath | null {
	if (isSimpleNavPath(value)) {
		const nav = parseNavPath(value);
		if (nav && nav.attribute === null && nav.segments.length > 0) {
			return { kind: 'nav', segments: nav.segments };
		}
		return null;
	}

	if (value.length >= 3 && value.startsWith('//') && value.indexOf('/', 2) === -1) {
		const name = value.slice(2);
		// A `//name` path is streamed only from the document context; nested
		// uses fall back to the DOM evaluator (which is also the C++ fast path
		// boundary in practice).
		if (contextIsDocument && /^[A-Za-z0-9_@-]+$/.test(name)) {
			return { kind: 'descendant', name };
		}
	}

	return null;
}

function compileStreamScalar(value: string): StreamScalar | null {
	if (value.length === 0) return { kind: 'empty' };
	if (value[0] === '#') return { kind: 'const', value: value.slice(1) };

	if (value.startsWith('number(') && value.length >= 9 && value.endsWith(')')) {
		const inner = value.slice(7, -1);
		if (isSimpleNavPath(inner)) {
			const nav = parseNavPath(inner);
			if (nav && (nav.segments.length > 0 || nav.attribute !== null)) {
				return { kind: 'path', valueKind: 'number', segments: nav.segments, attribute: nav.attribute };
			}
		}
		return null;
	}

	if (value.startsWith('boolean(') && value.length >= 10 && value.endsWith(')')) {
		const inner = value.slice(8, -1);
		const equal = inner.indexOf('=');
		if (equal !== -1) {
			const left = trimWs(inner.slice(0, equal));
			let right = trimWs(inner.slice(equal + 1));
			if (left.indexOf('(') === -1 && left.indexOf('/') === -1 && left.indexOf('@') === -1) {
				if (right.length >= 2 && ((right[0] === '"' && right[right.length - 1] === '"') || (right[0] === "'" && right[right.length - 1] === "'"))) {
					right = right.slice(1, -1);
				}
				return { kind: 'boolean', left, right };
			}
		}
		return null;
	}

	if (isSimpleNavPath(value)) {
		const nav = parseNavPath(value);
		if (nav && (nav.segments.length > 0 || nav.attribute !== null)) {
			return { kind: 'path', valueKind: 'string', segments: nav.segments, attribute: nav.attribute };
		}
	}

	return null;
}

/* -------------------------------------------------------------------------- */
/* Streaming evaluator                                                        */
/* -------------------------------------------------------------------------- */

export function streamTransform(source: string, plan: StreamPlan): unknown {
	if (source.charCodeAt(0) === 0xfeff) source = source.slice(1);

	const state: ParseState = { source, position: 0, order: 0 };
	const length = source.length;
	const elementStack: string[] = [];
	const textCaptures = new Map<number, PendingCapture[]>();
	const frames: Frame[] = [];

	let sawRootElement = false;

	const skipWs = (): boolean => {
		const before = state.position;
		skipWhitespace(state);
		return state.position > before;
	};

	const registerTextCapture = (depth: number, capture: PendingCapture): void => {
		let list = textCaptures.get(depth);
		if (!list) {
			list = [];
			textCaptures.set(depth, list);
		}
		list.push(capture);
	};

	const pushToMap = <T,>(map: Record<number, T[]>, key: number, value: T): void => {
		const list = map[key];
		if (list) list.push(value);
		else map[key] = [value];
	};

	const matchesSegments = (segments: string[], contextDepth: number, depth: number, name: string): boolean => {
		if (segments.length !== depth - contextDepth) return false;
		if (name !== segments[segments.length - 1]) return false;
		for (let index = 0; index < segments.length - 1; index++) {
			if (elementStack[contextDepth + index] !== segments[index]) return false;
		}
		return true;
	};

	const addScalar = (
		slot: Slot,
		scalar: StreamScalar,
		contextDepth: number,
		attributes: Attr[] | null,
		frame: Extract<Frame, { kind: 'object' }>
	): void => {
		if (scalar.kind === 'const') {
			writeSlot(slot, scalar.value);
			return;
		}
		if (scalar.kind === 'empty') {
			writeSlot(slot, '');
			return;
		}
		if (scalar.kind === 'path') {
			if (scalar.segments.length === 0) {
				const found = scalar.attribute !== null ? findAttr(attributes, scalar.attribute) : null;
				writeSlot(slot, scalar.valueKind === 'number' ? (found === null ? Number.NaN : asDouble(found)) : found === null ? '' : found);
				return;
			}
			writeSlot(slot, scalar.valueKind === 'number' ? Number.NaN : '');
			pushToMap(frame.capturesByRel, scalar.segments.length, {
				slot,
				segments: scalar.segments,
				attribute: scalar.attribute,
				valueKind: scalar.valueKind,
				targetSeen: false,
				textCaptured: false,
			});
			return;
		}
		// boolean
		writeSlot(slot, false);
		pushToMap(frame.capturesByRel, 1, {
			slot,
			segments: [scalar.left],
			attribute: null,
			valueKind: 'boolean',
			booleanRight: scalar.right,
			targetSeen: false,
			textCaptured: false,
		});
	};

	const expandObject = (
		plan: StreamObject,
		contextDepth: number,
		attributes: Attr[] | null,
		output: Record<string, any>,
		frame: Extract<Frame, { kind: 'object' }>
	): void => {
		for (const member of plan.members) {
			const value = member.plan;
			if (value.kind === 'object') {
				const nested: Record<string, any> = {};
				output[member.key] = nested;
				expandObject(value, contextDepth, attributes, nested, frame);
			} else if (value.kind === 'array') {
				const arrayOutput: any[] = [];
				output[member.key] = arrayOutput;
				if (value.path !== null) {
					const active: ActiveArray = { path: value.path, item: value.item, output: arrayOutput };
					if (value.path.kind === 'descendant') frame.descendantArrays.push(active);
					else pushToMap(frame.navArraysByRel, value.path.segments.length, active);
				}
			} else {
				addScalar({ output, key: member.key }, value, contextDepth, attributes, frame);
			}
		}
	};

	const createArrayItem = (array: ActiveArray, depth: number, attributes: Attr[]): void => {
		const item = array.item;
		if (!item) return;

		if (item.kind === 'object') {
			const output: Record<string, any> = {};
			array.output.push(output);
			const frame: Frame = { kind: 'object', depth, output, capturesByRel: {}, navArraysByRel: {}, descendantArrays: [] };
			expandObject(item, depth, attributes, output, frame);
			frames.push(frame);
		} else {
			const index = array.output.length;
			array.output.push(undefined);
			const frame: Frame = { kind: 'object', depth, output: {} as any, capturesByRel: {}, navArraysByRel: {}, descendantArrays: [] };
			addScalar({ array: array.output, index }, item, depth, attributes, frame);
			frames.push(frame);
		}
	};

	const assignCaptureText = (capture: PendingCapture, value: string): void => {
		if (capture.valueKind === 'string') writeSlot(capture.slot, value);
		else if (capture.valueKind === 'number') writeSlot(capture.slot, asDouble(value));
		else writeSlot(capture.slot, value === capture.booleanRight);
	};

	const processOpenElement = (depth: number, name: string, attributes: Attr[]): void => {
		const frameCount = frames.length;
		const matches: ActiveArray[] = [];

		for (let index = frameCount - 1; index >= 0; index--) {
			const frame = frames[index];

			if (frame.kind === 'array') {
				if (frame.path !== null) {
					if (frame.path.kind === 'descendant') {
						if (name === frame.path.name && depth > frame.depth) {
							matches.push({ path: frame.path, item: frame.item, output: frame.output });
						}
					} else if (frame.path.segments.length === depth - frame.depth) {
						if (matchesSegments(frame.path.segments, frame.depth, depth, name)) {
							matches.push({ path: frame.path, item: frame.item, output: frame.output });
						}
					}
				}
				continue;
			}

			const rel = depth - frame.depth;

			const captures = frame.capturesByRel[rel];
			if (captures) {
				for (const capture of captures) {
					if (capture.targetSeen) continue;
					if (!matchesSegments(capture.segments, frame.depth, depth, name)) continue;
					capture.targetSeen = true;

					if (capture.attribute !== null) {
						const found = findAttr(attributes, capture.attribute);
						writeSlot(
							capture.slot,
							capture.valueKind === 'number' ? (found === null ? Number.NaN : asDouble(found)) : found === null ? '' : found
						);
					} else {
						if (capture.valueKind === 'number') writeSlot(capture.slot, 0);
						else if (capture.valueKind === 'boolean') writeSlot(capture.slot, capture.booleanRight === '');
						registerTextCapture(depth, capture);
					}
				}
			}

			const navArrays = frame.navArraysByRel[rel];
			if (navArrays) {
				for (const array of navArrays) {
					if (matchesSegments((array.path as { kind: 'nav'; segments: string[] }).segments, frame.depth, depth, name)) {
						matches.push(array);
					}
				}
			}

			for (const array of frame.descendantArrays) {
				if (name === (array.path as { kind: 'descendant'; name: string }).name && depth > frame.depth) {
					matches.push(array);
				}
			}
		}

		for (const array of matches) createArrayItem(array, depth, attributes);
	};

	const closeElement = (depth: number): void => {
		textCaptures.delete(depth);
		while (frames.length > 1 && frames[frames.length - 1].depth === depth) {
			frames.pop();
		}
		elementStack.pop();
	};

	const parseOpenTag = (): { name: string; attributes: Attr[]; selfClosing: boolean } | null => {
		state.position++; // skip '<'
		const name = readName(state);
		if (name === null) return null;

		const src = state.source;
		const attributes: Attr[] = [];

		while (state.position < length) {
			const hadWhitespace = skipWs();
			if (state.position >= length) return null;

			const char = src.charCodeAt(state.position);
			if (char === 0x3e) {
				state.position++;
				return { name, attributes, selfClosing: false };
			}
			if (char === 0x2f) {
				if (src.charCodeAt(state.position + 1) !== 0x3e) return null;
				state.position += 2;
				return { name, attributes, selfClosing: true };
			}
			if (!hadWhitespace) return null;

			const attributeName = readName(state);
			if (attributeName === null) return null;
			skipWhitespace(state);
			if (src.charCodeAt(state.position) !== 0x3d) return null;
			state.position++;
			skipWhitespace(state);

			const quoteCode = src.charCodeAt(state.position);
			if (quoteCode !== 0x22 && quoteCode !== 0x27) return null;
			const quote = quoteCode === 0x22 ? '"' : "'";

			const valueStart = state.position + 1;
			const valueEnd = src.indexOf(quote, valueStart);
			if (valueEnd === -1) return null;
			const rawValue = src.slice(valueStart, valueEnd);
			if (rawValue.indexOf('<') !== -1) return null;
			state.position = valueEnd + 1;
			attributes.push({ name: attributeName, value: rawValue.indexOf('&') === -1 ? rawValue : decodeEntities(rawValue) });
		}

		return null;
	};

	// Root frame.
	if (plan.kind === 'object') {
		const frame: Frame = { kind: 'object', depth: 0, output: {}, capturesByRel: {}, navArraysByRel: {}, descendantArrays: [] };
		expandObject(plan, 0, null, frame.output, frame);
		frames.push(frame);
	} else {
		frames.push({ kind: 'array', depth: 0, output: [], path: plan.path, item: plan.item });
	}

	while (state.position < length) {
		const position = state.position;

		if (source.charCodeAt(position) !== 0x3c /* < */) {
			const nextTag = source.indexOf('<', position);
			const end = nextTag === -1 ? length : nextTag;
			const depth = elementStack.length;
			const captures = textCaptures.get(depth);

			if (captures && captures.length > 0) {
				let hasText = false;
				for (let index = position; index < end; index++) {
					const code = source.charCodeAt(index);
					if (code >= 128 || XML_WHITESPACE[code] === 0) {
						hasText = true;
						break;
					}
				}
				if (hasText) {
					const raw = source.slice(position, end);
					const value = raw.indexOf('&') === -1 ? raw : decodeEntities(raw);
					if (value.length > 0) {
						for (const capture of captures) {
							if (capture.textCaptured) continue;
							capture.textCaptured = true;
							assignCaptureText(capture, value);
						}
					}
				}
			}

			state.position = end;
			continue;
		}

		const next = source.charCodeAt(position + 1);

		if (next === 0x3f) {
			state.position = position + 2;
			const end = source.indexOf('?>', state.position);
			if (end === -1) return null;
			state.position = end + 2;
			continue;
		}

		if (next === 0x2f) {
			const current = elementStack[elementStack.length - 1];
			const closeStart = position + 2;
			const closeEnd = source.indexOf('>', closeStart);
			if (closeEnd === -1) return null;

			if (elementStack.length > 0 && closeEnd - closeStart === current.length && source.indexOf(current, closeStart) === closeStart) {
				state.position = closeEnd + 1;
				closeElement(elementStack.length);
				continue;
			}

			state.position = closeStart;
			const name = readName(state);
			skipWhitespace(state);
			if (name === null || source.charCodeAt(state.position) !== 0x3e) return null;
			state.position++;
			if (elementStack.length === 0 || current !== name) return null;
			closeElement(elementStack.length);
			continue;
		}

		if (next === 0x21) {
			if (source.charCodeAt(position + 2) === 0x2d && source.charCodeAt(position + 3) === 0x2d) {
				state.position = position + 4;
				const end = source.indexOf('-->', state.position);
				if (end === -1) return null;
				state.position = end + 3;
				continue;
			}

			if (source.startsWith('<![CDATA[', position)) {
				state.position = position + 9;
				const end = source.indexOf(']]>', state.position);
				if (end === -1) return null;
				const value = source.slice(state.position, end);
				state.position = end + 3;

				const depth = elementStack.length;
				const captures = textCaptures.get(depth);
				if (captures) {
					for (const capture of captures) {
						if (capture.textCaptured) continue;
						capture.textCaptured = true;
						assignCaptureText(capture, value);
					}
				}
				continue;
			}

			state.position = position + 2;
			if (!skipDeclaration(state)) return null;
			continue;
		}

		state.position = position;
		const element = parseOpenTag();
		if (!element) return null;
		sawRootElement = true;
		const depth = elementStack.length + 1;
		elementStack.push(element.name);
		processOpenElement(depth, element.name, element.attributes);
		if (element.selfClosing) closeElement(depth);
	}

	if (elementStack.length !== 0) return null;
	if (!sawRootElement) return null;

	return frames[0].kind === 'object' ? frames[0].output : frames[0].output;
}
