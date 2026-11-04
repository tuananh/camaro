/**
 * Minimal, dependency-free XML DOM used by the TypeScript camaro port.
 *
 * The parser mirrors the subset of pugixml behaviour that camaro relies on:
 *  - documents may contain several top-level elements (XML fragments),
 *  - comments, processing instructions, declarations and DOCTYPE nodes are
 *    ignored (camaro loads pugixml without parse_comments / parse_pi),
 *  - whitespace-only character data is not materialised (no parse_ws_pcdata),
 *  - CDATA sections are preserved as their own node type,
 *  - entities are expanded, while unknown or malformed entity references are
 *    kept literally (pugixml with parse_escapes does the same).
 */

export type XmlNodeType = 'document' | 'element' | 'text' | 'cdata';

export interface XmlAttribute {
	name: string;
	value: string;
	owner: XmlElement;
	/** Document order slot, used by the XPath engine. */
	order: number;
}

export interface XmlNode {
	type: XmlNodeType;
	name: string;
	value: string;
	attributes: XmlAttribute[];
	children: XmlNode[];
	parent: XmlNode | null;
	order: number;
}

export interface XmlDocument extends XmlNode {
	type: 'document';
}

export type XmlElement = XmlNode & { type: 'element' };

interface ParseState {
	source: string;
	position: number;
	order: number;
}

const NAMED_ENTITIES: Record<string, string> = {
	amp: '&',
	lt: '<',
	gt: '>',
	quot: '"',
	apos: "'",
};

// Text and CDATA nodes never receive attributes or children; sharing the empty
// arrays avoids two allocations per character-data node.
const EMPTY_ATTRIBUTES: XmlAttribute[] = [];
const EMPTY_CHILDREN: XmlNode[] = [];

// Whitespace lookup table used by the hot character-scanning loops.
const XML_WHITESPACE = new Uint8Array(128);
XML_WHITESPACE[0x20] = 1; // space
XML_WHITESPACE[0x09] = 1; // tab
XML_WHITESPACE[0x0a] = 1; // newline
XML_WHITESPACE[0x0d] = 1; // carriage return

// Lookup tables for XML names. A single array lookup replaces the several
// comparisons that were previously executed per name character.
const NAME_START = new Uint8Array(128);
const NAME_END = new Uint8Array(128);

for (let code = 0; code < 128; code++) {
	const start =
		(code >= 0x41 && code <= 0x5a) || // A-Z
		(code >= 0x61 && code <= 0x7a) || // a-z
		code === 0x5f || // _
		code === 0x3a; // :
	const char = start || (code >= 0x30 && code <= 0x39) || code === 0x2e || code === 0x2d;
	const stop =
		XML_WHITESPACE[code] === 1 ||
		code === 0x2f || // /
		code === 0x3e || // >
		code === 0x3d || // =
		code === 0x3c || // <
		code === 0x22 || // "
		code === 0x27 || // '
		code === 0x21 || // !
		code === 0x3f; // ?

	NAME_START[code] = start ? 1 : 0;
	NAME_END[code] = stop || !char ? 1 : 0;
}

function hasNonWhitespace(source: string, start: number, end: number): boolean {
	for (let index = start; index < end; index++) {
		const code = source.charCodeAt(index);
		if (code >= 128 || XML_WHITESPACE[code] === 0) return true;
	}
	return false;
}

function makeNode(
	state: ParseState,
	type: XmlNodeType,
	name: string,
	value: string,
	parent: XmlNode | null,
): XmlNode {
	if (type === 'text' || type === 'cdata') {
		return {
			type,
			name,
			value,
			attributes: EMPTY_ATTRIBUTES,
			children: EMPTY_CHILDREN,
			parent,
			order: state.order++,
		};
	}

	return {
		type,
		name,
		value,
		attributes: [],
		children: [],
		parent,
		order: state.order++,
	};
}

function appendChild(parent: XmlNode, child: XmlNode): void {
	child.parent = parent;
	parent.children.push(child);
}

function decodeEntities(raw: string): string {
	let output = '';
	let index = 0;

	while (index < raw.length) {
		const ampersand = raw.indexOf('&', index);
		if (ampersand === -1) {
			output += raw.slice(index);
			break;
		}
		output += raw.slice(index, ampersand);

		const semicolon = raw.indexOf(';', ampersand + 1);
		if (semicolon === -1) {
			output += raw.slice(ampersand);
			break;
		}

		const body = raw.slice(ampersand + 1, semicolon);
		let decoded: string | null = null;

		if (/^#[0-9]+$/.test(body)) {
			const codePoint = Number(body.slice(1));
			if (codePoint === 0) decoded = '';
			else if (codePoint <= 0x10ffff) decoded = String.fromCodePoint(codePoint);
		} else if (/^#x[0-9a-fA-F]+$/.test(body)) {
			const codePoint = Number.parseInt(body.slice(2), 16);
			if (codePoint === 0) decoded = '';
			else if (codePoint <= 0x10ffff) decoded = String.fromCodePoint(codePoint);
		} else if (Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, body)) {
			decoded = NAMED_ENTITIES[body];
		}

		if (decoded === null) {
			// Unknown references are not escapes: keep the ampersand and keep
			// scanning after it so the rest of the literal survives.
			output += '&';
			index = ampersand + 1;
			continue;
		}

		output += decoded;
		index = semicolon + 1;
	}

	return output;
}

function skipWhitespace(state: ParseState): void {
	const source = state.source;
	let position = state.position;
	while (position < source.length) {
		const code = source.charCodeAt(position);
		if (code >= 128 || XML_WHITESPACE[code] !== 1) break;
		position++;
	}
	state.position = position;
}

/**
 * Scan an XML name and validate it in the same pass. Returns null for invalid
 * names, which makes the surrounding document malformed (as pugixml does).
 */
function readName(state: ParseState): string | null {
	const source = state.source;
	const start = state.position;

	if (start >= source.length) return null;

	let position = start;
	let code = source.charCodeAt(position);
	if (code < 128 && NAME_START[code] === 0) return null;
	position++;

	while (position < source.length) {
		code = source.charCodeAt(position);
		if (code < 128 && NAME_END[code] !== 0) break;
		position++;
	}

	state.position = position;
	return source.slice(start, position);
}

function skipWhitespaceCount(state: ParseState): number {
	const start = state.position;
	skipWhitespace(state);
	return state.position - start;
}

function skipUntil(state: ParseState, terminator: string): boolean {
	const end = state.source.indexOf(terminator, state.position);
	if (end === -1) {
		state.position = state.source.length;
		return false;
	}
	state.position = end + terminator.length;
	return true;
}

function skipDeclaration(state: ParseState): boolean {
	// Handles <!DOCTYPE ...> including an internal subset and quoted values.
	let depth = 0;
	let quote = '';
	while (state.position < state.source.length) {
		const char = state.source[state.position++];
		if (quote) {
			if (char === quote) quote = '';
			continue;
		}
		if (char === '"' || char === "'") {
			quote = char;
		} else if (char === '[') {
			depth++;
		} else if (char === ']') {
			if (depth > 0) depth--;
		} else if (char === '>' && depth === 0) {
			return true;
		}
	}
	return false;
}

function parseStartTag(
	state: ParseState,
	parent: XmlNode,
): { element: XmlNode; selfClosing: boolean } | null {
	// state.position points at '<'.
	state.position++;
	const name = readName(state);
	if (name === null) return null;

	const element = makeNode(state, 'element', name, '', parent);
	const source = state.source;
	const length = source.length;

	while (state.position < length) {
		const hadWhitespace = skipWhitespaceCount(state) > 0;
		if (state.position >= length) return null;

		const char = source.charCodeAt(state.position);
		if (char === 0x3e /* > */) {
			state.position++;
			return { element, selfClosing: false };
		}
		if (char === 0x2f /* / */) {
			if (source.charCodeAt(state.position + 1) !== 0x3e) return null;
			state.position += 2;
			return { element, selfClosing: true };
		}

		// Attributes must be separated from the element name and from each
		// other by whitespace.
		if (!hadWhitespace) return null;

		const attributeName = readName(state);
		if (attributeName === null) return null;

		skipWhitespace(state);
		if (source.charCodeAt(state.position) !== 0x3d /* = */) return null;
		state.position++;
		skipWhitespace(state);

		const quoteCode = source.charCodeAt(state.position);
		if (quoteCode !== 0x22 && quoteCode !== 0x27) return null;
		const quote = quoteCode === 0x22 ? '"' : "'";

		const valueStart = state.position + 1;
		const valueEnd = source.indexOf(quote, valueStart);
		if (valueEnd === -1) return null;

		const rawValue = source.slice(valueStart, valueEnd);
		if (rawValue.indexOf('<') !== -1) return null;
		state.position = valueEnd + 1;

		const attribute: XmlAttribute = {
			name: attributeName,
			value: rawValue.indexOf('&') === -1 ? rawValue : decodeEntities(rawValue),
			owner: element as XmlElement,
			order: state.order++,
		};
		// pugixml keeps duplicate attributes in the tree (print/raw show both);
		// JSON conversion naturally keeps the last value for the duplicate key.
		element.attributes.push(attribute);
	}

	return null;
}

/**
 * Parse a UTF-8 XML string. Returns null for malformed markup (the equivalent
 * of a failed pugixml load), which camaro surfaces as an empty result.
 */
export function parseXml(source: string): XmlDocument | null {
	if (source.charCodeAt(0) === 0xfeff) source = source.slice(1);

	const state: ParseState = { source, position: 0, order: 0 };
	const document = makeNode(state, 'document', '', '', null) as XmlDocument;
	const stack: XmlNode[] = [document];

	const length = source.length;

	while (state.position < length) {
		const position = state.position;

		if (source.charCodeAt(position) !== 0x3c /* < */) {
			const nextTag = source.indexOf('<', position);
			const end = nextTag === -1 ? length : nextTag;

			// parse_ws_pcdata is disabled: whitespace-only text is discarded.
			// The decision is made on the raw (still escaped) text, exactly as
			// pugixml does before expanding character references. Character data
			// directly under the document node is not retained either.
			const parent = stack[stack.length - 1];
			if (parent.type !== 'document' && hasNonWhitespace(source, position, end)) {
				const raw = source.slice(position, end);
				const value = raw.indexOf('&') === -1 ? raw : decodeEntities(raw);
				if (value.length > 0) appendChild(parent, makeNode(state, 'text', '', value, parent));
			}
			state.position = end;
			continue;
		}

		const next = source.charCodeAt(position + 1);

		if (next === 0x3f) {
			state.position = position + 2;
			if (!skipUntil(state, '?>')) return null;
			continue;
		}

		if (next === 0x2f) {
			const current = stack[stack.length - 1];
			const closeStart = position + 2;
			const closeEnd = source.indexOf('>', closeStart);

			// Fast path for the normal `</name>` form: compare the source
			// range with the open element's name without allocating a string.
			if (
				closeEnd !== -1 &&
				current.type === 'element' &&
				closeEnd - closeStart === current.name.length &&
				source.indexOf(current.name, closeStart) === closeStart
			) {
				state.position = closeEnd + 1;
				stack.pop();
				continue;
			}

			state.position = closeStart;
			const name = readName(state);
			skipWhitespace(state);
			if (name === null || source.charCodeAt(state.position) !== 0x3e) return null;
			state.position++;

			if (current.type !== 'element' || current.name !== name) return null;
			stack.pop();
			continue;
		}

		if (next === 0x21) {
			if (source.charCodeAt(position + 2) === 0x2d && source.charCodeAt(position + 3) === 0x2d) {
				state.position = position + 4;
				if (!skipUntil(state, '-->')) return null;
				continue;
			}

			if (source.startsWith('<![CDATA[', position)) {
				state.position = position + 9;
				const end = source.indexOf(']]>', state.position);
				if (end === -1) return null;
				const value = source.slice(state.position, end);
				state.position = end + 3;
				appendChild(stack[stack.length - 1], makeNode(state, 'cdata', '', value, stack[stack.length - 1]));
				continue;
			}

			state.position = position + 2;
			if (!skipDeclaration(state)) return null;
			continue;
		}

		state.position = position;
		const parsed = parseStartTag(state, stack[stack.length - 1]);
		if (!parsed) return null;
		appendChild(stack[stack.length - 1], parsed.element);
		if (!parsed.selfClosing) stack.push(parsed.element);
	}

	if (stack.length !== 1) return null;

	// pugixml requires a document element; fragments may contain several roots,
	// but a document made only of whitespace/comments/text/CDATA is invalid.
	if (!document.children.some((child) => child.type === 'element')) return null;

	return document;
}

/* -------------------------------------------------------------------------- */
/* JSON conversion (camaro's toJson)                                          */
/* -------------------------------------------------------------------------- */

const TEXT_WHITESPACE = /^[ \t\r\n]+|[ \t\r\n]+$/g;

function trimText(value: string): string {
	return value.replace(TEXT_WHITESPACE, '');
}

function elementChildren(parent: XmlNode): XmlNode[] {
	return parent.children.filter((child) => child.type === 'element');
}

function hasEarlierNamedSibling(node: XmlNode): boolean {
	const parent = node.parent;
	if (!parent) return false;
	for (const sibling of parent.children) {
		if (sibling === node) return false;
		if (sibling.type === 'element' && sibling.name === node.name) return true;
	}
	return false;
}

function namedSiblingCount(node: XmlNode): number {
	const parent = node.parent;
	if (!parent) return 1;
	let count = 0;
	for (const sibling of parent.children) {
		if (sibling.type === 'element' && sibling.name === node.name) count++;
	}
	return count;
}

function collectElementText(node: XmlNode): string {
	let text = '';
	for (const child of node.children) {
		if (child.type !== 'text' && child.type !== 'cdata') continue;
		text += trimText(child.value);
	}
	return text;
}

function writeXmlChildren(parent: XmlNode, output: Record<string, unknown>): void {
	for (const child of parent.children) {
		if (child.type !== 'element' || hasEarlierNamedSibling(child)) continue;

		if (namedSiblingCount(child) === 1) {
			output[child.name] = writeXmlElement(child);
		} else {
			const items: unknown[] = [];
			for (const sibling of parent.children) {
				if (sibling.type === 'element' && sibling.name === child.name) {
					items.push(writeXmlElement(sibling));
				}
			}
			output[child.name] = items;
		}
	}
}

function writeXmlElement(node: XmlNode): unknown {
	const hasAttributes = node.attributes.length > 0;
	const hasChildren = node.children.some((child) => child.type === 'element');
	const text = collectElementText(node);

	if (!hasAttributes && !hasChildren && text) return text;

	const output: Record<string, unknown> = {};
	if (hasAttributes) {
		const attributes: Record<string, string> = {};
		for (const attribute of node.attributes) attributes[attribute.name] = attribute.value;
		output.$ = attributes;
	}
	writeXmlChildren(node, output);
	if (text) output._text = text;
	return output;
}

export function toJsonValue(document: XmlDocument): Record<string, unknown> {
	const output: Record<string, unknown> = {};
	writeXmlChildren(document, output);
	return output;
}

/* -------------------------------------------------------------------------- */
/* XML serialisation (used by prettyPrint and raw())                          */
/* -------------------------------------------------------------------------- */

const TEXT_ESCAPE: Record<string, string> = {
	'&': '&amp;',
	'<': '&lt;',
	'>': '&gt;',
};

const ATTRIBUTE_ESCAPE: Record<string, string> = {
	'&': '&amp;',
	'<': '&lt;',
	'"': '&quot;',
	'\n': '&#10;',
	'\r': '&#13;',
	'\t': '&#09;',
};

function escapeText(value: string): string {
	return value.replace(/[&<>]/g, (char) => TEXT_ESCAPE[char]);
}

function escapeAttribute(value: string): string {
	return value.replace(/[&<"\n\r\t]/g, (char) => ATTRIBUTE_ESCAPE[char]);
}

interface PrintState {
	indent: string;
}

function printNode(node: XmlNode, depth: number, state: PrintState): string {
	switch (node.type) {
		case 'text':
			return escapeText(node.value);
		case 'cdata':
			return `<![CDATA[${node.value}]]>`;
		default:
			return printElement(node, depth, state);
	}
}

function printElement(node: XmlNode, depth: number, state: PrintState): string {
	let output = `<${node.name}`;
	for (const attribute of node.attributes) {
		output += ` ${attribute.name}="${escapeAttribute(attribute.value)}"`;
	}

	const children = node.children;
	if (children.length === 0) return `${output} />`;

	output += '>';
	let flags = 3; // indent_newline | indent_indent

	for (const child of children) {
		if (child.type === 'text' || child.type === 'cdata') {
			output += printNode(child, depth + 1, state);
			flags = 0;
			continue;
		}

		if (flags & 1) output += '\n';
		if (flags & 2) output += state.indent.repeat(depth + 1);
		output += printNode(child, depth + 1, state);
		flags = 3;
	}

	if (flags & 1) output += '\n';
	if (flags & 2) output += state.indent.repeat(depth);
	output += `</${node.name}>`;
	return output;
}

function printDocument(document: XmlDocument, state: PrintState): string {
	let output = '';
	let flags = 2; // indent_indent (the document itself never emits a newline)

	for (const child of document.children) {
		if (child.type === 'text' || child.type === 'cdata') {
			output += printNode(child, 0, state);
			flags = 0;
			continue;
		}
		if (flags & 1) output += '\n';
		if (flags & 2) output += state.indent.repeat(0);
		output += printNode(child, 0, state);
		flags = 3;
	}

	if (flags & 1) output += '\n';
	return output;
}

/** Serialise a node using pugixml's default print settings (tab indent). */
export function serializeNode(node: XmlNode): string {
	const state: PrintState = { indent: '\t' };
	if (node.type === 'document') return printDocument(node as XmlDocument, state);
	// xml_node::print() terminates an element with a newline, even when the
	// element's last child is character data.
	return `${printNode(node, 0, state)}\n`;
}

/** Serialise a whole document for prettyPrint(). */
export function prettyPrintValue(document: XmlDocument, indentSize: number): string {
	const state: PrintState = { indent: ' '.repeat(Math.max(0, indentSize)) };
	return printDocument(document, state);
}
