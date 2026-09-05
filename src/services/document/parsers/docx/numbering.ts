import type { ListInfo } from '../../types';
import { parseIntAttr } from './units';
import { attr, childrenOf, descend, findChild, parseXml } from './xml';

/**
 * `numbering.xml`, reduced to the question the model actually asks:
 * "is this paragraph a bullet or a number, and how deep?"
 *
 * Word models numbering as a two-hop indirection — a paragraph names a `numId`,
 * which points at an `abstractNumId`, which owns the per-level definitions.
 * Custom bullet glyphs, restart rules and level text are deliberately not
 * carried: the editor renders list markers itself.
 */

type ListKind = ListInfo['kind'];

const ORDERED_FORMATS = new Set([
  'decimal',
  'decimalZero',
  'lowerLetter',
  'upperLetter',
  'lowerRoman',
  'upperRoman',
  'ordinal',
  'ordinalText',
  'cardinalText',
  'decimalEnclosedCircle',
  'decimalEnclosedParen',
]);

export class NumberingTable {
  /** `${numId}:${level}` -> kind. */
  private readonly levels: Map<string, ListKind>;
  /** numId -> its abstract definition id, for levels not explicitly defined. */
  private readonly fallback: Map<number, ListKind>;

  constructor(levels: Map<string, ListKind>, fallback: Map<number, ListKind>) {
    this.levels = levels;
    this.fallback = fallback;
  }

  lookup(numId: number, level: number): ListInfo | null {
    const kind = this.levels.get(`${numId}:${level}`) ?? this.fallback.get(numId);
    if (!kind) return null;
    // The editor supports three nesting depths; deeper levels clamp rather than
    // flattening to the top level, which would lose the outline entirely.
    return { kind, level: Math.min(Math.max(level, 0), 2) };
  }

  static empty(): NumberingTable {
    return new NumberingTable(new Map(), new Map());
  }
}

export function parseNumbering(numberingXml: string | null): NumberingTable {
  if (!numberingXml) return NumberingTable.empty();

  let root;
  try {
    root = parseXml(numberingXml);
  } catch {
    // Numbering is an enhancement; a broken part degrades lists to paragraphs
    // rather than failing the document.
    return NumberingTable.empty();
  }

  const numberingRoot = descend(root, 'numbering');

  // abstractNumId -> level -> kind
  const abstract = new Map<number, Map<number, ListKind>>();
  for (const node of numberingRoot) {
    const abstractId = parseIntAttr(attr(node, 'abstractNumId'));
    if (abstractId === null) continue;
    // `w:num` also carries an abstractNumId *child*; only `w:abstractNum`
    // carries it as an attribute alongside `w:lvl` children.
    const levelNodes = childrenOf(node).filter((child) => 'w:lvl' in child || 'lvl' in child);
    if (levelNodes.length === 0) continue;

    const levels = new Map<number, ListKind>();
    for (const lvl of levelNodes) {
      const ilvl = parseIntAttr(attr(lvl, 'ilvl')) ?? 0;
      const numFmtNode = findChild(childrenOf(lvl), 'numFmt');
      const format = numFmtNode ? attr(numFmtNode, 'val') : undefined;
      if (!format || format === 'none') continue;
      levels.set(ilvl, ORDERED_FORMATS.has(format) ? 'ordered' : 'bullet');
    }
    abstract.set(abstractId, levels);
  }

  const levels = new Map<string, ListKind>();
  const fallback = new Map<number, ListKind>();

  for (const node of numberingRoot) {
    const numId = parseIntAttr(attr(node, 'numId'));
    if (numId === null) continue;
    const abstractRef = findChild(childrenOf(node), 'abstractNumId');
    if (!abstractRef) continue;
    const abstractId = parseIntAttr(attr(abstractRef, 'val'));
    if (abstractId === null) continue;

    const definition = abstract.get(abstractId);
    if (!definition) continue;

    for (const [level, kind] of definition) {
      levels.set(`${numId}:${level}`, kind);
    }
    const firstLevel = definition.get(0) ?? [...definition.values()][0];
    if (firstLevel) fallback.set(numId, firstLevel);
  }

  return new NumberingTable(levels, fallback);
}
