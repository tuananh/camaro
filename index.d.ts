type Mapped<T> = T extends readonly []
  ? []
  : T extends ""
  ? ""
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

export type XmlInput = string | Uint8Array | ArrayBuffer | Buffer;

export function prettyPrint(
  xml: XmlInput,
  opts?: { indentSize: number }
): Promise<string>;
export function toJson(xml: XmlInput): Promise<any>;
export function transform<const T extends Record<string, any>>(
  xml: XmlInput,
  template: T
): Promise<Transformed<T>>;
export function destroy(): Promise<void>;
