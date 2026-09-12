import {
  cellKey,
  columnToLabel,
  eachAddress,
  formatAddress,
  keyToAddress,
  rangeContains,
  type CellAddress,
  type RangeAddress,
} from '@/spreadsheet/model/address';
import { isErrorValue, type CellValue } from '@/spreadsheet/model/Cell';
import type { CellStyle } from '@/spreadsheet/model/styles';
import type { ColumnProps, RowProps } from '@/spreadsheet/model/Worksheet';
import { DEFAULT_COLUMN_WIDTH, DEFAULT_ROW_HEIGHT } from '@/spreadsheet/model/Worksheet';
import type { CriterionResult } from '../criteria';
import type { SheetCriterion, SheetExemption, SheetTarget } from './criteria';
import {
  cellAt,
  sheetOf,
  stylesEqualExcept,
  type FlatCell,
  type FlatSheet,
  type FlatWorkbook,
} from './flattenWorkbook';

/**
 * Deciding whether one Excel criterion is satisfied.
 *
 * The spreadsheet counterpart of `evaluate.ts`, and it answers the same two
 * questions: did the candidate do what was asked, and did they do *only* what
 * was asked. Every branch returns a `CriterionResult` whose `detail` names the
 * cell that failed, because "wrong" without "where" teaches nothing.
 */

export function evaluateSheetCriterion(
  criterion: SheetCriterion,
  submitted: FlatWorkbook,
  start: FlatWorkbook,
): CriterionResult {
  const pass = (): CriterionResult => ({ label: criterion.label, passed: true });
  const fail = (detail: string): CriterionResult => ({ label: criterion.label, passed: false, detail });

  const sheet = sheetOf(submitted);
  const before = sheetOf(start);
  if (!sheet || !before) return fail('The workbook has no sheet to mark.');

  switch (criterion.kind) {
    case 'cellValue': {
      const expected = Array.isArray(criterion.equals) ? criterion.equals : [criterion.equals];
      const addresses = resolveTarget(criterion.target, sheet, before);
      if (addresses.length === 0) return fail(`${describe(criterion.target)} holds nothing.`);

      for (const address of addresses) {
        const actual = cellAt(sheet, address)?.value ?? null;
        if (!expected.some((value) => valuesMatch(actual, value, criterion.tolerance))) {
          return fail(`${formatAddress(address)} holds ${show(actual)}, not ${show(expected[0]!)}.`);
        }
      }
      return pass();
    }

    case 'cellFormula': {
      const addresses = resolveTarget(criterion.target, sheet, before);
      if (addresses.length === 0) return fail(`${describe(criterion.target)} holds nothing.`);

      for (const address of addresses) {
        const cell = cellAt(sheet, address);
        if (!cell?.formula) {
          return fail(`${formatAddress(address)} does not contain a formula.`);
        }

        if (criterion.usesFunction && !callsFunction(cell.formula, criterion.usesFunction)) {
          return fail(`${formatAddress(address)} does not use ${criterion.usesFunction}.`);
        }

        if (criterion.equals && normaliseFormula(cell.formula) !== normaliseFormula(criterion.equals)) {
          return fail(`${formatAddress(address)} contains ${cell.formula}, not ${criterion.equals}.`);
        }

        if (
          criterion.resultEquals !== undefined &&
          !valuesMatch(cell.value, criterion.resultEquals, criterion.tolerance)
        ) {
          // A formula that is written correctly but has not calculated is not a
          // correct answer: the sheet does not show the right number.
          return fail(`${formatAddress(address)} works out to ${show(cell.value)}, not ${show(criterion.resultEquals)}.`);
        }
      }
      return pass();
    }

    case 'styled': {
      const addresses = resolveTarget(criterion.target, sheet, before);
      if (addresses.length === 0) return fail(`${describe(criterion.target)} holds nothing.`);

      for (const address of addresses) {
        const style = cellAt(sheet, address)?.style ?? {};

        for (const [property, wanted] of Object.entries(criterion.style)) {
          const key = property as keyof CellStyle;
          const actual = style[key];

          const allowed =
            criterion.anyOf && criterion.anyOf.property === key
              ? criterion.anyOf.values
              : [wanted];

          if (!allowed.some((value) => deepEqual(actual, value))) {
            return fail(`${formatAddress(address)} is missing ${property}.`);
          }
        }
      }
      return pass();
    }

    case 'numberFormat': {
      const wanted = Array.isArray(criterion.format) ? criterion.format : [criterion.format];
      const addresses = resolveTarget(criterion.target, sheet, before);
      if (addresses.length === 0) return fail(`${describe(criterion.target)} holds nothing.`);

      for (const address of addresses) {
        const format = cellAt(sheet, address)?.style.numberFormat ?? 'General';
        if (!wanted.includes(format)) {
          return fail(`${formatAddress(address)} uses the ${format} format.`);
        }
      }
      return pass();
    }

    case 'cellSeries': {
      const addresses = resolveTarget(criterion.target, sheet, before);

      if (addresses.length !== criterion.values.length) {
        return fail(`${describe(criterion.target)} covers ${addresses.length} cells, not ${criterion.values.length}.`);
      }

      for (const [index, address] of addresses.entries()) {
        const cell = cellAt(sheet, address);
        const expected = criterion.values[index]!;

        if (criterion.formula) {
          if (!cell?.formula) return fail(`${formatAddress(address)} does not contain a formula.`);
          if (
            criterion.formula.usesFunction &&
            !callsFunction(cell.formula, criterion.formula.usesFunction)
          ) {
            return fail(`${formatAddress(address)} does not use ${criterion.formula.usesFunction}.`);
          }
        }

        if (!valuesMatch(cell?.value ?? null, expected, criterion.tolerance)) {
          return fail(`${formatAddress(address)} holds ${show(cell?.value ?? null)}, not ${show(expected)}.`);
        }
      }
      return pass();
    }

    case 'outsideBorder': {
      const { range } = criterion;

      for (const address of eachAddress(range)) {
        const borders = cellAt(sheet, address)?.style.borders ?? {};

        // The edge a cell should carry is decided by where it sits, and the
        // edges it should *not* carry matter just as much: an interior cell
        // with borders means All Borders was used instead.
        const wanted = {
          top: address.row === range.start.row,
          bottom: address.row === range.end.row,
          left: address.col === range.start.col,
          right: address.col === range.end.col,
        };

        for (const edge of ['top', 'bottom', 'left', 'right'] as const) {
          const present = borders[edge] !== undefined;
          if (present === wanted[edge]) continue;

          return fail(
            wanted[edge]
              ? `${formatAddress(address)} has no border on its ${edge} edge.`
              : `${formatAddress(address)} has a border inside the range, so this is All Borders rather than an outside border.`,
          );
        }
      }
      return pass();
    }

    case 'sheetView': {
      if (criterion.showGridlines !== undefined && sheet.view.showGridlines !== criterion.showGridlines) {
        return fail(`Gridlines are ${sheet.view.showGridlines ? 'shown' : 'hidden'}.`);
      }
      if (criterion.showHeadings !== undefined && sheet.view.showHeadings !== criterion.showHeadings) {
        return fail(`The headings are ${sheet.view.showHeadings ? 'shown' : 'hidden'}.`);
      }
      return pass();
    }

    case 'printArea': {
      const actual = sheet.printArea;
      if (!criterion.range) return actual === null ? pass() : fail('A print area is set.');
      if (!actual) return fail('No print area is set.');

      return sameRange(actual, criterion.range)
        ? pass()
        : fail(`The print area is ${rangeLabel(actual)}, not ${rangeLabel(criterion.range)}.`);
    }

    case 'merged': {
      const found = sheet.merges.some((merge) => sameRange(merge, criterion.range));
      return found ? pass() : fail(`${rangeLabel(criterion.range)} is not merged.`);
    }

    case 'columnWidth': {
      const width = sheet.columns.get(criterion.col)?.width ?? DEFAULT_COLUMN_WIDTH;

      if (criterion.atLeast !== undefined && width < criterion.atLeast) {
        return fail(`Column ${columnToLabel(criterion.col)} is ${Math.round(width)} pixels wide.`);
      }
      if (criterion.atMost !== undefined && width > criterion.atMost) {
        return fail(`Column ${columnToLabel(criterion.col)} is ${Math.round(width)} pixels wide.`);
      }
      return pass();
    }

    case 'frozen': {
      const { rows, columns } = sheet.frozen;
      return rows === criterion.rows && columns === criterion.columns
        ? pass()
        : fail(`${rows} rows and ${columns} columns are frozen.`);
    }

    case 'unchanged':
      return checkUnchanged(criterion.except, sheet, before, fail, pass);
  }
}

/* -- Targets ------------------------------------------------------------- */

/**
 * The cells a target names.
 *
 * A `range` resolves to every address in it, occupied or not — formatting an
 * empty cell is a real thing to ask for. `column` and `sheet` resolve to what
 * exists, in *either* workbook: a cell the candidate emptied still has to be
 * looked at, or deleting content would be a way to pass.
 */
export function resolveTarget(target: SheetTarget, sheet: FlatSheet, start: FlatSheet): CellAddress[] {
  switch (target.by) {
    case 'cell':
      return [{ row: target.row, col: target.col }];

    case 'range':
      return [...eachAddress(target.range)];

    case 'column': {
      const rows = new Set<number>();
      for (const source of [sheet, start]) {
        for (const key of source.cells.keys()) {
          const address = keyToAddress(key);
          if (address.col !== target.col) continue;
          if (target.skipHeader && address.row === 0) continue;
          rows.add(address.row);
        }
      }
      return [...rows].sort((a, b) => a - b).map((row) => ({ row, col: target.col }));
    }

    case 'sheet': {
      const keys = new Set<number>([...sheet.cells.keys(), ...start.cells.keys()]);
      return [...keys].sort((a, b) => a - b).map(keyToAddress);
    }
  }
}

function describe(target: SheetTarget): string {
  switch (target.by) {
    case 'cell':
      return formatAddress({ row: target.row, col: target.col });
    case 'range':
      return rangeLabel(target.range);
    case 'column':
      return `Column ${columnToLabel(target.col)}`;
    case 'sheet':
      return 'The sheet';
  }
}

function rangeLabel(range: RangeAddress): string {
  return `${formatAddress(range.start)}:${formatAddress(range.end)}`;
}

/* -- Comparison helpers --------------------------------------------------- */

function valuesMatch(actual: CellValue, expected: CellValue, tolerance = 0): boolean {
  if (typeof actual === 'number' && typeof expected === 'number') {
    return Math.abs(actual - expected) <= tolerance;
  }

  if (typeof actual === 'string' && typeof expected === 'string') {
    // A candidate who types "Total " is not wrong about the word.
    return actual.trim().toLowerCase() === expected.trim().toLowerCase();
  }

  return actual === expected;
}

function show(value: CellValue): string {
  if (value === null) return 'nothing';
  if (isErrorValue(value)) return value;
  return typeof value === 'string' ? `"${value}"` : String(value);
}

/** Whitespace and case carry no meaning in a formula. */
function normaliseFormula(formula: string): string {
  return formula.replace(/\s+/g, '').toUpperCase();
}

function callsFunction(formula: string, name: string): boolean {
  return new RegExp(`\\b${name}\\s*\\(`, 'i').test(formula);
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a === 'string' && typeof b === 'string') return a.toLowerCase() === b.toLowerCase();
  // Borders are the only nested value a style holds.
  return JSON.stringify(a) === JSON.stringify(b);
}

function sameRange(a: RangeAddress, b: RangeAddress): boolean {
  return (
    a.start.row === b.start.row &&
    a.start.col === b.start.col &&
    a.end.row === b.end.row &&
    a.end.col === b.end.col
  );
}

/* -- "and nothing else" ---------------------------------------------------- */

interface Allowances {
  /** Cell key -> style properties that may differ there. */
  style: Map<number, Set<keyof CellStyle>>;
  /** Cell keys whose value or formula may differ. */
  content: Set<number>;
  columns: Set<number>;
  rows: Set<number>;
  merges: boolean;
  frozen: boolean;
  view: boolean;
  printArea: boolean;
}

function buildAllowances(
  except: SheetExemption[],
  sheet: FlatSheet,
  start: FlatSheet,
): Allowances {
  const allowances: Allowances = {
    style: new Map(),
    content: new Set(),
    columns: new Set(),
    rows: new Set(),
    merges: false,
    frozen: false,
    view: false,
    printArea: false,
  };

  for (const exemption of except) {
    const addresses = exemption.target
      ? resolveTarget(exemption.target, sheet, start)
      : resolveTarget({ by: 'sheet' }, sheet, start);

    for (const address of addresses) {
      const key = cellKey(address.row, address.col);

      if (exemption.style?.length) {
        let properties = allowances.style.get(key);
        if (!properties) {
          properties = new Set();
          allowances.style.set(key, properties);
        }
        for (const property of exemption.style) properties.add(property);
      }

      if (exemption.content) allowances.content.add(key);
    }

    for (const col of exemption.columns ?? []) allowances.columns.add(col);
    for (const row of exemption.rows ?? []) allowances.rows.add(row);
    if (exemption.merges) allowances.merges = true;
    if (exemption.frozen) allowances.frozen = true;
    if (exemption.view) allowances.view = true;
    if (exemption.printArea) allowances.printArea = true;
  }

  return allowances;
}

const NO_PROPERTIES: ReadonlySet<keyof CellStyle> = new Set();

/**
 * Nothing changed beyond what the question asked for.
 *
 * The criterion that makes this paper strict. It sweeps every cell either
 * workbook holds — not just the ones the question is about — so bolding the
 * wrong column, clearing a neighbouring cell, or widening a column nobody asked
 * about all fail here rather than passing unnoticed.
 */
function checkUnchanged(
  except: SheetExemption[],
  sheet: FlatSheet,
  start: FlatSheet,
  fail: (detail: string) => CriterionResult,
  pass: () => CriterionResult,
): CriterionResult {
  const allowances = buildAllowances(except, sheet, start);

  const keys = new Set<number>([...sheet.cells.keys(), ...start.cells.keys()]);

  for (const key of keys) {
    const address = keyToAddress(key);
    const after = sheet.cells.get(key);
    const before = start.cells.get(key);

    if (!allowances.content.has(key) && !contentEqual(after, before)) {
      return fail(`The contents of ${formatAddress(address)} were changed.`);
    }

    const allowed = allowances.style.get(key) ?? NO_PROPERTIES;
    if (!stylesEqualExcept(after?.style ?? {}, before?.style ?? {}, allowed)) {
      return fail(`Formatting was applied to ${formatAddress(address)} that the question did not ask for.`);
    }
  }

  for (const col of columnsOf(sheet, start)) {
    if (allowances.columns.has(col)) continue;
    if (!columnPropsEqual(sheet.columns.get(col), start.columns.get(col))) {
      return fail(`Column ${columnToLabel(col)} was changed.`);
    }
  }

  for (const row of rowsOf(sheet, start)) {
    if (allowances.rows.has(row)) continue;
    if (!rowPropsEqual(sheet.rows.get(row), start.rows.get(row))) {
      return fail(`Row ${row + 1} was changed.`);
    }
  }

  if (!allowances.merges && !mergesEqual(sheet.merges, start.merges)) {
    return fail('Cells were merged or unmerged when the question did not ask for it.');
  }

  if (
    !allowances.frozen &&
    (sheet.frozen.rows !== start.frozen.rows || sheet.frozen.columns !== start.frozen.columns)
  ) {
    return fail('The frozen panes were changed when the question did not ask for it.');
  }

  if (
    !allowances.view &&
    (sheet.view.showGridlines !== start.view.showGridlines ||
      sheet.view.showHeadings !== start.view.showHeadings)
  ) {
    return fail('The gridlines or headings were changed when the question did not ask for it.');
  }

  if (!allowances.printArea && !sameOptionalRange(sheet.printArea, start.printArea)) {
    return fail('The print area was changed when the question did not ask for it.');
  }

  return pass();
}

function sameOptionalRange(a: RangeAddress | null, b: RangeAddress | null): boolean {
  if (a === null || b === null) return a === b;
  return sameRange(a, b);
}

function contentEqual(a: FlatCell | undefined, b: FlatCell | undefined): boolean {
  if ((a?.formula ?? null) !== (b?.formula ?? null)) return false;

  const left = a?.value ?? null;
  const right = b?.value ?? null;
  return left === right;
}

function columnsOf(sheet: FlatSheet, start: FlatSheet): number[] {
  return [...new Set([...sheet.columns.keys(), ...start.columns.keys()])];
}

function rowsOf(sheet: FlatSheet, start: FlatSheet): number[] {
  return [...new Set([...sheet.rows.keys(), ...start.rows.keys()])];
}

function columnPropsEqual(a: ColumnProps | undefined, b: ColumnProps | undefined): boolean {
  return (
    (a?.width ?? DEFAULT_COLUMN_WIDTH) === (b?.width ?? DEFAULT_COLUMN_WIDTH) &&
    Boolean(a?.hidden) === Boolean(b?.hidden)
  );
}

function rowPropsEqual(a: RowProps | undefined, b: RowProps | undefined): boolean {
  return (
    (a?.height ?? DEFAULT_ROW_HEIGHT) === (b?.height ?? DEFAULT_ROW_HEIGHT) &&
    Boolean(a?.hidden) === Boolean(b?.hidden)
  );
}

function mergesEqual(a: RangeAddress[], b: RangeAddress[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((merge) => b.some((other) => sameRange(merge, other)));
}

/** Exported for the rubric authoring tests: does this range cover the address? */
export function rangeCovers(range: RangeAddress, address: CellAddress): boolean {
  return rangeContains(range, address);
}
