/**
 * camaro template parsing and evaluation.
 *
 * Templates use the same JSON-shaped syntax as upstream camaro. A string leaf
 * is an XPath expression; the first character `#` makes it a string constant;
 * an array is a projection `[xpath, shape]`; an object describes the output
 * object. The small fast paths below mirror the ones in src/camaro.cpp so that
 * simple navigation keeps pugixml's exact scalar semantics.
 */
import { XPathContext } from './xpath';
export type TemplateNode = TemplateObject | TemplateArray | TemplateString;
export interface TemplateMember {
    key: string;
    value: TemplateNode;
}
export interface TemplateObject {
    kind: 'object';
    members: TemplateMember[];
}
export interface TemplateArray {
    kind: 'array';
    items: TemplateNode[];
}
export interface TemplateString {
    kind: 'string';
    value: string;
}
export interface EvaluationResult {
    valid: boolean;
    value: unknown;
}
/** Parse the JSON-serialised template into camaro's compact representation. */
export declare function parseTemplate(value: unknown): TemplateNode | null;
export declare function evaluateTemplate(template: TemplateNode, context: XPathContext): EvaluationResult;
