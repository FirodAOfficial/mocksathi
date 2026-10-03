import { formatCellValue } from '@/spreadsheet/model/format';
import { DEFAULT_FONT_FAMILY, DEFAULT_FONT_SIZE_PT, type CellStyle } from '@/spreadsheet/model/styles';
import { DEFAULT_COLUMN_WIDTH, DEFAULT_ROW_HEIGHT } from '@/spreadsheet/model/Worksheet';
import type { WorkbookStore } from '@/spreadsheet/WorkbookStore';

/**
 * AutoFit: the width a column needs, or the height a row needs, to show what
 * is in it — what double-clicking a heading's edge does in Excel, and what
 * Home > Format's AutoFit entries do.
 *
 * Text is measured with the browser's own text metrics in each cell's own
 * font, so a bold 14pt heading widens its column by what it really takes. In
 * an environment with no canvas (tests), a per-character estimate stands in.
 */

/** Horizontal room a cell keeps around its text: the 3px padding each side, and the gridline. */
const CELL_PADDING_X = 8;
/** Vertical room around a line of text: with the line height below, Calibri 11 fits Excel's 20px row. */
const CELL_PADDING_Y = 3;
/** Pixels per indent step, as the grid draws them. */
const INDENT_PX = 9;
/** Excel's narrowest AutoFit column: wide enough to grab. */
const MIN_COLUMN_WIDTH = 12;
const MAX_COLUMN_WIDTH = 1000;
const MAX_ROW_HEIGHT = 409;

let context: CanvasRenderingContext2D | null | undefined;

function canvas(): CanvasRenderingContext2D | null {
  if (context !== undefined) return context;
  try {
    context = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');
  } catch {
    context = null;
  }
  return context;
}

function fontPt(style: CellStyle): number {
  const size = style.fontSize ?? DEFAULT_FONT_SIZE_PT;
  return style.textEffect ? size * 0.7 : size;
}

/** The text's width in CSS pixels, in the cell's font. */
export function textWidth(text: string, style: CellStyle): number {
  const size = fontPt(style);
  const ctx = canvas();
  if (ctx) {
    ctx.font = `${style.italic ? 'italic ' : ''}${style.bold ? '700 ' : ''}${size}pt ${style.fontFamily ?? DEFAULT_FONT_FAMILY}, sans-serif`;
    return ctx.measureText(text).width;
  }
  // Calibri 11 averages about 7px a character.
  return text.length * 7 * (size / DEFAULT_FONT_SIZE_PT) * (style.bold ? 1.08 : 1);
}

/** One line of the cell's font, in CSS pixels. */
function lineHeight(style: CellStyle): number {
  return ((fontPt(style) * 96) / 72) * 1.1;
}

/** The width that shows every value in the column, ignoring cells merged across columns. */
export function autoFitColumnWidth(store: WorkbookStore, col: number): number {
  const sheet = store.activeSheet();
  let widest = 0;

  for (const [address, cell] of sheet.entries()) {
    if (address.col !== col || cell.value === null) continue;
    if (sheet.rows.get(address.row)?.hidden) continue;
    const merge = sheet.mergeCovering(address.row, col);
    if (merge && merge.start.col !== merge.end.col) continue;

    const style = store.workbook.styles.get(cell.styleId);
    const text = formatCellValue(cell.value, style.numberFormat);
    let width = textWidth(text, style);

    // Turned text takes the horizontal part of its length; wrapped text keeps
    // the column it has — AutoFit widens to the longest word, not the paragraph.
    if (style.textRotation) width = Math.abs(Math.cos((style.textRotation * Math.PI) / 180)) * width + lineHeight(style);
    else if (style.wrapText) width = Math.max(...text.split(/\s+/).map((word) => textWidth(word, style)));

    widest = Math.max(widest, width + CELL_PADDING_X + (style.indent ?? 0) * INDENT_PX);
  }

  if (widest === 0) return DEFAULT_COLUMN_WIDTH;
  return Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, Math.ceil(widest)));
}

/**
 * The height that shows every cell in the row: the tallest font, wrapped
 * lines and turned text included. `undefined` when that is the default, so the
 * row loses its override rather than holding the default as a set value.
 */
export function autoFitRowHeight(store: WorkbookStore, row: number): number | undefined {
  const sheet = store.activeSheet();
  let tallest = 0;

  for (const [col, cell] of sheet.cellsInRow(row)) {
    if (cell.value === null) continue;
    const merge = sheet.mergeCovering(row, col);
    if (merge && merge.start.row !== merge.end.row) continue;

    const style = store.workbook.styles.get(cell.styleId);
    const text = formatCellValue(cell.value, style.numberFormat);
    const line = lineHeight(style);
    let height = line;

    if (style.textRotation) {
      height = Math.abs(Math.sin((style.textRotation * Math.PI) / 180)) * textWidth(text, style) + line;
    } else if (style.wrapText) {
      const room = Math.max(1, sheet.columnWidth(col) - CELL_PADDING_X);
      height = line * Math.max(1, Math.ceil(textWidth(text, style) / room));
    }

    tallest = Math.max(tallest, height + CELL_PADDING_Y);
  }

  const fitted = Math.min(MAX_ROW_HEIGHT, Math.max(DEFAULT_ROW_HEIGHT, Math.ceil(tallest)));
  return fitted === DEFAULT_ROW_HEIGHT ? undefined : fitted;
}
