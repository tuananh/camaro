/**
 * A compact XPath 1.0 engine.
 *
 * camaro templates are XPath expressions, so the TypeScript port needs a real
 * (if intentionally small) XPath implementation. This module supports the
 * axes, node tests, operators and core functions used by camaro templates,
 * plus camaro's extra string functions. Unknown/invalid expressions evaluate
 * to an empty result, matching pugixml's error nodes.
 */
import { XmlAttribute, XmlNode } from './xml';
export type XPathItem = {
    kind: 'node';
    node: XmlNode;
    order: number;
} | {
    kind: 'attribute';
    attribute: XmlAttribute;
    order: number;
};
export type XPathValue = string | number | boolean | XPathItem[];
export interface XPathContext {
    item: XPathItem;
    position: number;
    size: number;
}
type Axis = 'ancestor' | 'ancestor-or-self' | 'attribute' | 'child' | 'descendant' | 'descendant-or-self' | 'following' | 'following-sibling' | 'namespace' | 'parent' | 'preceding' | 'preceding-sibling' | 'self';
type NodeTest = {
    kind: 'name';
    name: string;
} | {
    kind: 'any';
} | {
    kind: 'node';
} | {
    kind: 'text';
} | {
    kind: 'comment';
} | {
    kind: 'processing-instruction';
    target?: string;
};
interface Predicate {
    expression: Expression;
}
interface Step {
    axis: Axis;
    test: NodeTest;
    predicates: Predicate[];
}
export type Expression = {
    type: 'literal';
    value: string;
} | {
    type: 'number';
    value: number;
} | {
    type: 'path';
    start?: Expression;
    absolute: boolean;
    steps: Step[];
} | {
    type: 'filter';
    expression: Expression;
    predicates: Predicate[];
} | {
    type: 'function';
    name: string;
    args: Expression[];
} | {
    type: 'unary';
    operator: '-';
    expression: Expression;
} | {
    type: 'binary';
    operator: string;
    left: Expression;
    right: Expression;
};
export declare function parseXPath(source: string): Expression | null;
export declare function itemStringValue(item: XPathItem): string;
export declare function stringToNumber(value: string): number;
export declare function numberToString(value: number): string;
export declare function createDocumentContext(document: XmlNode): XPathContext;
export declare function createNodeContext(node: XmlNode): XPathContext;
export declare function createItemContext(item: XPathItem): XPathContext;
export declare function evaluateString(expression: Expression, context: XPathContext): string;
export declare function evaluateNumber(expression: Expression, context: XPathContext): number;
export declare function evaluateBoolean(expression: Expression, context: XPathContext): boolean;
export declare function evaluateNodeSet(expression: Expression, context: XPathContext): XPathItem[];
export declare function nodeSetToString(items: XPathItem[]): string;
export {};
