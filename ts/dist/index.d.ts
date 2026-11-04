/**
 * camaro - TypeScript implementation
 *
 * Public API compatible with upstream camaro: transform(), toJson(),
 * prettyPrint() and destroy().
 */
export type XmlInput = string | Uint8Array | ArrayBuffer;
type Mapped<T> = T extends readonly [] ? [] : T extends '' ? '' : T extends `boolean(${string}` ? boolean : T extends `count(${string}` ? number : T extends `ceiling(${string}` ? number : T extends `floor(${string}` ? number : T extends `number(${string}` ? number : T extends `sum(${string}` ? number : T extends string ? string : T extends readonly [string, infer X] ? X extends Readonly<Record<string, any>> ? Transformed<X>[] : Mapped<X>[] : never;
export type Transformed<T extends Record<string, any>> = {
    [K in keyof T]: Mapped<T[K]>;
};
type TransformResult<T> = T extends readonly [string, any] ? Mapped<T> : T extends Record<string, any> ? Transformed<T> : never;
/**
 * Convert XML to JSON based on a template object.
 */
export declare function transform<const T>(xml: XmlInput, template: T): Promise<TransformResult<T>>;
/**
 * Convert XML to JSON.
 */
export declare function toJson(xml: XmlInput): Promise<any>;
/**
 * Pretty print an XML string.
 */
export declare function prettyPrint(xml: XmlInput, opts?: {
    indentSize: number;
}): Promise<string>;
/**
 * Release resources. The TypeScript implementation is synchronous, so this is
 * only kept for API compatibility.
 */
export declare function destroy(): Promise<void>;
export type { XmlDocument } from './xml';
