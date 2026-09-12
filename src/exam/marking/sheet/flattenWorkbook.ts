import { cellKey, keyToAddress, type CellAddress, type RangeAddress } from '@/spreadsheet/model/address';
import type { CellValue } from '@/spreadsheet/model/Cell';
import type { CellStyle } from '@/spreadsheet/model/styles';
import type { WorkbookSnapshot } from '@/spreadsheet/model/snapshot';
import {
  DEFAULT_SHEET_VIEW,
  type ColumnProps,
  type FrozenPanes,
  type RowProps,
  type SheetView,
} from '@/spreadsheet/model/Worksheet';

/**
 * A submitted workbook, projected into the one shape marking compares.
 *
 * The spreadsheet counterpart of `flatten.ts`, and it exists for the same
 * reason: the same visible sheet has many valid representations. A cell may
 * carry `{ bold: true }` or `{ bold: true, italic: false }`; a colour may be
 * written `#FF0000` or `#ff0000`; a font may arrive with a stray space. None of
 * those are differences a candidate made, and none of them survive this
 * projection — so a comparison here answers "does this sheet look the same",
 * not "was it built the same way".
 *
 * Cells are keyed by the same packed integer the model uses, so a lookup during
 * marking costs what a lookup during rendering costs.
 */

export interface FlatCell {
  value: CellValue;
  formula?: string;
  /** Canonical: absent and default-valued properties are dropped. */
  style: CellStyle;
}

export interface FlatSheet {
  name: string;
  cells: Map<number, FlatCell>;
  rows: Map<number, RowProps>;
  columns: Map<number, ColumnProps>;
  merges: RangeAddress[];
  frozen: FrozenPanes;
  view: SheetView;
  printArea: RangeAddress | null;
}

export interface FlatWorkbook {
  sheets: FlatSheet[];
}

/**
 * A style with nothing in it that does not change how the cell looks.
 *
 * `bold: false` is not formatting, it is the absence of formatting — and a
 * candidate who bolds a cell and unbolds it must end up equal to one who never
 * touched it. Colours are compared case-insensitively for the same reason: the
 * picker and a parsed workbook disagree on case, never on the colour.
 */
export function canonicalStyle(style: CellStyle | undefined): CellStyle {
  if (!style) return {};

  const out: CellStyle = {};

  if (style.bold) out.bold = true;
  if (style.italic) out.italic = true;
  if (style.underline) out.underline = true;
  if (style.strikethrough) out.strikethrough = true;
  if (style.wrapText) out.wrapText = true;

  if (style.fontFamily?.trim()) out.fontFamily = style.fontFamily.trim();
  if (typeof style.fontSize === 'number') out.fontSize = style.fontSize;
  if (style.fontColor) out.fontColor = style.fontColor.toLowerCase();
  if (style.fillColor) out.fillColor = style.fillColor.toLowerCase();
  if (style.textEffect) out.textEffect = style.textEffect;
  if (style.horizontalAlignment) out.horizontalAlignment = style.horizontalAlignment;
  if (style.verticalAlignment) out.verticalAlignment = style.verticalAlignment;
  if (style.numberFormat && style.numberFormat !== 'General') out.numberFormat = style.numberFormat;

  // Zero indent and zero rotation are the default, not a formatting choice.
  if (style.indent) out.indent = style.indent;
  if (style.textRotation) out.textRotation = style.textRotation;

  if (style.borders) {
    const borders: NonNullable<CellStyle['borders']> = {};
    for (const edge of ['top', 'right', 'bottom', 'left'] as const) {
      const value = style.borders[edge];
      if (value) borders[edge] = { style: value.style, color: value.color.toLowerCase() };
    }
    if (Object.keys(borders).length > 0) out.borders = borders;
  }

  return out;
}

/** Deep equality over canonical styles. Both sides must already be canonical. */
export function stylesEqual(a: CellStyle, b: CellStyle): boolean {
  return styleKey(a) === styleKey(b);
}

/**
 * Whether two styles agree on everything except the named properties.
 *
 * This is the spreadsheet's `marksEqualExcept`: the mechanism behind "and
 * nothing else". A question that asks for bold exempts `bold` and nothing more,
 * so an extra fill still fails.
 */
export function stylesEqualExcept(
  a: CellStyle,
  b: CellStyle,
  ignore: ReadonlySet<keyof CellStyle>,
): boolean {
  const left = strip(a, ignore);
  const right = strip(b, ignore);
  return styleKey(left) === styleKey(right);
}

function strip(style: CellStyle, ignore: ReadonlySet<keyof CellStyle>): CellStyle {
  if (ignore.size === 0) return style;

  const out: CellStyle = { ...style };
  for (const key of ignore) delete out[key];
  return out;
}

/** Sorted-key JSON, so property order cannot make two equal styles differ. */
function styleKey(style: CellStyle): string {
  const entries = Object.entries(style)
    .filter(([, value]) => value !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  return JSON.stringify(entries, (_key, value: unknown) =>
    isPlainObject(value)
      ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => (a < b ? -1 : 1)))
      : value,
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function flattenWorkbook(snapshot: WorkbookSnapshot): FlatWorkbook {
  return {
    sheets: snapshot.sheets.map((sheet) => ({
      name: sheet.name,
      cells: new Map(
        sheet.cells.map((cell) => [
          cellKey(cell.row, cell.col),
          {
            value: cell.value,
            ...(cell.formula === undefined ? {} : { formula: cell.formula }),
            style: canonicalStyle(cell.style),
          },
        ]),
      ),
      rows: new Map(sheet.rows.map(([row, props]) => [row, { ...props }])),
      columns: new Map(sheet.columns.map(([col, props]) => [col, { ...props }])),
      merges: sheet.merges.map((merge) => ({ start: { ...merge.start }, end: { ...merge.end } })),
      frozen: { ...sheet.frozen },
      view: { ...DEFAULT_SHEET_VIEW, ...sheet.view },
      printArea: sheet.printArea
        ? { start: { ...sheet.printArea.start }, end: { ...sheet.printArea.end } }
        : null,
    })),
  };
}

/**
 * The sheet every criterion addresses unless it says otherwise.
 *
 * Every question in this paper works on one sheet. Naming it explicitly in each
 * criterion would be noise that could also be got wrong; a rubric that needs a
 * second sheet can address it by name.
 */
export function sheetOf(workbook: FlatWorkbook, name?: string): FlatSheet | undefined {
  if (name === undefined) return workbook.sheets[0];
  const wanted = name.toLowerCase();
  return workbook.sheets.find((sheet) => sheet.name.toLowerCase() === wanted);
}

export function cellAt(sheet: FlatSheet, address: CellAddress): FlatCell | undefined {
  return sheet.cells.get(cellKey(address.row, address.col));
}

/** Every address holding something, for the "nothing else changed" sweep. */
export function occupiedAddresses(sheet: FlatSheet): CellAddress[] {
  return [...sheet.cells.keys()].map(keyToAddress);
}
