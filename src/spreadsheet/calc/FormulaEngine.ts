import type { CellValue } from '../model/Cell';
import type { Reference } from './DependencyGraph';

/**
 * The calculation engine, as the rest of the app sees it.
 *
 * Two methods, because the engine does exactly two things: work out what a
 * formula is worth, and work out what it reads. Everything else — when to
 * recalculate, in what order, what to do about cycles — is ours, in
 * `DependencyGraph` and `WorkbookStore`.
 *
 * The interface exists so `fast-formula-parser` stays behind it. That library
 * is MIT and its `DepParser` removes the largest correctness risk in the
 * engine, but it was last published in 2023 and is CJS-only. Replacing it
 * should be a new file, not a search through the components.
 */

export interface FormulaPosition {
  sheetId: string;
  row: number;
  col: number;
}

export interface FormulaEngine {
  /**
   * Evaluates a formula and returns an Excel value.
   *
   * A formula that cannot be parsed returns an error value rather than
   * throwing: `#NAME?` is what Excel puts in the cell, and a thrown exception
   * here would take down the render of every other cell in the row.
   */
  evaluate(formula: string, at: FormulaPosition): CellValue;

  /** What the formula reads, for the dependency graph. */
  references(formula: string, at: FormulaPosition): Reference[];

  /** Function names the engine can evaluate, for the Formulas tab's list. */
  supportedFunctions(): string[];
}

/** Strips the leading `=` a stored formula carries. */
export function formulaBody(formula: string): string {
  return formula.startsWith('=') ? formula.slice(1) : formula;
}
