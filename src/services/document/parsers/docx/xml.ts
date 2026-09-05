import { XMLParser } from 'fast-xml-parser';

/**
 * A thin, order-preserving view over OOXML.
 *
 * `preserveOrder` is mandatory here: a paragraph's meaning is the sequence of
 * its runs, and the default object-merging mode destroys that ordering.
 * In this mode fast-xml-parser emits nodes as single-key objects, with
 * attributes hoisted onto a sibling `:@` key.
 */

export type XmlAttributes = Record<string, string>;
export interface XmlNode {
  [key: string]: unknown;
}

const ATTRS_KEY = ':@';
const TEXT_KEY = '#text';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  preserveOrder: true,
  // Whitespace inside <w:t> is significant; trimming would eat spaces between runs.
  trimValues: false,
  parseTagValue: false,
  parseAttributeValue: false,
  processEntities: true,
});

/**
 * A conforming .docx never carries a DTD. Rejecting one outright removes the
 * entire XXE / entity-expansion ("billion laughs") class of attacks before any
 * parsing happens, which is cheaper and more certain than trying to defuse it.
 */
export function assertNoDoctype(xml: string): void {
  if (/<!DOCTYPE/i.test(xml) || /<!ENTITY/i.test(xml)) {
    throw new Error('XML declares a DTD or entities, which is not valid in a .docx part.');
  }
}

export function parseXml(xml: string): XmlNode[] {
  assertNoDoctype(xml);
  return parser.parse(xml) as XmlNode[];
}

/** Strips the namespace prefix: `w:pPr` -> `pPr`. */
export function localName(tag: string): string {
  const index = tag.indexOf(':');
  return index === -1 ? tag : tag.slice(index + 1);
}

/** The single element key of a node, ignoring the attribute and text keys. */
export function tagOf(node: XmlNode): string | null {
  for (const key of Object.keys(node)) {
    if (key === ATTRS_KEY || key === TEXT_KEY) continue;
    return key;
  }
  return null;
}

export function childrenOf(node: XmlNode): XmlNode[] {
  const tag = tagOf(node);
  if (tag === null) return [];
  const value = node[tag];
  return Array.isArray(value) ? (value as XmlNode[]) : [];
}

export function attributesOf(node: XmlNode): XmlAttributes {
  const attrs = node[ATTRS_KEY];
  return (attrs && typeof attrs === 'object' ? attrs : {}) as XmlAttributes;
}

/** Reads an attribute by local name, so `w:val` and a bare `val` both match. */
export function attr(node: XmlNode, name: string): string | undefined {
  const attrs = attributesOf(node);
  for (const [key, value] of Object.entries(attrs)) {
    if (localName(key) === name) return String(value);
  }
  return undefined;
}

export function textOf(node: XmlNode): string {
  const value = node[TEXT_KEY];
  return value === undefined || value === null ? '' : String(value);
}

export function isTextNode(node: XmlNode): boolean {
  return tagOf(node) === null && TEXT_KEY in node;
}

/** All direct children matching a local name. */
export function findChildren(nodes: XmlNode[], name: string): XmlNode[] {
  return nodes.filter((node) => {
    const tag = tagOf(node);
    return tag !== null && localName(tag) === name;
  });
}

export function findChild(nodes: XmlNode[], name: string): XmlNode | undefined {
  return findChildren(nodes, name)[0];
}

/** Descends a chain of local names, e.g. `descend(root, 'document', 'body')`. */
export function descend(nodes: XmlNode[], ...path: string[]): XmlNode[] {
  let current = nodes;
  for (const name of path) {
    const next = findChild(current, name);
    if (!next) return [];
    current = childrenOf(next);
  }
  return current;
}
