import 'server-only';

import { colourAlternatives } from '@/editor/functions/colours';
import type { SheetExemption, SheetQuestionRubric } from '@/exam/marking/sheet/criteria';
import type { WorkbookCriterion } from '@/exam/marking/sheet/workbookMarker';
import { cellsToRanges, describeWorkbookStep, rangeA1 } from '@/exam/workbook/describe';
import type { ContentChange, WorkbookStep } from '@/exam/workbook/types';
import { columnToLabel } from '@/spreadsheet/model/address';

/**
 * The answer key for a single-workbook question, built from what was detected.
 *
 * `server-only`, like every module holding answers. As for Word, the key is
 * "while this question was open, exactly this changed": each detected change is
 * a statement about the candidate's sheet after their visit, and one closing
 * `unchanged` licenses those changes and nothing else. Neither half mentions
 * another question, which is what makes the order irrelevant.
 */

const NOTHING_ELSE = 'Nothing else on the sheet was changed while this question was open';

const COLOURS = new Set(['fontColor', 'fillColor']);

/** The function a formula opens with, if any — the per-question papers' leniency. */
function functionCalled(formula: string): string | undefined {
  const match = /^\s*=\s*([A-Za-z][A-Za-z0-9._]*)\s*\(/.exec(formula);
  return match ? match[1]!.toUpperCase() : undefined;
}

function a1(row: number, col: number): string {
  return `${columnToLabel(col)}${row + 1}`;
}

/** The single run of cells, down one column or along one row, or null. */
function runOf(cells: readonly ContentChange[]): { start: { row: number; col: number }; end: { row: number; col: number } } | null {
  if (cells.length < 2) return null;
  const ranges = cellsToRanges(cells);
  if (ranges.length !== 1) return null;
  const [range] = ranges;
  return range!.start.row === range!.end.row || range!.start.col === range!.end.col ? range! : null;
}

function contentCriteria(cells: ContentChange[]): WorkbookCriterion[] {
  const ordered = [...cells].sort((a, b) => a.row - b.row || a.col - b.col);
  const values = ordered.filter((cell) => cell.formula === undefined);
  const formulas = ordered.filter((cell) => cell.formula !== undefined);
  const criteria: WorkbookCriterion[] = [];

  // A run of typed values is one line of feedback, not a dozen.
  const run = values.length === ordered.length ? runOf(values) : null;
  if (run) {
    criteria.push({
      kind: 'cellSeries',
      label: `${rangeA1(run)} holds the expected values`,
      target: { by: 'range', range: run },
      values: values.map((cell) => cell.value),
    });
  } else {
    for (const cell of values) {
      criteria.push({
        kind: 'cellValue',
        label: cell.value === null ? `${a1(cell.row, cell.col)} is cleared` : `${a1(cell.row, cell.col)} holds the expected value`,
        target: { by: 'cell', row: cell.row, col: cell.col },
        equals: cell.value,
      });
    }
  }

  for (const cell of formulas) {
    const usesFunction = functionCalled(cell.formula!);
    criteria.push({
      kind: 'formulaLike',
      label: `${a1(cell.row, cell.col)} holds a formula${usesFunction ? ` using ${usesFunction}` : ''} that gives the right result`,
      row: cell.row,
      col: cell.col,
      formula: cell.formula!,
      ...(usesFunction ? { usesFunction } : {}),
    });
  }

  return criteria;
}

/** The midpoint between before and after: dragging a border lands near a size, never on it. */
function towards(from: number, to: number): { atLeast?: number; atMost?: number } {
  const middle = Math.round((from + to) / 2);
  return to > from ? { atLeast: middle } : { atMost: middle };
}

export function workbookRubricFor(number: number, steps: readonly WorkbookStep[]): SheetQuestionRubric {
  const criteria: WorkbookCriterion[] = [];
  const exemptions: SheetExemption[] = [];

  for (const step of steps) {
    switch (step.kind) {
      case 'content':
        criteria.push(...contentCriteria(step.cells));
        // Typing is what sets a date's or a percentage's format, so the format
        // of a cell the question asks to fill is allowed to change with it.
        for (const cell of step.cells) {
          exemptions.push({ target: { by: 'cell', row: cell.row, col: cell.col }, content: true, style: ['numberFormat'] });
        }
        break;

      case 'style': {
        criteria.push({
          kind: 'cellProperty',
          label: describeWorkbookStep(step),
          property: step.property,
          cells: step.cells.map((cell) => {
            const alternatives = COLOURS.has(step.property) && typeof cell.value === 'string' ? colourAlternatives(cell.value) : undefined;
            return { row: cell.row, col: cell.col, value: cell.value, ...(alternatives ? { anyOf: alternatives } : {}) };
          }),
        });
        for (const range of cellsToRanges([...step.cells, ...step.licence])) {
          exemptions.push({ target: { by: 'range', range }, style: [step.property] });
        }
        break;
      }

      case 'merge':
        criteria.push(
          step.merged
            ? { kind: 'merged', label: `${rangeA1(step.range)} is merged into one cell`, range: step.range }
            : { kind: 'notMerged', label: `${rangeA1(step.range)} is unmerged`, range: step.range },
        );
        // Merging moves content out of the covered cells.
        exemptions.push({ merges: true }, { target: { by: 'range', range: step.range }, content: true });
        break;

      case 'column':
        if (step.width) {
          criteria.push({
            kind: 'columnWidth',
            label: `Column ${columnToLabel(step.col)} is ${step.width.to > step.width.from ? 'widened' : 'narrowed'}`,
            col: step.col,
            ...towards(step.width.from, step.width.to),
          });
        }
        if (step.hidden) {
          criteria.push({
            kind: 'columnHidden',
            label: `Column ${columnToLabel(step.col)} is ${step.hidden.to ? 'hidden' : 'unhidden'}`,
            col: step.col,
            hidden: step.hidden.to,
          });
        }
        exemptions.push({ columns: [step.col] });
        break;

      case 'row':
        if (step.height) {
          criteria.push({
            kind: 'rowSize',
            label: `Row ${step.row + 1} is ${step.height.to > step.height.from ? 'taller' : 'shorter'}`,
            row: step.row,
            ...towards(step.height.from, step.height.to),
          });
        }
        if (step.hidden) {
          criteria.push({
            kind: 'rowHidden',
            label: `Row ${step.row + 1} is ${step.hidden.to ? 'hidden' : 'unhidden'}`,
            row: step.row,
            hidden: step.hidden.to,
          });
        }
        exemptions.push({ rows: [step.row] });
        break;

      case 'freeze':
        criteria.push({
          kind: 'frozen',
          label:
            step.rows === 0 && step.columns === 0
              ? 'The panes are unfrozen'
              : `${step.rows} row(s) and ${step.columns} column(s) are frozen`,
          rows: step.rows,
          columns: step.columns,
        });
        exemptions.push({ frozen: true });
        break;

      case 'view': {
        const asked = [
          step.showGridlines === undefined ? null : `gridlines are ${step.showGridlines ? 'shown' : 'hidden'}`,
          step.showHeadings === undefined ? null : `headings are ${step.showHeadings ? 'shown' : 'hidden'}`,
        ].filter((part) => part !== null);
        criteria.push({
          kind: 'sheetView',
          label: `The ${asked.join(' and the ')}`,
          ...(step.showGridlines === undefined ? {} : { showGridlines: step.showGridlines }),
          ...(step.showHeadings === undefined ? {} : { showHeadings: step.showHeadings }),
        });
        exemptions.push({ view: true });
        break;
      }

      case 'printArea':
        criteria.push({
          kind: 'printArea',
          label: step.range ? `The print area is ${rangeA1(step.range)}` : 'The print area is cleared',
          range: step.range,
        });
        exemptions.push({ printArea: true });
        break;
    }
  }

  criteria.push({ kind: 'unchanged', label: NOTHING_ELSE, except: exemptions });
  // The shared rubric type holds `SheetCriterion`; the extra kinds are only
  // ever read by `workbookMarker`, which knows them.
  return { number, criteria: criteria as SheetQuestionRubric['criteria'] };
}
