import { loadFormulaEngine } from '@/spreadsheet/calc/FastFormulaEngine';
import type { FormulaEngine } from '@/spreadsheet/calc/FormulaEngine';
import { cellKey, columnToLabel, type RangeAddress } from '@/spreadsheet/model/address';
import { isErrorValue, type CellValue } from '@/spreadsheet/model/Cell';
import { workbookFromSnapshot, type WorkbookSnapshot } from '@/spreadsheet/model/snapshot';
import type { Workbook } from '@/spreadsheet/model/Workbook';
import { DEFAULT_ROW_HEIGHT } from '@/spreadsheet/model/Worksheet';
import type { CellRef, StyleProperty } from '@/exam/workbook/types';
import type { AnswerPayload } from '../../types';
import type { CriterionResult } from '../criteria';
import type { SubjectMarker } from '../markAttempt';
import type { SheetCriterion } from './criteria';
import { evaluateSheetCriterion } from './evaluate';
import { flattenWorkbook, type FlatSheet, type FlatWorkbook } from './flattenWorkbook';

/**
 * Marking a single-workbook Excel paper.
 *
 * The counterpart of `documentMarker`: a question is judged only on its own
 * *segments* — each visit to it that changed something, as the workbook before
 * and after — so the candidate may answer in any order on one shared sheet.
 * Positive criteria are read off the last visit; "nothing else changed" must
 * hold for every visit.
 *
 * Two things differ from the Word marker, both because a spreadsheet computes:
 *
 * - **A formula is marked by what it computes on the candidate's own sheet.**
 *   The admin's formula and the candidate's are both evaluated, server-side,
 *   against the candidate's workbook, and must agree (and call the same
 *   function, as the per-question papers require). Comparing with the number
 *   the admin's sheet showed would fail anyone who answered a question that
 *   changes the inputs in another order.
 * - **A recalculated formula is not a change.** Typing 500 into B3 changes the
 *   SUM below it; "nothing else changed" ignores a formula whose text is the
 *   same before and after.
 */

/** Criteria the shared `SheetCriterion` union does not have, used only by this flow. */
export type WorkbookCriterion =
  | SheetCriterion
  | ({ label: string } & (
      | {
          /** The cell holds a formula that computes what this one does, on the candidate's sheet. */
          kind: 'formulaLike';
          row: number;
          col: number;
          formula: string;
          /** The function the admin's formula calls, which the candidate's must call too. */
          usesFunction?: string;
        }
      | {
          /**
           * Each cell's canonical value of one style property — or its absence,
           * for `null`, which is how "remove the bold" is checked.
           */
          kind: 'cellProperty';
          property: StyleProperty;
          cells: (CellRef & { value: unknown; anyOf?: unknown[] })[];
        }
      | { kind: 'notMerged'; range: RangeAddress }
      | { kind: 'columnHidden'; col: number; hidden: boolean }
      | { kind: 'rowSize'; row: number; atLeast?: number; atMost?: number }
      | { kind: 'rowHidden'; row: number; hidden: boolean }
    ));

export interface WorkbookSegment {
  before: WorkbookSnapshot;
  after: WorkbookSnapshot;
}

/** What the submit route hands `markAttempt` for one question of such a paper. */
export interface WorkbookAnswer {
  segments: WorkbookSegment[];
}

interface Projected {
  segments: { before: FlatWorkbook; after: FlatWorkbook; afterSnapshot: WorkbookSnapshot }[];
}

/* -- Evaluating formulas ----------------------------------------------------- */

/** Evaluates formulas against a workbook snapshot. */
export interface FormulaEvaluator {
  evaluate(snapshot: WorkbookSnapshot, formula: string, at: CellRef): CellValue;
}

/**
 * The calculation engine the editor uses, pointed at whichever snapshot is
 * being marked. Loaded once per submission; null if it cannot load, in which
 * case formulas are compared by their text instead.
 */
export async function loadFormulaEvaluator(): Promise<FormulaEvaluator | null> {
  let current: Workbook | null = null;
  let engine: FormulaEngine;
  try {
    engine = await loadFormulaEngine(() => current!);
  } catch {
    return null;
  }

  const built = new WeakMap<WorkbookSnapshot, Workbook>();
  return {
    evaluate(snapshot, formula, at) {
      let workbook = built.get(snapshot);
      if (!workbook) {
        workbook = workbookFromSnapshot(snapshot);
        built.set(snapshot, workbook);
      }
      current = workbook;
      const sheet = workbook.allSheets()[0];
      if (!sheet) return '#REF!';
      return engine.evaluate(formula, { sheetId: sheet.id, row: at.row, col: at.col });
    },
  };
}

/** `=sum( b2:b7 )` and `=SUM(B2:B7)` are the same formula. */
function normaliseFormula(formula: string): string {
  return formula.replace(/\s+/g, '').toUpperCase();
}

function callsFunction(formula: string, name: string): boolean {
  return new RegExp(`\\b${name}\\s*\\(`, 'i').test(formula);
}

function sameResult(a: CellValue, b: CellValue): boolean {
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a));
  if (typeof a === 'string' && typeof b === 'string') return a.trim().toLowerCase() === b.trim().toLowerCase();
  return a === b;
}

/* -- The extra criteria ------------------------------------------------------ */

function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

function a1(cell: CellRef): string {
  return `${columnToLabel(cell.col)}${cell.row + 1}`;
}

function sameRange(a: RangeAddress, b: RangeAddress): boolean {
  return a.start.row === b.start.row && a.start.col === b.start.col && a.end.row === b.end.row && a.end.col === b.end.col;
}

/**
 * A copy of `after` with every formula whose text did not change given back its
 * old value, so "nothing else changed" does not count a recalculation.
 */
function withoutRecalculation(after: FlatWorkbook, before: FlatWorkbook): FlatWorkbook {
  return {
    sheets: after.sheets.map((sheet, index) => {
      const was = before.sheets[index];
      if (!was) return sheet;
      const cells = new Map(sheet.cells);
      for (const [key, cell] of cells) {
        const previous = was.cells.get(key);
        if (cell.formula !== undefined && previous?.formula === cell.formula) {
          cells.set(key, { ...cell, value: previous.value });
        }
      }
      return { ...sheet, cells };
    }),
  };
}

function evaluateExtra(
  criterion: WorkbookCriterion,
  sheet: FlatSheet,
  afterSnapshot: WorkbookSnapshot,
  formulas: FormulaEvaluator | null,
): CriterionResult | null {
  const pass = (): CriterionResult => ({ label: criterion.label, passed: true });
  const fail = (detail: string): CriterionResult => ({ label: criterion.label, passed: false, detail });

  switch (criterion.kind) {
    case 'formulaLike': {
      const at = { row: criterion.row, col: criterion.col };
      const formula = sheet.cells.get(cellKey(at.row, at.col))?.formula;
      if (!formula) return fail(`${a1(at)} does not hold a formula.`);
      if (criterion.usesFunction && !callsFunction(formula, criterion.usesFunction)) {
        return fail(`${a1(at)} does not use ${criterion.usesFunction}.`);
      }

      if (formulas) {
        const expected = formulas.evaluate(afterSnapshot, criterion.formula, at);
        // An error from the admin's own formula means the engine cannot judge
        // it, and the text is all there is to compare.
        if (!isErrorValue(expected)) {
          const actual = formulas.evaluate(afterSnapshot, formula, at);
          return sameResult(actual, expected)
            ? pass()
            : fail(`${a1(at)} calculates ${String(actual)}, where the expected formula gives ${String(expected)}.`);
        }
      }
      return normaliseFormula(formula) === normaliseFormula(criterion.formula)
        ? pass()
        : fail(`${a1(at)} does not hold the expected formula.`);
    }

    case 'cellProperty': {
      for (const cell of criterion.cells) {
        const actual = sheet.cells.get(cellKey(cell.row, cell.col))?.style[criterion.property] ?? null;
        const allowed = cell.anyOf ?? [cell.value];
        if (!allowed.some((value) => sameValue(actual, value))) {
          return fail(
            cell.value === null
              ? `${a1(cell)} still has ${criterion.property}.`
              : `${a1(cell)} does not have the expected ${criterion.property}.`,
          );
        }
      }
      return pass();
    }

    case 'notMerged':
      return sheet.merges.some((merge) => sameRange(merge, criterion.range))
        ? fail('The cells are still merged.')
        : pass();

    case 'columnHidden':
      return Boolean(sheet.columns.get(criterion.col)?.hidden) === criterion.hidden
        ? pass()
        : fail(`Column ${columnToLabel(criterion.col)} is ${criterion.hidden ? 'not hidden' : 'still hidden'}.`);

    case 'rowSize': {
      const height = sheet.rows.get(criterion.row)?.height ?? DEFAULT_ROW_HEIGHT;
      if (criterion.atLeast !== undefined && height < criterion.atLeast) return fail(`Row ${criterion.row + 1} is not tall enough.`);
      if (criterion.atMost !== undefined && height > criterion.atMost) return fail(`Row ${criterion.row + 1} is too tall.`);
      return pass();
    }

    case 'rowHidden':
      return Boolean(sheet.rows.get(criterion.row)?.hidden) === criterion.hidden
        ? pass()
        : fail(`Row ${criterion.row + 1} is ${criterion.hidden ? 'not hidden' : 'still hidden'}.`);

    default:
      return null;
  }
}

/* -- The marker -------------------------------------------------------------- */

/** One marker per submission, so its caches live as long as the request. */
export function workbookMarker(formulas: FormulaEvaluator | null): SubjectMarker<Projected, WorkbookCriterion> {
  const cache = new WeakMap<WorkbookSnapshot, FlatWorkbook>();
  const projectOnce = (snapshot: WorkbookSnapshot): FlatWorkbook => {
    const cached = cache.get(snapshot);
    if (cached) return cached;
    const projected = flattenWorkbook(snapshot);
    cache.set(snapshot, projected);
    return projected;
  };

  return {
    project: (answer: AnswerPayload) => ({
      segments: ((answer as unknown as WorkbookAnswer).segments ?? []).map((segment) => ({
        before: projectOnce(segment.before),
        after: projectOnce(segment.after),
        afterSnapshot: segment.after,
      })),
    }),

    start: () => ({ segments: [] }),

    evaluate: (criterion, submitted): CriterionResult => {
      const { segments } = submitted;
      const last = segments[segments.length - 1];
      if (!last) return { label: criterion.label, passed: false, detail: 'Nothing was recorded for this question.' };

      if (criterion.kind === 'unchanged') {
        for (const [index, segment] of segments.entries()) {
          const result = evaluateSheetCriterion(criterion, withoutRecalculation(segment.after, segment.before), segment.before);
          if (result.passed) continue;
          return segments.length === 1
            ? result
            : { ...result, detail: `${result.detail ?? ''} (on visit ${index + 1} of ${segments.length} to this question)`.trim() };
        }
        return { label: criterion.label, passed: true };
      }

      const sheet = last.after.sheets[0];
      if (!sheet) return { label: criterion.label, passed: false, detail: 'The workbook has no sheet to mark.' };

      return (
        evaluateExtra(criterion, sheet, last.afterSnapshot, formulas) ??
        evaluateSheetCriterion(criterion as SheetCriterion, last.after, last.before)
      );
    },
  };
}
