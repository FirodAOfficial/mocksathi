import type { CellRef, FormulaValue, RangeRef } from 'fast-formula-parser';
import { SUPPLEMENTARY_FUNCTIONS } from './supplementaryFunctions';
import { MAX_COLUMNS, MAX_ROWS } from '../model/address';
import { isErrorValue, type CellValue } from '../model/Cell';
import type { Workbook } from '../model/Workbook';
import type { Reference } from './DependencyGraph';
import { formulaBody, type FormulaEngine, type FormulaPosition } from './FormulaEngine';

/**
 * `fast-formula-parser`, adapted to this workbook.
 *
 * The whole job of this file is two conversions and one guarantee:
 *
 * - **One-based to zero-based.** The library counts rows and columns from 1;
 *   everything in `src/spreadsheet` counts from 0. This is the only file where
 *   that boundary exists, which is deliberate — an off-by-one leaking past here
 *   looks like data corruption rather than a bug.
 * - **Sheet names to sheet ids.** The library addresses sheets by name because
 *   that is what a formula contains. We address them by id because names
 *   change. Renaming a sheet must not silently repoint a formula.
 * - **Nothing throws.** Excel puts `#NAME?` in a cell; it does not fail to
 *   render the row.
 *
 * How large a range may be read: `onRange` materialises the rectangle it is
 * asked for, so `SUM(A:A)` would build a million-element array. The cap below
 * turns that into `#REF!` — wrong in the sense that Excel would answer it, but
 * bounded, and visible to the user rather than a frozen tab.
 */

/** Values `onRange` will materialise before refusing. About 16MB of array slots. */
export const MAX_RANGE_CELLS = 1_000_000;

/**
 * Loads the parser.
 *
 * Dynamic because the library pulls `chevrotain`, `jstat` and `bessel` — a tree
 * far too heavy to sit in the initial bundle of a page that may never contain a
 * formula. The grid renders, scrolls and takes typed values with the engine
 * still unloaded.
 */
export async function loadFormulaEngine(currentWorkbook: () => Workbook): Promise<FormulaEngine> {
  const imported = await import('fast-formula-parser');
  // CJS interop: the class is the default export under both bundlers, but Next
  // and vitest disagree about whether `.default` is unwrapped for us.
  const FormulaParser = (imported as unknown as { default?: unknown }).default ?? imported;

  return new FastFormulaEngine(
    currentWorkbook,
    FormulaParser as typeof import('fast-formula-parser'),
    (FormulaParser as unknown as { DepParser: typeof import('fast-formula-parser').DepParser })
      .DepParser,
  );
}

type ParserClass = typeof import('fast-formula-parser');
type DepParserClass = typeof import('fast-formula-parser').DepParser;

export class FastFormulaEngine implements FormulaEngine {
  private readonly parser: InstanceType<ParserClass>;
  private readonly depParser: InstanceType<DepParserClass>;

  /**
   * @param currentWorkbook Read through a function, not captured as a value.
   *   A sitting swaps the workbook when the candidate moves between questions,
   *   and an engine holding the old one would resolve every reference against
   *   a sheet nobody is looking at — silently, and with plausible numbers.
   */
  constructor(
    private readonly currentWorkbook: () => Workbook,
    Parser: ParserClass,
    DepParser: DepParserClass,
  ) {
    this.parser = new Parser({
      onCell: (ref) => this.readCell(ref),
      onRange: (ref) => this.readRange(ref),
      // MIN, MAX and friends are not in the library; see the module for why
      // that matters more than it sounds.
      functions: SUPPLEMENTARY_FUNCTIONS,
    });
    this.depParser = new DepParser();
  }

  evaluate(formula: string, at: FormulaPosition): CellValue {
    try {
      const result = this.parser.parse(formulaBody(formula), this.position(at), true);
      return toCellValue(result);
    } catch {
      // A formula the parser cannot handle is a `#NAME?` in Excel too — the
      // cell keeps its source text and shows an error, rather than the sheet
      // failing to render.
      return '#NAME?';
    }
  }

  references(formula: string, at: FormulaPosition): Reference[] {
    let found: Array<CellRef | RangeRef>;
    try {
      found = this.depParser.parse(formulaBody(formula), this.position(at));
    } catch {
      // Unparseable: it reads nothing, so it never recalculates. It still shows
      // its error, and re-typing it re-runs this.
      return [];
    }

    const references: Reference[] = [];

    for (const reference of found) {
      const sheetId = this.sheetIdFor(reference.sheet) ?? at.sheetId;

      if ('from' in reference) {
        references.push({
          kind: 'range',
          sheetId,
          range: {
            start: { row: toZero(reference.from.row, MAX_ROWS), col: toZero(reference.from.col, MAX_COLUMNS) },
            end: { row: toZero(reference.to.row, MAX_ROWS), col: toZero(reference.to.col, MAX_COLUMNS) },
          },
        });
      } else {
        references.push({
          kind: 'cell',
          sheetId,
          address: {
            row: toZero(reference.row, MAX_ROWS),
            col: toZero(reference.col, MAX_COLUMNS),
          },
        });
      }
    }

    return references;
  }

  supportedFunctions(): string[] {
    return this.parser.supportedFunctions();
  }

  /** Our position, in the library's one-based, name-addressed terms. */
  private position(at: FormulaPosition): CellRef {
    const sheet = this.currentWorkbook().sheetById(at.sheetId);
    return { row: at.row + 1, col: at.col + 1, sheet: sheet?.name ?? 'Sheet1' };
  }

  private sheetIdFor(name: string | undefined): string | undefined {
    if (!name) return undefined;
    return this.currentWorkbook().sheetByName(name)?.id;
  }

  private readCell(ref: CellRef): FormulaValue {
    const sheet = ref.sheet ? this.currentWorkbook().sheetByName(ref.sheet) : this.currentWorkbook().activeSheet();
    if (!sheet) return null;

    return sheet.getValue(toZero(ref.row, MAX_ROWS), toZero(ref.col, MAX_COLUMNS));
  }

  private readRange(ref: RangeRef): FormulaValue[][] {
    const sheet = ref.sheet ? this.currentWorkbook().sheetByName(ref.sheet) : this.currentWorkbook().activeSheet();
    if (!sheet) return [[null]];

    const top = toZero(ref.from.row, MAX_ROWS);
    const bottom = toZero(ref.to.row, MAX_ROWS);
    const left = toZero(ref.from.col, MAX_COLUMNS);
    const right = toZero(ref.to.col, MAX_COLUMNS);

    const cells = (bottom - top + 1) * (right - left + 1);
    if (cells > MAX_RANGE_CELLS) {
      // Refusing is the honest failure. Materialising `A:A` would allocate a
      // million slots per evaluation and freeze the tab with no explanation.
      return [['#REF!']];
    }

    const rows: FormulaValue[][] = [];
    for (let row = top; row <= bottom; row += 1) {
      const line: FormulaValue[] = [];
      for (let col = left; col <= right; col += 1) line.push(sheet.getValue(row, col));
      rows.push(line);
    }

    return rows;
  }
}

/** The library's 1-based index as our 0-based one, clamped into the grid. */
function toZero(oneBased: number, limit: number): number {
  return Math.max(0, Math.min(oneBased - 1, limit - 1));
}

/**
 * A library result as a cell value.
 *
 * Arrays are Excel's spill results. This build has no spill range, so the
 * top-left value is taken — which is what Excel itself did before dynamic
 * arrays, and is a defined answer rather than a guess.
 */
function toCellValue(result: FormulaValue): CellValue {
  if (result === null || result === undefined) return null;

  if (Array.isArray(result)) {
    const first = result[0];
    return Array.isArray(first) ? toCellValue(first[0] ?? null) : toCellValue(first ?? null);
  }

  if (typeof result === 'number') {
    // `1/0` reaches here as Infinity in some paths; Excel calls that #DIV/0!.
    if (!Number.isFinite(result)) return '#DIV/0!';
    return result;
  }

  if (typeof result === 'boolean') return result;

  if (typeof result === 'string') return isErrorValue(result) ? result : result;

  // A FormulaError instance: its `error` field is one of Excel's seven.
  const asError = (result as { error?: unknown }).error;
  if (typeof asError === 'string' && isErrorValue(asError)) return asError;

  const text = String(result);
  return isErrorValue(text) ? text : text;
}
