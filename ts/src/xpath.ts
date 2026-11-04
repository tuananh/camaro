/**
 * A compact XPath 1.0 engine.
 *
 * camaro templates are XPath expressions, so the TypeScript port needs a real
 * (if intentionally small) XPath implementation. This module supports the
 * axes, node tests, operators and core functions used by camaro templates,
 * plus camaro's extra string functions. Unknown/invalid expressions evaluate
 * to an empty result, matching pugixml's error nodes.
 */

import { serializeNode, XmlAttribute, XmlNode } from './xml';

export type XPathItem =
	| { kind: 'node'; node: XmlNode; order: number }
	| { kind: 'attribute'; attribute: XmlAttribute; order: number };

export type XPathValue = string | number | boolean | XPathItem[];

export interface XPathContext {
	item: XPathItem;
	position: number;
	size: number;
}

type Axis =
	| 'ancestor'
	| 'ancestor-or-self'
	| 'attribute'
	| 'child'
	| 'descendant'
	| 'descendant-or-self'
	| 'following'
	| 'following-sibling'
	| 'namespace'
	| 'parent'
	| 'preceding'
	| 'preceding-sibling'
	| 'self';

type NodeTest =
	| { kind: 'name'; name: string }
	| { kind: 'any' }
	| { kind: 'node' }
	| { kind: 'text' }
	| { kind: 'comment' }
	| { kind: 'processing-instruction'; target?: string };

interface Predicate {
	expression: Expression;
}

interface Step {
	axis: Axis;
	test: NodeTest;
	predicates: Predicate[];
}

export type Expression =
	| { type: 'literal'; value: string }
	| { type: 'number'; value: number }
	| { type: 'path'; start?: Expression; absolute: boolean; steps: Step[] }
	| { type: 'filter'; expression: Expression; predicates: Predicate[] }
	| { type: 'function'; name: string; args: Expression[] }
	| { type: 'unary'; operator: '-'; expression: Expression }
	| { type: 'binary'; operator: string; left: Expression; right: Expression };

/* -------------------------------------------------------------------------- */
/* Tokenizer                                                                  */
/* -------------------------------------------------------------------------- */

interface Token {
	type: 'name' | 'number' | 'string' | 'operator' | 'eof';
	value: string;
}

const MULTI_OPERATORS = ['//', '..', '::', '!=', '<=', '>='];
const SINGLE_OPERATORS = '/.@[](),=<>+-*|$';

function isNameStart(char: string): boolean {
	return /[A-Za-z_:]/.test(char) || char.charCodeAt(0) > 127;
}

function isNameChar(char: string): boolean {
	return /[A-Za-z0-9_.:-]/.test(char) || char.charCodeAt(0) > 127;
}

function isDigit(char: string): boolean {
	return char >= '0' && char <= '9';
}

function tokenize(source: string): Token[] {
	const tokens: Token[] = [];
	let index = 0;

	while (index < source.length) {
		const char = source[index];

		if (/\s/.test(char)) {
			index++;
			continue;
		}

		const multi = MULTI_OPERATORS.find((operator) => source.startsWith(operator, index));
		if (multi) {
			tokens.push({ type: 'operator', value: multi });
			index += multi.length;
			continue;
		}

		if (char === '"' || char === "'") {
			const quote = char;
			index++;
			let value = '';
			let closed = false;
			while (index < source.length) {
				const current = source[index++];
				if (current === quote) {
					closed = true;
					break;
				}
				value += current;
			}
			if (!closed) return [];
			tokens.push({ type: 'string', value });
			continue;
		}

		if (isDigit(char) || (char === '.' && isDigit(source[index + 1]))) {
			const start = index;
			if (char === '.') index++;
			while (isDigit(source[index])) index++;
			if (source[index] === '.') {
				index++;
				while (isDigit(source[index])) index++;
			}
			tokens.push({ type: 'number', value: source.slice(start, index) });
			continue;
		}

		if (char === '.') {
			tokens.push({ type: 'operator', value: '.' });
			index++;
			continue;
		}

		if (isNameStart(char)) {
			const start = index;
			index++;
			while (index < source.length && isNameChar(source[index])) {
				// `::` separates an axis from its node test; a single colon is
				// part of a qualified name.
				if (source[index] === ':' && source[index + 1] === ':') break;
				index++;
			}
			tokens.push({ type: 'name', value: source.slice(start, index) });
			continue;
		}

		if (SINGLE_OPERATORS.includes(char)) {
			tokens.push({ type: 'operator', value: char });
			index++;
			continue;
		}

		// Unknown character: treat the expression as invalid.
		return [];
	}

	tokens.push({ type: 'eof', value: '' });
	return tokens;
}

/* -------------------------------------------------------------------------- */
/* Parser                                                                     */
/* -------------------------------------------------------------------------- */

const AXES = new Set<Axis>([
	'ancestor',
	'ancestor-or-self',
	'attribute',
	'child',
	'descendant',
	'descendant-or-self',
	'following',
	'following-sibling',
	'namespace',
	'parent',
	'preceding',
	'preceding-sibling',
	'self',
]);

const NODE_TEST_FUNCTIONS = new Set(['node', 'text', 'comment', 'processing-instruction']);

/** Function name -> [minimum, maximum] argument count. Unknown functions and
 * wrong arities make the whole XPath expression invalid, like pugixml. */
const FUNCTION_ARITY: Record<string, [number, number]> = {
	last: [0, 0],
	position: [0, 0],
	count: [1, 1],
	id: [1, 1],
	'local-name': [0, 1],
	'namespace-uri': [0, 1],
	name: [0, 1],
	string: [0, 1],
	concat: [2, Number.POSITIVE_INFINITY],
	'starts-with': [2, 2],
	contains: [2, 2],
	'substring-before': [2, 2],
	'substring-after': [2, 2],
	substring: [2, 3],
	'string-length': [0, 1],
	'normalize-space': [0, 1],
	translate: [3, 3],
	boolean: [1, 1],
	not: [1, 1],
	true: [0, 0],
	false: [0, 0],
	lang: [1, 1],
	number: [0, 1],
	sum: [1, 1],
	floor: [1, 1],
	ceiling: [1, 1],
	round: [1, 1],
	'string-join': [1, 2],
	raw: [0, 1],
	'upper-case': [1, 1],
	'lower-case': [1, 1],
	'title-case': [1, 1],
	'camel-case': [1, 1],
	'snake-case': [1, 1],
};

class Parser {
	private readonly tokens: Token[];
	private index = 0;
	private valid = true;

	constructor(source: string) {
		this.tokens = tokenize(source);
		if (this.tokens.length === 0) this.valid = false;
	}

	parse(): Expression | null {
		if (!this.valid) return null;
		const expression = this.parseOr();
		if (!expression || !this.valid) return null;
		if (this.peek().type !== 'eof') return null;
		return expression;
	}

	private peek(offset = 0): Token {
		return this.tokens[Math.min(this.index + offset, this.tokens.length - 1)];
	}

	private next(): Token {
		const token = this.peek();
		if (this.index < this.tokens.length - 1) this.index++;
		return token;
	}

	private isOperator(value: string): boolean {
		const token = this.peek();
		return token.type === 'operator' && token.value === value;
	}

	private isName(value: string): boolean {
		const token = this.peek();
		return token.type === 'name' && token.value === value;
	}

	private acceptOperator(value: string): boolean {
		if (!this.isOperator(value)) return false;
		this.next();
		return true;
	}

	private expectOperator(value: string): boolean {
		if (!this.isOperator(value)) {
			this.valid = false;
			return false;
		}
		this.next();
		return true;
	}

	private parseOr(): Expression | null {
		let left = this.parseAnd();
		while (left && this.isName('or')) {
			this.next();
			const right = this.parseAnd();
			if (!right) return null;
			left = { type: 'binary', operator: 'or', left, right };
		}
		return left;
	}

	private parseAnd(): Expression | null {
		let left = this.parseEquality();
		while (left && this.isName('and')) {
			this.next();
			const right = this.parseEquality();
			if (!right) return null;
			left = { type: 'binary', operator: 'and', left, right };
		}
		return left;
	}

	private parseEquality(): Expression | null {
		let left = this.parseRelational();
		while (left && (this.isOperator('=') || this.isOperator('!='))) {
			const operator = this.next().value;
			const right = this.parseRelational();
			if (!right) return null;
			left = { type: 'binary', operator, left, right };
		}
		return left;
	}

	private parseRelational(): Expression | null {
		let left = this.parseAdditive();
		while (
			left &&
			(this.isOperator('<') || this.isOperator('>') || this.isOperator('<=') || this.isOperator('>='))
		) {
			const operator = this.next().value;
			const right = this.parseAdditive();
			if (!right) return null;
			left = { type: 'binary', operator, left, right };
		}
		return left;
	}

	private parseAdditive(): Expression | null {
		let left = this.parseMultiplicative();
		while (left && (this.isOperator('+') || this.isOperator('-'))) {
			const operator = this.next().value;
			const right = this.parseMultiplicative();
			if (!right) return null;
			left = { type: 'binary', operator, left, right };
		}
		return left;
	}

	private parseMultiplicative(): Expression | null {
		let left = this.parseUnary();
		while (left && (this.isOperator('*') || this.isName('div') || this.isName('mod'))) {
			const operator = this.next().value;
			const right = this.parseUnary();
			if (!right) return null;
			left = { type: 'binary', operator, left, right };
		}
		return left;
	}

	private parseUnary(): Expression | null {
		if (this.acceptOperator('-')) {
			const expression = this.parseUnary();
			return expression ? { type: 'unary', operator: '-', expression } : null;
		}
		return this.parseUnion();
	}

	private parseUnion(): Expression | null {
		let left = this.parsePathExpression();
		while (left && this.acceptOperator('|')) {
			const right = this.parsePathExpression();
			if (!right) return null;
			left = { type: 'binary', operator: '|', left, right };
		}
		return left;
	}

	private startsStep(): boolean {
		const token = this.peek();
		if (token.type === 'operator') {
			return token.value === '.' || token.value === '..' || token.value === '@' || token.value === '*';
		}
		if (token.type !== 'name') return false;

		const following = this.peek(1);
		if (following.type === 'operator' && following.value === '::') return true;
		if (following.type === 'operator' && following.value === '(') {
			return NODE_TEST_FUNCTIONS.has(token.value);
		}
		return true;
	}

	private parsePathExpression(): Expression | null {
		if (this.isOperator('/') || this.isOperator('//')) {
			return this.parseAbsolutePath();
		}

		if (this.startsStep()) {
			const steps: Step[] = [];
			const first = this.parseStep();
			if (!first) return null;
			steps.push(first);
			if (!this.parsePathTail(steps)) return null;
			return { type: 'path', absolute: false, steps };
		}

		let expression = this.parsePrimary();
		if (!expression) return null;

		if (this.isOperator('[')) {
			const predicates: Predicate[] = [];
			while (this.acceptOperator('[')) {
				const predicate = this.parseOr();
				if (!predicate || !this.expectOperator(']')) return null;
				predicates.push({ expression: predicate });
			}
			expression = { type: 'filter', expression, predicates };
		}

		if (this.isOperator('/') || this.isOperator('//')) {
			const steps: Step[] = [];
			if (!this.parsePathTail(steps)) return null;
			return { type: 'path', start: expression, absolute: false, steps };
		}

		return expression;
	}

	private parseAbsolutePath(): Expression {
		const steps: Step[] = [];
		if (this.acceptOperator('/')) {
			if (this.startsStep()) {
				const first = this.parseStep();
				if (!first) return { type: 'path', absolute: true, steps: [] };
				steps.push(first);
				this.parsePathTail(steps);
			}
		} else {
			this.expectOperator('//');
			steps.push({ axis: 'descendant-or-self', test: { kind: 'node' }, predicates: [] });
			const first = this.parseStep();
			if (!first) {
				this.valid = false;
				return { type: 'path', absolute: true, steps: [] };
			}
			steps.push(first);
			this.parsePathTail(steps);
		}
		return { type: 'path', absolute: true, steps };
	}

	private parsePathTail(steps: Step[]): boolean {
		for (;;) {
			if (this.acceptOperator('//')) {
				steps.push({ axis: 'descendant-or-self', test: { kind: 'node' }, predicates: [] });
				const step = this.parseStep();
				if (!step) return false;
				steps.push(step);
				continue;
			}
			if (this.acceptOperator('/')) {
				const step = this.parseStep();
				if (!step) return false;
				steps.push(step);
				continue;
			}
			return true;
		}
	}

	private parseStep(): Step | null {
		let axis: Axis = 'child';

		if (this.acceptOperator('@')) {
			axis = 'attribute';
		} else if (this.acceptOperator('..')) {
			return this.parsePredicates({ axis: 'parent', test: { kind: 'node' }, predicates: [] });
		} else if (this.acceptOperator('.')) {
			return this.parsePredicates({ axis: 'self', test: { kind: 'node' }, predicates: [] });
		} else if (this.peek().type === 'name' && this.peek(1).type === 'operator' && this.peek(1).value === '::') {
			const axisName = this.next().value as Axis;
			this.next(); // ::
			if (!AXES.has(axisName)) {
				this.valid = false;
				return null;
			}
			axis = axisName;
		}

		const test = this.parseNodeTest();
		if (!test) return null;
		return this.parsePredicates({ axis, test, predicates: [] });
	}

	private parsePredicates(step: Step): Step {
		while (this.acceptOperator('[')) {
			const expression = this.parseOr();
			if (!expression || !this.expectOperator(']')) return step;
			step.predicates.push({ expression });
		}
		return step;
	}

	private parseNodeTest(): NodeTest | null {
		const token = this.peek();

		if (token.type === 'operator' && token.value === '*') {
			this.next();
			return { kind: 'any' };
		}

		if (token.type !== 'name') {
			this.valid = false;
			return null;
		}

		const name = token.value;

		if (this.peek(1).type === 'operator' && this.peek(1).value === '(') {
			if (!NODE_TEST_FUNCTIONS.has(name)) {
				this.valid = false;
				return null;
			}
			this.next(); // name
			this.next(); // (
			let target: string | undefined;
			if (this.peek().type === 'string') target = this.next().value;
			if (!this.expectOperator(')')) return null;

			if (name === 'node') return { kind: 'node' };
			if (name === 'text') return { kind: 'text' };
			if (name === 'comment') return { kind: 'comment' };
			return { kind: 'processing-instruction', target };
		}

		this.next();
		// Handle `prefix:*`.
		if (name.endsWith(':') && this.acceptOperator('*')) return { kind: 'name', name: `${name}*` };
		return { kind: 'name', name };
	}

	private parsePrimary(): Expression | null {
		const token = this.peek();

		if (token.type === 'string') {
			this.next();
			return { type: 'literal', value: token.value };
		}
		if (token.type === 'number') {
			this.next();
			return { type: 'number', value: Number(token.value) };
		}
		if (token.type === 'operator' && token.value === '(') {
			this.next();
			const expression = this.parseOr();
			if (!expression || !this.expectOperator(')')) return null;
			return expression;
		}
		if (token.type === 'operator' && token.value === '$') {
			this.next();
			if (this.peek().type !== 'name') {
				this.valid = false;
				return null;
			}
			this.next();
			// No variables exist in camaro templates.
			return { type: 'literal', value: '' };
		}
		if (token.type === 'name' && this.peek(1).type === 'operator' && this.peek(1).value === '(') {
			const name = this.next().value;
			this.next(); // (
			const args: Expression[] = [];
			if (!this.isOperator(')')) {
				for (;;) {
					const argument = this.parseOr();
					if (!argument) return null;
					args.push(argument);
					if (this.acceptOperator(',')) continue;
					break;
				}
			}
			if (!this.expectOperator(')')) return null;
			const arity = FUNCTION_ARITY[name];
			if (!arity || args.length < arity[0] || args.length > arity[1]) {
				this.valid = false;
				return null;
			}
			return { type: 'function', name, args };
		}

		this.valid = false;
		return null;
	}
}

export function parseXPath(source: string): Expression | null {
	return new Parser(source).parse();
}

/* -------------------------------------------------------------------------- */
/* Values & conversions                                                       */
/* -------------------------------------------------------------------------- */

function nodeItem(node: XmlNode): XPathItem {
	return { kind: 'node', node, order: node.order };
}

function attributeItem(attribute: XmlAttribute): XPathItem {
	return { kind: 'attribute', attribute, order: attribute.order };
}

function itemNode(item: XPathItem): XmlNode | null {
	return item.kind === 'node' ? item.node : null;
}

export function itemStringValue(item: XPathItem): string {
	if (item.kind === 'attribute') return item.attribute.value;
	const node = item.node;

	switch (node.type) {
		case 'text':
		case 'cdata':
			return node.value;
		case 'element':
		case 'document': {
			let value = '';
			for (const child of node.children) {
				if (child.type === 'text' || child.type === 'cdata') value += child.value;
				else if (child.type === 'element') value += itemStringValue(nodeItem(child));
			}
			return value;
		}
		default:
			return '';
	}
}

const NUMBER_PATTERN = /^-?(?:\d+(?:\.\d*)?|\.\d+)$/;

export function stringToNumber(value: string): number {
	const trimmed = value.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, '');
	if (!NUMBER_PATTERN.test(trimmed)) return Number.NaN;
	return Number(trimmed);
}

export function numberToString(value: number): string {
	if (Number.isNaN(value)) return 'NaN';
	if (value === Infinity) return 'Infinity';
	if (value === -Infinity) return '-Infinity';
	if (Object.is(value, -0)) return '0';
	if (Number.isInteger(value)) return String(value);
	return String(value);
}

function toBoolean(value: XPathValue): boolean {
	if (Array.isArray(value)) return value.length > 0;
	if (typeof value === 'boolean') return value;
	if (typeof value === 'number') return value !== 0 && !Number.isNaN(value);
	return value.length > 0;
}

function toStringValue(value: XPathValue): string {
	if (Array.isArray(value)) return value.length ? itemStringValue(value[0]) : '';
	if (typeof value === 'string') return value;
	if (typeof value === 'number') return numberToString(value);
	return value ? 'true' : 'false';
}

function toNumberValue(value: XPathValue): number {
	if (Array.isArray(value)) return stringToNumber(toStringValue(value));
	if (typeof value === 'number') return value;
	if (typeof value === 'boolean') return value ? 1 : 0;
	return stringToNumber(value);
}

/* -------------------------------------------------------------------------- */
/* Node-set helpers                                                           */
/* -------------------------------------------------------------------------- */

function rootNode(node: XmlNode): XmlNode {
	let current = node;
	while (current.parent) current = current.parent;
	return current;
}

function itemRoot(item: XPathItem): XmlNode {
	if (item.kind === 'attribute') return rootNode(item.attribute.owner);
	return rootNode(item.node);
}

function childNodes(node: XmlNode): XmlNode[] {
	return node.type === 'element' || node.type === 'document' ? node.children : [];
}

function allDescendants(node: XmlNode): XmlNode[] {
	const result: XmlNode[] = [];
	const visit = (parent: XmlNode): void => {
		for (const child of parent.children) {
			result.push(child);
			visit(child);
		}
	};
	visit(node);
	return result;
}

function siblings(node: XmlNode): XmlNode[] {
	return node.parent ? node.parent.children : [node];
}

function parentItem(item: XPathItem): XPathItem | null {
	if (item.kind === 'attribute') return nodeItem(item.attribute.owner);
	if (!item.node.parent) return null;
	return nodeItem(item.node.parent);
}

function matchesName(name: string, test: string): boolean {
	if (test === '*') return true;
	if (test.endsWith(':*')) return name.startsWith(test.slice(0, -1));
	return name === test;
}

function matchesTest(item: XPathItem, test: NodeTest): boolean {
	if (test.kind === 'node') return true;

	if (test.kind === 'text' || test.kind === 'comment' || test.kind === 'processing-instruction') {
		// camaro's XML parser never materialises comments or PIs.
		return test.kind === 'text' && item.kind === 'node' && (item.node.type === 'text' || item.node.type === 'cdata');
	}

	if (test.kind === 'any') {
		if (item.kind === 'attribute') return true;
		return item.node.type === 'element';
	}

	if (item.kind === 'attribute') {
		return test.kind === 'name' && matchesName(item.attribute.name, test.name);
	}

	return item.node.type === 'element' && test.kind === 'name' && matchesName(item.node.name, test.name);
}

function axisItems(item: XPathItem, axis: Axis): XPathItem[] {
	switch (axis) {
		case 'self':
			return [item];

		case 'child': {
			const node = item.kind === 'attribute' ? item.attribute.owner : item.node;
			return childNodes(node).map(nodeItem);
		}

		case 'attribute': {
			const element = item.kind === 'attribute' ? item.attribute.owner : item.node;
			if (element.type !== 'element') return [];
			return element.attributes.map(attributeItem);
		}

		case 'descendant': {
			const node = itemNode(item);
			return node ? allDescendants(node).map(nodeItem) : [];
		}

		case 'descendant-or-self': {
			const node = itemNode(item);
			if (!node) return [item];
			return [item, ...allDescendants(node).map(nodeItem)];
		}

		case 'parent': {
			const parent = parentItem(item);
			return parent ? [parent] : [];
		}

		case 'ancestor': {
			const result: XPathItem[] = [];
			let current = parentItem(item);
			while (current) {
				result.push(current);
				current = parentItem(current);
			}
			return result;
		}

		case 'ancestor-or-self': {
			const result: XPathItem[] = [item];
			let current = parentItem(item);
			while (current) {
				result.push(current);
				current = parentItem(current);
			}
			return result;
		}

		case 'following-sibling':
		case 'preceding-sibling': {
			if (item.kind === 'attribute') return [];
			const group = siblings(item.node);
			const index = group.indexOf(item.node);
			if (index === -1) return [];
			if (axis === 'following-sibling') return group.slice(index + 1).map(nodeItem);
			const result: XPathItem[] = [];
			for (let i = index - 1; i >= 0; i--) result.push(nodeItem(group[i]));
			return result;
		}

		case 'following': {
			const node = itemNode(item);
			if (!node) return [];
			const descendantsGeneration = nextSeenGeneration();
			for (const descendant of allDescendants(node)) markSeenOrder(descendantsGeneration, descendant.order);
			const root = rootNode(node);
			const result: XPathItem[] = [];
			const all = allDescendants(root);
			let seen = false;
			for (const candidate of all) {
				if (candidate === node) {
					seen = true;
					continue;
				}
				if (!seen) continue;
				if (isSeenOrder(descendantsGeneration, candidate.order)) continue;
				result.push(nodeItem(candidate));
			}
			return result;
		}

		case 'preceding': {
			const node = itemNode(item);
			if (!node) return [];
			const ancestorsGeneration = nextSeenGeneration();
			let current: XmlNode | null = node.parent;
			while (current) {
				markSeenOrder(ancestorsGeneration, current.order);
				current = current.parent;
			}
			const root = rootNode(node);
			const result: XPathItem[] = [];
			for (const candidate of allDescendants(root)) {
				if (candidate === node) break;
				if (isSeenOrder(ancestorsGeneration, candidate.order)) continue;
				result.push(nodeItem(candidate));
			}
			return result.reverse();
		}

		case 'namespace':
			return [];
	}
}

// Node/attribute orders are dense integers, so a flat "seen" array with a
// generation stamp beats a hash Set: no hashing, no per-call allocation,
// O(1) probe. Callers take a fresh generation and reuse the same buffer.
let seenOrders = new Uint32Array(256);
let seenGeneration = 1;

function nextSeenGeneration(): number {
	let generation = seenGeneration + 1;
	if (generation === 0xffffffff) {
		seenOrders.fill(0);
		generation = 1;
	}
	seenGeneration = generation;
	return generation;
}

function markSeenOrder(generation: number, order: number): void {
	if (order >= seenOrders.length) {
		const grown = new Uint32Array(Math.max(order + 1, seenOrders.length * 2));
		grown.set(seenOrders);
		seenOrders = grown;
	}
	seenOrders[order] = generation;
}

function isSeenOrder(generation: number, order: number): boolean {
	return order < seenOrders.length && seenOrders[order] === generation;
}

function dedupe(items: XPathItem[]): XPathItem[] {
	if (items.length < 2) return items;
	const generation = nextSeenGeneration();
	const result: XPathItem[] = [];
	for (const item of items) {
		const key = item.kind === 'node' ? item.node.order : item.attribute.order;
		if (isSeenOrder(generation, key)) continue;
		markSeenOrder(generation, key);
		result.push(item);
	}
	return result;
}

/* -------------------------------------------------------------------------- */
/* Evaluation                                                                 */
/* -------------------------------------------------------------------------- */

function docItem(context: XPathContext): XPathItem {
	return nodeItem(rootNode(context.item.kind === 'attribute' ? context.item.attribute.owner : context.item.node));
}

function makeContext(item: XPathItem, position: number, size: number): XPathContext {
	return { item, position, size };
}

function applyPredicates(items: XPathItem[], predicates: Predicate[], context: XPathContext): XPathItem[] {
	let current = items;
	for (const predicate of predicates) {
		const size = current.length;
		const next: XPathItem[] = [];
		for (let index = 0; index < current.length; index++) {
			const value = evalExpression(predicate.expression, makeContext(current[index], index + 1, size), context);
			if (typeof value === 'number') {
				if (value === index + 1) next.push(current[index]);
			} else if (toBoolean(value)) {
				next.push(current[index]);
			}
		}
		current = next;
	}
	return current;
}

function applyStep(items: XPathItem[], step: Step, context: XPathContext): XPathItem[] {
	const result: XPathItem[] = [];
	for (const item of items) {
		const candidates = axisItems(item, step.axis).filter((candidate) => matchesTest(candidate, step.test));
		const filtered = applyPredicates(candidates, step.predicates, context);
		result.push(...filtered);
	}
	// A location step always produces a node-set in document order. Predicates
	// are evaluated in axis order above (so reverse axes still select their
	// nearest node for [1]); only the final union is sorted.
	return dedupe(result).sort((a, b) => a.order - b.order);
}

function evalNodeSet(expression: Expression, context: XPathContext): XPathItem[] {
	switch (expression.type) {
		case 'path': {
			let current: XPathItem[];
			if (expression.start) {
				current = evalNodeSet(expression.start, context);
			} else if (expression.absolute) {
				current = [docItem(context)];
			} else {
				current = [context.item];
			}

			for (const step of expression.steps) current = applyStep(current, step, context);
			return current;
		}

		case 'filter': {
			const items = evalNodeSet(expression.expression, context);
			return applyPredicates(items, expression.predicates, context);
		}

		case 'binary':
			if (expression.operator === '|') {
				const left = evalNodeSet(expression.left, context);
				const right = evalNodeSet(expression.right, context);
				return dedupe([...left, ...right]).sort((a, b) => a.order - b.order);
			}
			return [];
	}

	return [];
}

function compareValues(operator: string, left: XPathValue, right: XPathValue): boolean {
	const leftSet = Array.isArray(left);
	const rightSet = Array.isArray(right);

	const relational = operator === '<' || operator === '>' || operator === '<=' || operator === '>=';
	const compare = (a: number, b: number): boolean => {
		switch (operator) {
			case '<':
				return a < b;
			case '>':
				return a > b;
			case '<=':
				return a <= b;
			case '>=':
				return a >= b;
			default:
				return false;
		}
	};

	const equal = (a: string, b: string): boolean => (operator === '=' ? a === b : a !== b);

	if (relational) {
		const pairs = (): boolean => {
			const leftValues = leftSet ? left.map((item) => stringToNumber(itemStringValue(item))) : [toNumberValue(left)];
			const rightValues = rightSet ? right.map((item) => stringToNumber(itemStringValue(item))) : [toNumberValue(right)];
			for (const a of leftValues) for (const b of rightValues) if (compare(a, b)) return true;
			return false;
		};
		return pairs();
	}

	if (leftSet && rightSet) {
		for (const a of left) for (const b of right) if (equal(itemStringValue(a), itemStringValue(b))) return true;
		return false;
	}

	if (leftSet || rightSet) {
		const set = (leftSet ? left : right) as XPathItem[];
		const other = leftSet ? right : left;

		if (typeof other === 'boolean') {
			const setBoolean = set.length > 0;
			return operator === '=' ? setBoolean === other : setBoolean !== other;
		}

		if (typeof other === 'number') {
			for (const item of set) {
				const value = stringToNumber(itemStringValue(item));
				if (operator === '=' ? value === other : value !== other) return true;
			}
			return false;
		}

		const otherString = toStringValue(other);
		for (const item of set) {
			if (equal(itemStringValue(item), otherString)) return true;
		}
		return false;
	}

	if (typeof left === 'boolean' || typeof right === 'boolean') {
		const a = toBoolean(left);
		const b = toBoolean(right);
		return operator === '=' ? a === b : a !== b;
	}
	if (typeof left === 'number' || typeof right === 'number') {
		const a = toNumberValue(left);
		const b = toNumberValue(right);
		return operator === '=' ? a === b : a !== b;
	}
	return equal(toStringValue(left), toStringValue(right));
}

function arithmetic(operator: string, left: XPathValue, right: XPathValue): number {
	const a = toNumberValue(left);
	const b = toNumberValue(right);
	switch (operator) {
		case '+':
			return a + b;
		case '-':
			return a - b;
		case '*':
			return a * b;
		case 'div':
			return a / b;
		case 'mod':
			// XPath's mod follows the sign of the dividend (like C fmod).
			return a % b;
		default:
			return Number.NaN;
	}
}

function evalExpression(expression: Expression, context: XPathContext, rootContext: XPathContext): XPathValue {
	switch (expression.type) {
		case 'literal':
			return expression.value;
		case 'number':
			return expression.value;
		case 'path':
		case 'filter':
			return evalNodeSet(expression, context);
		case 'unary':
			return -toNumberValue(evalExpression(expression.expression, context, rootContext));
		case 'binary': {
			if (expression.operator === '|') return evalNodeSet(expression, context);
			if (expression.operator === 'and') {
				return (
					toBoolean(evalExpression(expression.left, context, rootContext)) &&
					toBoolean(evalExpression(expression.right, context, rootContext))
				);
			}
			if (expression.operator === 'or') {
				return (
					toBoolean(evalExpression(expression.left, context, rootContext)) ||
					toBoolean(evalExpression(expression.right, context, rootContext))
				);
			}
			if (expression.operator === '=' || expression.operator === '!=' || expression.operator === '<' || expression.operator === '>' || expression.operator === '<=' || expression.operator === '>=') {
				const left = evalExpression(expression.left, context, rootContext);
				const right = evalExpression(expression.right, context, rootContext);
				return compareValues(expression.operator, left, right);
			}
			const left = evalExpression(expression.left, context, rootContext);
			const right = evalExpression(expression.right, context, rootContext);
			return arithmetic(expression.operator, left, right);
		}
		case 'function':
			return evalFunction(expression.name, expression.args, context, rootContext);
	}
}

function firstNode(items: XPathItem[]): XPathItem | null {
	if (items.length === 0) return null;
	return [...items].sort((a, b) => a.order - b.order)[0];
}

function itemName(item: XPathItem | null): string {
	if (!item) return '';
	if (item.kind === 'attribute') return item.attribute.name;
	if (item.node.type === 'element') return item.node.name;
	return '';
}

function itemLocalName(item: XPathItem | null): string {
	const name = itemName(item);
	const colon = name.indexOf(':');
	return colon === -1 ? name : name.slice(colon + 1);
}

function xpathSubstring(value: string, start: number, length?: number): string {
	// pugixml is built in narrow-char mode, so XPath string positions are
	// UTF-8 byte offsets rather than UTF-16 code-unit offsets.
	const bytes = encoder.encode(value);
	const roundedStart = Math.floor(start + 0.5);
	if (Number.isNaN(roundedStart)) return '';

	if (length === undefined) {
		const first = Math.floor(roundedStart + 0.5);
		return decoder.decode(bytes.subarray(Math.max(first - 1, 0)));
	}

	const roundedLength = Math.floor(length + 0.5);
	if (Number.isNaN(roundedLength) || roundedLength <= 0) return '';

	const first = Math.floor(roundedStart + 0.5);
	const from = Math.max(first - 1, 0);
	const to = Math.max(first - 1 + roundedLength, 0);
	return decoder.decode(bytes.subarray(from, to));
}

function evalFunction(
	name: string,
	args: Expression[],
	context: XPathContext,
	rootContext: XPathContext,
): XPathValue {
	const arg = (index: number): XPathValue =>
		index < args.length ? evalExpression(args[index], context, rootContext) : '';
	const argString = (index: number): string => toStringValue(arg(index));
	const argNumber = (index: number): number => toNumberValue(arg(index));
	const argNodes = (index: number): XPathItem[] => (index < args.length ? evalNodeSet(args[index], context) : []);

	switch (name) {
		case 'last':
			return context.size;
		case 'position':
			return context.position;
		case 'count':
			return argNodes(0).length;
		case 'sum': {
			let total = 0;
			for (const item of argNodes(0)) total += stringToNumber(itemStringValue(item));
			return total;
		}
		case 'string':
			if (args.length === 0) return itemStringValue(context.item);
			return argString(0);
		case 'number':
			if (args.length === 0) return stringToNumber(itemStringValue(context.item));
			return argNumber(0);
		case 'boolean':
			if (args.length === 0) return true;
			return toBoolean(arg(0));
		case 'not':
			return !toBoolean(arg(0));
		case 'true':
			return true;
		case 'false':
			return false;
		case 'concat':
			if (args.length < 2) return '';
			return args.map((_, index) => argString(index)).join('');
		case 'starts-with':
			return argString(0).startsWith(argString(1));
		case 'contains':
			return argString(0).includes(argString(1));
		case 'substring-before': {
			const value = argString(0);
			const search = argString(1);
			const index = value.indexOf(search);
			return index === -1 ? '' : value.slice(0, index);
		}
		case 'substring-after': {
			const value = argString(0);
			const search = argString(1);
			const index = value.indexOf(search);
			return index === -1 ? '' : value.slice(index + search.length);
		}
		case 'substring':
			return xpathSubstring(argString(0), argNumber(1), args.length > 2 ? argNumber(2) : undefined);
		case 'string-length':
			return encoder.encode(args.length === 0 ? itemStringValue(context.item) : argString(0)).length;
		case 'normalize-space': {
			const value = args.length === 0 ? itemStringValue(context.item) : argString(0);
			return value.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, '').replace(/[ \t\r\n]+/g, ' ');
		}
		case 'translate': {
			const value = argString(0);
			const from = argString(1);
			const to = argString(2);
			let result = '';
			for (const char of value) {
				const index = from.indexOf(char);
				if (index === -1) result += char;
				else if (index < to.length) result += to[index];
			}
			return result;
		}
		case 'name':
			return itemName(args.length === 0 ? context.item : firstNode(argNodes(0)));
		case 'local-name':
			return itemLocalName(args.length === 0 ? context.item : firstNode(argNodes(0)));
		case 'namespace-uri':
			return '';
		case 'lang':
			return false;
		case 'floor':
			return Math.floor(argNumber(0));
		case 'ceiling':
			return Math.ceil(argNumber(0));
		case 'round':
			// XPath 1.0 round(): floor(x + 0.5), including negatives.
			return Math.floor(argNumber(0) + 0.5);
		case 'string-join': {
			const items = argNodes(0);
			const delimiter = args.length > 1 ? argString(1) : '';
			return items.map((item) => itemStringValue(item)).join(delimiter);
		}
		case 'raw': {
			const item = args.length === 0 ? context.item : firstNode(argNodes(0));
			if (!item) return '';
			if (item.kind === 'attribute') return item.attribute.value;
			const node = item.node;
			if (node.type === 'text' || node.type === 'cdata') return node.value;
			return serializeNode(node);
		}
		case 'upper-case':
			return mapAsciiBytes(argString(0), (byte) => (byte >= 0x61 && byte <= 0x7a ? byte - 32 : byte));
		case 'lower-case':
			return mapAsciiBytes(argString(0), (byte) => (byte >= 0x41 && byte <= 0x5a ? byte + 32 : byte));
		case 'title-case':
			return titleCase(argString(0));
		case 'camel-case':
			return camelCase(argString(0));
		case 'snake-case':
			return snakeCase(argString(0));
		default:
			return '';
	}
}

/* -------------------------------------------------------------------------- */
/* camaro's custom string functions (byte-oriented, like pugixml's C code)    */
/* -------------------------------------------------------------------------- */

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function mapAsciiBytes(value: string, transform: (byte: number) => number): string {
	const bytes = encoder.encode(value);
	for (let i = 0; i < bytes.length; i++) bytes[i] = transform(bytes[i]);
	return decoder.decode(bytes);
}

function isAsciiAlpha(byte: number): boolean {
	return (byte >= 0x41 && byte <= 0x5a) || (byte >= 0x61 && byte <= 0x7a);
}

function asciiLower(byte: number): number {
	return byte >= 0x41 && byte <= 0x5a ? byte + 32 : byte;
}

function asciiUpper(byte: number): number {
	return byte >= 0x61 && byte <= 0x7a ? byte - 32 : byte;
}

const TITLE_SYMBOLS = new Set(
	[33, 64, 35, 36, 37, 94, 38, 42, 47, 92, 60, 62, 44, 59, 123, 125, 124, 91, 93, 45, 95, 43, 61, 40, 41, 32].map(
		(byte) => byte,
	),
);

function titleCase(value: string): string {
	const bytes = encoder.encode(value);
	const output = new Uint8Array(bytes.length);
	let write = 0;
	let last = 0x20;

	for (const byte of bytes) {
		if (isAsciiAlpha(byte) && TITLE_SYMBOLS.has(last)) output[write++] = asciiUpper(byte);
		else output[write++] = asciiLower(byte);
		last = byte;
	}

	return decoder.decode(output.subarray(0, write));
}

function camelCase(value: string): string {
	const bytes = encoder.encode(value);
	const output = new Uint8Array(bytes.length);
	let write = 0;
	let shouldUpper = false;

	for (const byte of bytes) {
		if (isAsciiAlpha(byte)) {
			output[write++] = shouldUpper ? asciiUpper(byte) : asciiLower(byte);
			shouldUpper = false;
		} else if (byte === 0x20) {
			shouldUpper = true;
		}
	}

	return decoder.decode(output.subarray(0, write));
}

function snakeCase(value: string): string {
	const bytes = encoder.encode(value);
	const output = new Uint8Array(bytes.length);
	let write = 0;

	for (const byte of bytes) {
		if (isAsciiAlpha(byte)) output[write++] = asciiLower(byte);
		else if (byte === 0x20) output[write++] = 0x5f;
	}

	return decoder.decode(output.subarray(0, write));
}

/* -------------------------------------------------------------------------- */
/* Public helpers                                                             */
/* -------------------------------------------------------------------------- */

export function createDocumentContext(document: XmlNode): XPathContext {
	return { item: nodeItem(document), position: 1, size: 1 };
}

export function createNodeContext(node: XmlNode): XPathContext {
	return { item: nodeItem(rootNode(node)), position: 1, size: 1 };
}

export function createItemContext(item: XPathItem): XPathContext {
	return { item, position: 1, size: 1 };
}

export function evaluateString(expression: Expression, context: XPathContext): string {
	return toStringValue(evalExpression(expression, context, context));
}

export function evaluateNumber(expression: Expression, context: XPathContext): number {
	return toNumberValue(evalExpression(expression, context, context));
}

export function evaluateBoolean(expression: Expression, context: XPathContext): boolean {
	return toBoolean(evalExpression(expression, context, context));
}

export function evaluateNodeSet(expression: Expression, context: XPathContext): XPathItem[] {
	return evalNodeSet(expression, context);
}

export function nodeSetToString(items: XPathItem[]): string {
	return items.length ? itemStringValue(items[0]) : '';
}
