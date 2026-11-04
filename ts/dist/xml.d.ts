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
export type XmlElement = XmlNode & {
    type: 'element';
};
/**
 * Parse a UTF-8 XML string. Returns null for malformed markup (the equivalent
 * of a failed pugixml load), which camaro surfaces as an empty result.
 */
export declare function parseXml(source: string): XmlDocument | null;
export declare function toJsonValue(document: XmlDocument): Record<string, unknown>;
/** Serialise a node using pugixml's default print settings (tab indent). */
export declare function serializeNode(node: XmlNode): string;
/** Serialise a whole document for prettyPrint(). */
export declare function prettyPrintValue(document: XmlDocument, indentSize: number): string;
