import type { ParagraphBorders, ParagraphFormatting, RunFormatting, TextAlignment } from '../../types';
import type { UnsupportedFeatureLog } from './unsupported';
import {
  halfPointsToPt,
  lineValueToMultiplier,
  normalizeHexColor,
  normalizeHighlight,
  parseIntAttr,
  parseOnOff,
  twipsToPx,
} from './units';
import { attr, attributesOf, childrenOf, findChild, localName, tagOf, type XmlNode } from './xml';

/** Theme font slots, resolved from `word/theme/theme1.xml`. */
export interface ThemeFonts {
  major: string | null;
  minor: string | null;
}

const ALIGNMENT_MAP: Record<string, TextAlignment> = {
  left: 'left',
  start: 'left',
  center: 'center',
  centre: 'center',
  right: 'right',
  end: 'right',
  both: 'justify',
  justify: 'justify',
  distribute: 'justify',
};

/** Underline styles the editor can render faithfully; the rest flatten to one line. */
const PLAIN_UNDERLINES = new Set(['single', 'words']);

/**
 * Reads a `<w:rPr>` into run formatting.
 *
 * Every field stays optional: an absent element means "inherit from the style
 * chain", which is materially different from an explicit off, and the merge in
 * `mergeRunFormatting` depends on that distinction.
 */
export function parseRunProperties(
  rPr: XmlNode | undefined,
  themeFonts: ThemeFonts,
  unsupported: UnsupportedFeatureLog,
): RunFormatting {
  const formatting: RunFormatting = {};
  if (!rPr) return formatting;

  for (const child of childrenOf(rPr)) {
    const tag = tagOf(child);
    if (tag === null) continue;
    const name = localName(tag);
    const attrs = attributesOf(child);

    switch (name) {
      case 'b':
        formatting.bold = parseOnOff(attrs);
        break;
      case 'i':
        formatting.italic = parseOnOff(attrs);
        break;
      case 'strike':
        formatting.strike = parseOnOff(attrs);
        break;
      case 'dstrike':
        formatting.strike = parseOnOff(attrs);
        unsupported.add('Double strikethrough is shown as a single strikethrough.');
        break;
      case 'u': {
        const value = attr(child, 'val') ?? 'single';
        formatting.underline = value !== 'none';
        if (formatting.underline && !PLAIN_UNDERLINES.has(value)) {
          unsupported.add(`Underline style "${value}" is shown as a plain underline.`);
        }
        break;
      }
      case 'vertAlign': {
        const value = attr(child, 'val');
        if (value === 'superscript') formatting.vertAlign = 'super';
        else if (value === 'subscript') formatting.vertAlign = 'sub';
        break;
      }
      case 'rFonts': {
        const explicit = attr(child, 'ascii') ?? attr(child, 'hAnsi') ?? attr(child, 'cs');
        if (explicit) {
          formatting.fontFamily = explicit;
          break;
        }
        // Themed fonts name a slot rather than a typeface; resolve via theme1.xml.
        const themed = attr(child, 'asciiTheme') ?? attr(child, 'hAnsiTheme');
        if (themed) {
          const slot = themed.startsWith('major') ? themeFonts.major : themeFonts.minor;
          if (slot) formatting.fontFamily = slot;
          else unsupported.add('Theme fonts could not be resolved and fall back to the default font.');
        }
        break;
      }
      case 'sz': {
        const halfPoints = parseIntAttr(attr(child, 'val'));
        if (halfPoints !== null) formatting.fontSize = halfPointsToPt(halfPoints);
        break;
      }
      case 'color': {
        const color = normalizeHexColor(attr(child, 'val'));
        if (color) formatting.color = color;
        else if (attr(child, 'themeColor')) {
          unsupported.add('Theme text colours fall back to the default text colour.');
        }
        break;
      }
      case 'highlight': {
        const highlight = normalizeHighlight(attr(child, 'val'));
        if (highlight) formatting.highlight = highlight;
        break;
      }
      case 'shd': {
        // Character shading is a second, independent way to colour a run's
        // background. It only wins where no explicit highlight was set.
        const fill = normalizeHexColor(attr(child, 'fill'));
        if (fill && formatting.highlight === undefined) formatting.highlight = fill;
        break;
      }
      case 'caps':
      case 'smallCaps':
        if (parseOnOff(attrs)) unsupported.add('Capitalisation effects (small caps / all caps) were dropped.');
        break;
      default:
        break;
    }
  }

  return formatting;
}

/** Later arguments win, but only for keys they actually define. */
export function mergeRunFormatting(...layers: (RunFormatting | undefined)[]): RunFormatting {
  const result: RunFormatting = {};
  for (const layer of layers) {
    if (!layer) continue;
    for (const [key, value] of Object.entries(layer)) {
      if (value !== undefined) {
        (result as Record<string, unknown>)[key] = value;
      }
    }
  }
  return result;
}

/** Drops marks that merely restate the document defaults, keeping the model lean. */
export function stripDefaults(formatting: RunFormatting, defaults: RunFormatting): RunFormatting {
  const result: RunFormatting = {};
  for (const [key, value] of Object.entries(formatting)) {
    if (value === undefined) continue;
    if (value === false) continue; // an explicit "off" is the same as absent here
    if (defaults[key as keyof RunFormatting] === value) continue;
    (result as Record<string, unknown>)[key] = value;
  }
  return result;
}

export interface ParsedParagraphProperties {
  formatting: Partial<ParagraphFormatting>;
  styleId: string | null;
  numbering: { numId: number; level: number } | null;
}

export function parseParagraphProperties(
  pPr: XmlNode | undefined,
  unsupported: UnsupportedFeatureLog,
): ParsedParagraphProperties {
  const formatting: Partial<ParagraphFormatting> = {};
  let styleId: string | null = null;
  let numbering: { numId: number; level: number } | null = null;

  if (!pPr) return { formatting, styleId, numbering };

  for (const child of childrenOf(pPr)) {
    const tag = tagOf(child);
    if (tag === null) continue;
    const name = localName(tag);

    switch (name) {
      case 'pStyle':
        styleId = attr(child, 'val') ?? null;
        break;
      case 'jc': {
        const value = attr(child, 'val')?.toLowerCase();
        if (value && ALIGNMENT_MAP[value]) formatting.align = ALIGNMENT_MAP[value];
        break;
      }
      case 'ind': {
        const left = parseIntAttr(attr(child, 'left') ?? attr(child, 'start'));
        const right = parseIntAttr(attr(child, 'right') ?? attr(child, 'end'));
        const firstLine = parseIntAttr(attr(child, 'firstLine'));
        const hanging = parseIntAttr(attr(child, 'hanging'));

        if (left !== null) formatting.indentLeft = twipsToPx(left);
        if (right !== null) formatting.indentRight = twipsToPx(right);
        // A hanging indent is a negative first-line indent; the two attributes
        // are mutually exclusive in practice, and hanging takes precedence.
        if (hanging !== null) formatting.indentFirstLine = -twipsToPx(hanging);
        else if (firstLine !== null) formatting.indentFirstLine = twipsToPx(firstLine);
        break;
      }
      case 'spacing': {
        const before = parseIntAttr(attr(child, 'before'));
        const after = parseIntAttr(attr(child, 'after'));
        const line = parseIntAttr(attr(child, 'line'));
        const rule = attr(child, 'lineRule') ?? 'auto';

        if (before !== null) formatting.spaceBefore = twipsToPx(before);
        if (after !== null) formatting.spaceAfter = twipsToPx(after);
        if (line !== null) {
          if (rule === 'auto') {
            formatting.lineHeight = lineValueToMultiplier(line);
          } else {
            // "exact"/"atLeast" are absolute heights; the model carries a
            // multiplier, so approximating would misreport the document.
            unsupported.add(`Fixed line spacing ("${rule}") was replaced with single spacing.`);
          }
        }
        break;
      }
      case 'numPr': {
        const kids = childrenOf(child);
        const numId = parseIntAttr(attr(findChild(kids, 'numId') ?? {}, 'val'));
        const level = parseIntAttr(attr(findChild(kids, 'ilvl') ?? {}, 'val')) ?? 0;
        if (numId !== null && numId > 0) numbering = { numId, level };
        break;
      }
      case 'pBdr': {
        const borders = parseBorders(child);
        if (borders) formatting.borders = borders;
        break;
      }
      default:
        break;
    }
  }

  return { formatting, styleId, numbering };
}

function parseBorders(pBdr: XmlNode): ParagraphBorders | null {
  const borders: ParagraphBorders = { top: false, bottom: false, left: false, right: false };
  let any = false;

  for (const edge of childrenOf(pBdr)) {
    const tag = tagOf(edge);
    if (tag === null) continue;
    const name = localName(tag);
    const style = attr(edge, 'val');
    // `val="none"`/`"nil"` is an explicit suppression, not a border.
    if (style === 'none' || style === 'nil') continue;

    if (name === 'top' || name === 'bottom' || name === 'left' || name === 'right') {
      borders[name] = true;
      any = true;
    } else if (name === 'start') {
      borders.left = true;
      any = true;
    } else if (name === 'end') {
      borders.right = true;
      any = true;
    }
  }

  return any ? borders : null;
}
