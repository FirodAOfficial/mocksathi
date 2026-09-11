/**
 * Cell formatting, interned.
 *
 * A cell holds a `StyleId` — a number — not a style object. Formatting a column
 * is one of the commonest things anyone does in a spreadsheet, and a column is
 * a million cells; if each carried its own `{ bold: true, ... }` the workbook
 * would be a million near-identical objects and the garbage collector would
 * spend the session walking them.
 *
 * The registry hands out one id per distinct style and never mutates a style in
 * place. Changing a cell's formatting means resolving to a *different* id, so
 * two cells that look alike really do share one object — which is also what
 * makes style comparison a integer compare rather than a deep equal.
 */

import type { TextAlignment } from '@/services/document/types';

export type VerticalAlignment = 'top' | 'middle' | 'bottom';

export type BorderStyle = 'thin' | 'medium' | 'thick' | 'dashed' | 'dotted' | 'double';

export interface BorderEdge {
  style: BorderStyle;
  /** `#rrggbb`. */
  color: string;
}

export interface CellBorders {
  top?: BorderEdge;
  right?: BorderEdge;
  bottom?: BorderEdge;
  left?: BorderEdge;
}

/**
 * Everything that decides how a cell looks.
 *
 * Every field is optional and absence means "inherited default", so the empty
 * style — the one every blank cell shares — is `{}`, and a workbook of a
 * million untouched cells interns exactly one style.
 */
export interface CellStyle {
  fontFamily?: string;
  /** Points. */
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  /** `#rrggbb`. */
  fontColor?: string;
  /** `#rrggbb`. */
  fillColor?: string;
  horizontalAlignment?: TextAlignment;
  verticalAlignment?: VerticalAlignment;
  wrapText?: boolean;
  /**
   * Excel's Effects: text raised or lowered relative to the baseline.
   *
   * A cell-wide setting here, not a per-character one. Excel allows it per
   * character inside a cell; this build formats whole cells, which is what
   * every question asking for it actually needs.
   */
  textEffect?: 'subscript' | 'superscript';
  /** Degrees, -90..90, as Excel's orientation control produces. */
  textRotation?: number;
  /** Indent steps, as the ribbon's increase/decrease indent applies. */
  indent?: number;
  borders?: CellBorders;
  /** An Excel number-format code, e.g. `0.00`, `#,##0`, `dd/mm/yyyy`. */
  numberFormat?: string;
}

export type StyleId = number;

/** Every blank cell resolves here, and it is always id 0. */
export const DEFAULT_STYLE_ID: StyleId = 0;

export const DEFAULT_STYLE: CellStyle = Object.freeze({});

/**
 * Excel's own defaults, used for rendering rather than stored on cells.
 *
 * A cell with no `fontFamily` renders in Calibri 11 — but storing that on every
 * cell would defeat the interning, so the blank style stays empty and the
 * renderer falls back to these.
 */
export const DEFAULT_FONT_FAMILY = 'Calibri';
export const DEFAULT_FONT_SIZE_PT = 11;

/**
 * Canonical JSON for a style, used as the interning key.
 *
 * Keys are sorted so `{bold, italic}` and `{italic, bold}` produce the same
 * string, and absent/undefined fields are dropped so `{bold: undefined}` interns
 * as the default style rather than as a second, identical-looking one.
 */
function styleKey(style: CellStyle): string {
  const entries = Object.entries(style)
    .filter(([, value]) => value !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  if (entries.length === 0) return '{}';

  // `borders` is the only nested value; JSON.stringify with a sorted replacer
  // handles it without a bespoke walker.
  return JSON.stringify(entries, (_key, value: unknown) =>
    isPlainObject(value)
      ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => (a < b ? -1 : 1)))
      : value,
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export class StyleRegistry {
  private readonly styles: CellStyle[] = [DEFAULT_STYLE];
  private readonly ids = new Map<string, StyleId>([['{}', DEFAULT_STYLE_ID]]);

  /** The style behind an id. Unknown ids resolve to the default rather than throwing. */
  get(id: StyleId): CellStyle {
    return this.styles[id] ?? DEFAULT_STYLE;
  }

  /** The id for a style, creating one only if this exact style is new. */
  intern(style: CellStyle): StyleId {
    const key = styleKey(style);
    const existing = this.ids.get(key);
    if (existing !== undefined) return existing;

    // Frozen: an id is a promise that the style behind it never changes. A
    // caller mutating one would silently restyle every cell that shares it.
    const id = this.styles.length;
    this.styles.push(Object.freeze({ ...style }));
    this.ids.set(key, id);
    return id;
  }

  /**
   * The id for `base` with `changes` applied on top.
   *
   * This is what a ribbon button calls: "bold the selection" is
   * `derive(cell.styleId, { bold: true })` per cell, and cells that shared a
   * style before still share one after.
   *
   * An explicit `undefined` in `changes` clears that property — which is how
   * "no fill" differs from "leave the fill alone".
   */
  derive(base: StyleId, changes: Partial<CellStyle>): StyleId {
    const merged: CellStyle = { ...this.get(base) };

    for (const [key, value] of Object.entries(changes)) {
      if (value === undefined) delete merged[key as keyof CellStyle];
      else Object.assign(merged, { [key]: value });
    }

    return this.intern(merged);
  }

  /** How many distinct styles exist. Interning is only worth it if this stays small. */
  get size(): number {
    return this.styles.length;
  }
}
