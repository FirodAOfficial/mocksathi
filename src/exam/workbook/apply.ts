import { flattenWorkbook, type FlatWorkbook } from '@/exam/marking/sheet/flattenWorkbook';
import { cellKey, type RangeAddress } from '@/spreadsheet/model/address';
import type { CellStyle } from '@/spreadsheet/model/styles';
import {
  snapshotWorkbook,
  workbookFromSnapshot,
  type CellSnapshot,
  type WorkbookSnapshot,
} from '@/spreadsheet/model/snapshot';
import { detectWorkbookChanges } from './detect';
import type { WorkbookStep } from './types';

/**
 * Putting a question's changes back onto a workbook.
 *
 * The inverse of `detect.ts`, for the same reason `src/exam/document/apply.ts`
 * exists: nothing but the starting workbook is stored. The sheet the admin
 * records question 8 on is the starting workbook with questions 1–7 replayed;
 * the worked answer for question 8 is the starting workbook with question 8
 * alone replayed. A question is stored only if replaying it reproduces exactly
 * what the admin's spreadsheet produced (`faithfulWorkbook`).
 *
 * Works on the snapshot — plain data — rather than on a live `Workbook`, so it
 * runs the same on the server as in the browser and needs no formula engine.
 * A replayed formula carries the value it had when it was recorded; the editor
 * recalculates it on load, and marking evaluates formulas for itself.
 */

export function projectWorkbook(snapshot: WorkbookSnapshot): FlatWorkbook {
  return flattenWorkbook(snapshot);
}

/** True when the two are the same to the marker. */
export function sameWorkbook(a: WorkbookSnapshot, b: WorkbookSnapshot): boolean {
  const detection = detectWorkbookChanges(projectWorkbook(a), projectWorkbook(b));
  return detection.problems.length === 0 && detection.steps.length === 0;
}

/**
 * A workbook reduced to what the model holds, in its canonical form.
 *
 * Rebuilt through `workbookFromSnapshot` and `snapshotWorkbook` — the path every
 * sitting takes — so what is stored is exactly what a candidate's spreadsheet
 * will load, and `snapshotWorkbook`'s size limit applies.
 */
export function normaliseWorkbook(snapshot: WorkbookSnapshot): WorkbookSnapshot {
  return snapshotWorkbook(workbookFromSnapshot(snapshot));
}

function sameRange(a: RangeAddress, b: RangeAddress): boolean {
  return a.start.row === b.start.row && a.start.col === b.start.col && a.end.row === b.end.row && a.end.col === b.end.col;
}

function applyToSnapshot(snapshot: WorkbookSnapshot, steps: readonly WorkbookStep[]): void {
  const sheet = snapshot.sheets[0];
  if (!sheet) return;

  const cells = new Map<number, CellSnapshot>(sheet.cells.map((cell) => [cellKey(cell.row, cell.col), cell]));
  const cellAt = (row: number, col: number): CellSnapshot => {
    const key = cellKey(row, col);
    let cell = cells.get(key);
    if (!cell) {
      cell = { row, col, value: null };
      cells.set(key, cell);
    }
    return cell;
  };

  for (const step of steps) {
    switch (step.kind) {
      case 'content':
        for (const change of step.cells) {
          const cell = cellAt(change.row, change.col);
          cell.value = change.value;
          if (change.formula === undefined) delete cell.formula;
          else cell.formula = change.formula;
        }
        break;

      case 'style':
        for (const change of step.cells) {
          const cell = cellAt(change.row, change.col);
          const style: Record<string, unknown> = { ...(cell.style ?? {}) };
          if (change.value === null) delete style[step.property];
          else style[step.property] = change.value;
          if (Object.keys(style).length > 0) cell.style = style as CellStyle;
          else delete cell.style;
        }
        break;

      case 'merge':
        sheet.merges = step.merged
          ? [...sheet.merges, step.range]
          : sheet.merges.filter((merge) => !sameRange(merge, step.range));
        break;

      case 'column': {
        const entry = sheet.columns.find(([col]) => col === step.col);
        const props = { ...(entry?.[1] ?? {}) };
        if (step.width) props.width = step.width.to;
        if (step.hidden) props.hidden = step.hidden.to;
        sheet.columns = [...sheet.columns.filter(([col]) => col !== step.col), [step.col, props]];
        break;
      }

      case 'row': {
        const entry = sheet.rows.find(([row]) => row === step.row);
        const props = { ...(entry?.[1] ?? {}) };
        if (step.height) props.height = step.height.to;
        if (step.hidden) props.hidden = step.hidden.to;
        sheet.rows = [...sheet.rows.filter(([row]) => row !== step.row), [step.row, props]];
        break;
      }

      case 'freeze':
        sheet.frozen = { rows: step.rows, columns: step.columns };
        break;

      case 'view':
        sheet.view = {
          ...sheet.view,
          ...(step.showGridlines === undefined ? {} : { showGridlines: step.showGridlines }),
          ...(step.showHeadings === undefined ? {} : { showHeadings: step.showHeadings }),
        };
        break;

      case 'printArea':
        sheet.printArea = step.range;
        break;
    }
  }

  sheet.cells = [...cells.values()]
    .filter((cell) => cell.value !== null || cell.formula !== undefined || cell.style !== undefined)
    .sort((a, b) => a.row - b.row || a.col - b.col);
}

/** The workbook with these steps replayed onto it. */
export function applyWorkbookSteps(snapshot: WorkbookSnapshot, steps: readonly WorkbookStep[]): WorkbookSnapshot {
  const copy = structuredClone(snapshot);
  applyToSnapshot(copy, steps);
  return copy;
}

/** The workbook after a run of questions, each replayed in turn. */
export function replayWorkbook(
  snapshot: WorkbookSnapshot,
  questions: readonly { steps: readonly WorkbookStep[] }[],
): WorkbookSnapshot {
  const copy = structuredClone(snapshot);
  for (const question of questions) applyToSnapshot(copy, question.steps);
  return copy;
}

/** True when replaying `steps` onto `before` gives exactly `after`. */
export function faithfulWorkbook(
  before: WorkbookSnapshot,
  steps: readonly WorkbookStep[],
  after: WorkbookSnapshot,
): boolean {
  return sameWorkbook(applyWorkbookSteps(before, steps), after);
}
