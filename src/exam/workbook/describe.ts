import { colourName } from '@/editor/functions/colours';
import { columnToLabel, type RangeAddress } from '@/spreadsheet/model/address';
import type { CellValue } from '@/spreadsheet/model/Cell';
import type { CellRef, StyleProperty, WorkbookStep } from './types';

/**
 * Saying what a detected workbook change is, in the words of Excel's ribbon.
 *
 * Read by the admin (to see what was recorded), the candidate (their feedback
 * labels) and the default solution steps — one function for all three, as for
 * Word, so the feedback cannot describe a different operation from the one the
 * admin saw recorded.
 */

function a1(cell: CellRef): string {
  return `${columnToLabel(cell.col)}${cell.row + 1}`;
}

export function rangeA1(range: RangeAddress): string {
  const start = a1(range.start);
  const end = a1(range.end);
  return start === end ? start : `${start}:${end}`;
}

/**
 * Cells as the fewest rectangles: a run along each row, then identical runs on
 * consecutive rows joined. "A1:D1" rather than "A1, B1, C1, D1".
 */
export function cellsToRanges(cells: readonly CellRef[]): RangeAddress[] {
  const byRow = new Map<number, number[]>();
  for (const cell of cells) byRow.set(cell.row, [...(byRow.get(cell.row) ?? []), cell.col]);

  const runs: RangeAddress[] = [];
  for (const row of [...byRow.keys()].sort((a, b) => a - b)) {
    const cols = [...new Set(byRow.get(row))].sort((a, b) => a - b);
    let start = cols[0]!;
    let previous = start;
    for (const col of [...cols.slice(1), Number.NaN]) {
      if (col === previous + 1) {
        previous = col;
        continue;
      }
      runs.push({ start: { row, col: start }, end: { row, col: previous } });
      start = col;
      previous = col;
    }
  }

  // Join a run to the one directly above it when they span the same columns.
  const ranges: RangeAddress[] = [];
  for (const run of runs) {
    const above = ranges.find(
      (range) => range.end.row === run.start.row - 1 && range.start.col === run.start.col && range.end.col === run.end.col,
    );
    if (above) above.end = { ...above.end, row: run.end.row };
    else ranges.push({ start: { ...run.start }, end: { ...run.end } });
  }
  return ranges;
}

function enclosing(cells: readonly CellRef[]): RangeAddress {
  const rows = cells.map((cell) => cell.row);
  const cols = cells.map((cell) => cell.col);
  return {
    start: { row: Math.min(...rows), col: Math.min(...cols) },
    end: { row: Math.max(...rows), col: Math.max(...cols) },
  };
}

export function describeCells(cells: readonly CellRef[]): string {
  return cellsToRanges(cells).map(rangeA1).join(', ');
}

function show(value: CellValue): string {
  if (value === null) return 'blank';
  return typeof value === 'string' ? `“${value}”` : String(value);
}

const ALIGN: Record<string, string> = {
  left: 'Align left',
  center: 'Centre',
  right: 'Align right',
  justify: 'Justify',
  top: 'Top align',
  middle: 'Middle align',
  bottom: 'Bottom align',
};

function describeBorders(values: unknown[]): string {
  const edges = new Set<string>();
  for (const value of values) {
    if (value && typeof value === 'object') for (const edge of Object.keys(value)) edges.add(edge);
  }
  return edges.size === 0 ? 'No border' : 'Borders';
}

/** One style change, as the control that makes it is named. */
export function describeStyle(property: StyleProperty, value: unknown, allValues: unknown[] = [value]): string {
  const off = value === null || value === false || value === undefined;
  switch (property) {
    case 'bold':
      return off ? 'Remove bold' : 'Bold';
    case 'italic':
      return off ? 'Remove italic' : 'Italic';
    case 'underline':
      return off ? 'Remove underline' : 'Underline';
    case 'strikethrough':
      return off ? 'Remove strikethrough' : 'Strikethrough';
    case 'wrapText':
      return off ? 'Turn off Wrap Text' : 'Wrap Text';
    case 'fontFamily':
      return off ? 'Default font' : `Font ${String(value)}`;
    case 'fontSize':
      return off ? 'Default font size' : `Font size ${String(value)}`;
    case 'fontColor':
      return off ? 'Remove font colour' : `Font colour ${colourName(String(value))}`;
    case 'fillColor':
      return off ? 'No fill' : `Fill colour ${colourName(String(value))}`;
    case 'horizontalAlignment':
    case 'verticalAlignment':
      return off ? 'Default alignment' : (ALIGN[String(value)] ?? `Align ${String(value)}`);
    case 'textEffect':
      return off ? 'Remove superscript/subscript' : value === 'subscript' ? 'Subscript' : 'Superscript';
    case 'textRotation':
      return off ? 'No rotation' : `Rotate text ${String(value)}°`;
    case 'indent':
      return off ? 'Remove indent' : `Indent ${String(value)}`;
    case 'numberFormat':
      return off ? 'General number format' : `Number format ${String(value)}`;
    case 'borders':
      return describeBorders(allValues);
  }
}

/** What a step does. */
export function describeWorkbookChange(step: WorkbookStep): string {
  switch (step.kind) {
    case 'content': {
      const formulas = step.cells.filter((cell) => cell.formula !== undefined);
      const cleared = step.cells.filter((cell) => cell.formula === undefined && cell.value === null);
      if (step.cells.length === 1) {
        const [cell] = step.cells;
        if (cell!.formula !== undefined) return `Formula ${cell!.formula}`;
        return cell!.value === null ? 'Clear the cell' : `Enter ${show(cell!.value)}`;
      }
      if (formulas.length === step.cells.length) return 'Formulas';
      if (cleared.length === step.cells.length) return 'Clear contents';
      return formulas.length > 0 ? 'Values and formulas' : 'Values';
    }
    case 'style':
      return describeStyle(step.property, step.cells[0]?.value ?? null, step.cells.map((cell) => cell.value));
    case 'merge':
      return step.merged ? 'Merge cells' : 'Unmerge cells';
    case 'column': {
      const parts: string[] = [];
      if (step.width) parts.push(step.width.to > step.width.from ? 'Widen column' : 'Narrow column');
      if (step.hidden) parts.push(step.hidden.to ? 'Hide column' : 'Unhide column');
      return parts.join(' + ');
    }
    case 'row': {
      const parts: string[] = [];
      if (step.height) parts.push(step.height.to > step.height.from ? 'Increase row height' : 'Decrease row height');
      if (step.hidden) parts.push(step.hidden.to ? 'Hide row' : 'Unhide row');
      return parts.join(' + ');
    }
    case 'freeze':
      return step.rows === 0 && step.columns === 0
        ? 'Unfreeze panes'
        : `Freeze ${step.rows} row(s) and ${step.columns} column(s)`;
    case 'view': {
      const parts: string[] = [];
      if (step.showGridlines !== undefined) parts.push(step.showGridlines ? 'Show gridlines' : 'Hide gridlines');
      if (step.showHeadings !== undefined) parts.push(step.showHeadings ? 'Show headings' : 'Hide headings');
      return parts.join(' + ');
    }
    case 'printArea':
      return step.range ? 'Set print area' : 'Clear print area';
  }
}

/** Where a step happens. Empty for sheet-wide settings. */
export function describeWorkbookTarget(step: WorkbookStep): string {
  switch (step.kind) {
    case 'content':
      return describeCells(step.cells);
    case 'style':
      // Outside Borders touches only the edge cells, but it is applied to — and
      // named by — the block they enclose.
      return step.property === 'borders' ? rangeA1(enclosing(step.cells)) : describeCells(step.cells);
    case 'merge':
      return rangeA1(step.range);
    case 'column':
      return columnToLabel(step.col);
    case 'row':
      return String(step.row + 1);
    case 'printArea':
      return step.range ? rangeA1(step.range) : '';
    case 'freeze':
    case 'view':
      return '';
  }
}

/** One line per step: "Bold — A1:D1". */
export function describeWorkbookStep(step: WorkbookStep): string {
  const where = describeWorkbookTarget(step);
  return where ? `${describeWorkbookChange(step)} — ${where}` : describeWorkbookChange(step);
}

/** A draft instruction for the admin to edit, never used as-is. */
export function suggestWorkbookInstruction(steps: readonly WorkbookStep[]): string {
  return steps
    .map((step) => {
      const where = describeWorkbookTarget(step);
      const what = describeWorkbookChange(step);
      return where ? `${what} in ${where}.` : `${what}.`;
    })
    .join(' ');
}

/** Solution steps when the admin writes none. */
export function defaultWorkbookSolution(steps: readonly WorkbookStep[]): string[] {
  return steps.flatMap((step) => {
    const where = describeWorkbookTarget(step);
    return where
      ? [`Select ${where}.`, `Apply: ${describeWorkbookChange(step)}.`]
      : [`Apply: ${describeWorkbookChange(step)}.`];
  });
}
