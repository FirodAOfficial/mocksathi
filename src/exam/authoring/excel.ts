import { columnToLabel, labelToColumn, type RangeAddress } from '@/spreadsheet/model/address';
import type { CellValue } from '@/spreadsheet/model/Cell';
import { blankSnapshot, type WorkbookSnapshot } from '@/spreadsheet/model/snapshot';
import type { CellStyle } from '@/spreadsheet/model/styles';
import { DEFAULT_SHEET_VIEW, type SheetView } from '@/spreadsheet/model/Worksheet';
import type { ExcelQuestion, Localised, WorkbookAnswer } from '@/exam/types';
import type { ExcelOperation, ExcelQuestionDraft } from './types';

/**
 * Turning a spreadsheet question's draft into the question the player renders.
 *
 * The counterpart of `word.ts`, and exported for the same reason: the paper an
 * admin types into the form and the fixture in `excelSeedAttempt.ts` must be
 * built by the same code, or "Merge & Center" means one thing in the fixture
 * and another in an authored question.
 */

type Row = readonly CellValue[];

/** A sheet from rows of values, with `null` for a cell left empty. */
export function sheetOf(rows: readonly Row[]): WorkbookSnapshot {
  const snapshot = blankSnapshot();
  const sheet = snapshot.sheets[0]!;

  rows.forEach((row, rowIndex) => {
    row.forEach((value, colIndex) => {
      if (value === null || value === undefined) return;
      sheet.cells.push({ row: rowIndex, col: colIndex, value });
    });
  });

  return snapshot;
}

/** Zero-based, like everything else in the engine: `range(0, 0, 0, 3)` is A1:D1. */
export function range(startRow: number, startCol: number, endRow: number, endCol: number): RangeAddress {
  return { start: { row: startRow, col: startCol }, end: { row: endRow, col: endCol } };
}

/** `range(0, 0, 0, 3)` -> `"A1:D1"`. A one-cell range is written as one address. */
export function rangeToA1(target: RangeAddress): string {
  const start = `${columnToLabel(target.start.col)}${target.start.row + 1}`;
  if (target.start.row === target.end.row && target.start.col === target.end.col) return start;
  return `${start}:${columnToLabel(target.end.col)}${target.end.row + 1}`;
}

/**
 * `"A1:D1"` -> `range(0, 0, 0, 3)`, and null for anything else.
 *
 * Its own small parser rather than `parseRangeReference`: that one also accepts
 * `$` anchors, a sheet prefix and whole-column forms like `A:A`, none of which
 * a question asks for and the last of which would name a million rows. What an
 * author types here is a plain rectangle or it is a mistake.
 */
export function rangeFromA1(text: string): RangeAddress | null {
  const match = /^\s*([A-Za-z]{1,3})(\d{1,7})(?::([A-Za-z]{1,3})(\d{1,7}))?\s*$/.exec(text);
  if (!match) return null;

  const [, startLabel, startRow, endLabel, endRow] = match;
  const startCol = labelToColumn(startLabel!);
  const endCol = endLabel ? labelToColumn(endLabel) : startCol;
  if (startCol === null || endCol === null) return null;

  const top = Number(startRow) - 1;
  const bottom = endRow ? Number(endRow) - 1 : top;
  if (top < 0 || bottom < 0) return null;

  // Normalised, so a range typed bottom-up still names the same cells.
  return range(Math.min(top, bottom), Math.min(startCol, endCol), Math.max(top, bottom), Math.max(startCol, endCol));
}

/** A model answer that only applies formatting to one range. */
export function formats(target: RangeAddress, style: Partial<CellStyle>): WorkbookAnswer {
  return { styles: [{ range: target, style }] };
}

/**
 * What a cell typed into the authoring form holds.
 *
 * A form gives back strings; a sheet holds values. Anything that reads as a
 * number becomes one, because `5000` typed into a Fee column is the number a
 * `=B2-C2` has to subtract, not the text "5000". Everything else stays text,
 * which is what a label is.
 */
export function cellValueOf(text: string): CellValue {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) return Number(trimmed);
  if (trimmed === 'TRUE' || trimmed === 'FALSE') return trimmed === 'TRUE';
  return trimmed;
}

/** The sheet a grid of typed-in strings describes. */
export function sheetFromGrid(
  grid: readonly (readonly string[])[],
  startingView?: Partial<SheetView>,
): WorkbookSnapshot {
  const snapshot = sheetOf(grid.map((row) => row.map(cellValueOf)));
  // A question can start from a sheet whose headings or gridlines are off —
  // "show them" is the whole task of one.
  if (startingView) snapshot.sheets[0]!.view = { ...DEFAULT_SHEET_VIEW, ...startingView };
  return snapshot;
}

/** Both languages' sheets from both languages' grids — what an authored question stores. */
export function workbookFromGrid(
  grid: Localised<string[][]>,
  startingView?: Partial<SheetView>,
): Localised<WorkbookSnapshot> {
  return {
    en: sheetFromGrid(grid.en, startingView),
    hi: sheetFromGrid(grid.hi, startingView),
  };
}

/** Each row of a range, on its own — what Merge Across produces. */
export function rowsOf(target: RangeAddress): RangeAddress[] {
  const rows: RangeAddress[] = [];
  for (let row = target.start.row; row <= target.end.row; row += 1) {
    rows.push(range(row, target.start.col, row, target.end.col));
  }
  return rows;
}

/**
 * The four edges of a range, as separate one-cell-thick styles.
 *
 * Outside Borders is not one style applied to every cell: the top row gets a
 * top edge and the interior gets nothing. Writing it as a uniform style would
 * describe All Borders, which is the answer to a different question.
 */
export function outsideBorderStyles(
  target: RangeAddress,
  color = '#000000',
): NonNullable<WorkbookAnswer['styles']> {
  const edge = { style: 'thin' as const, color };

  return [
    { range: range(target.start.row, target.start.col, target.start.row, target.end.col), style: { borders: { top: edge } } },
    { range: range(target.end.row, target.start.col, target.end.row, target.end.col), style: { borders: { bottom: edge } } },
    { range: range(target.start.row, target.start.col, target.end.row, target.start.col), style: { borders: { left: edge } } },
    { range: range(target.start.row, target.end.col, target.end.row, target.end.col), style: { borders: { right: edge } } },
  ];
}

/** How the workbook looks once the question has been answered correctly. */
export function excelModelAnswer(operations: readonly ExcelOperation[]): WorkbookAnswer {
  const answer: WorkbookAnswer = {};

  const addStyles = (styles: NonNullable<WorkbookAnswer['styles']>) => {
    answer.styles = [...(answer.styles ?? []), ...styles];
  };

  for (const operation of operations) {
    switch (operation.kind) {
      case 'merge': {
        const merges = operation.across ? rowsOf(operation.range) : [operation.range];
        answer.merges = [...(answer.merges ?? []), ...merges];
        // Merge & Center centres as well as merges; plain Merge does not.
        if (operation.centre) {
          addStyles([{ range: operation.range, style: { horizontalAlignment: 'center' } }]);
        }
        break;
      }
      case 'style':
        addStyles([{ range: operation.range, style: operation.style }]);
        break;
      case 'outsideBorder':
        addStyles(outsideBorderStyles(operation.range, operation.color));
        break;
      case 'values':
        answer.cells = [...(answer.cells ?? []), ...operation.cells];
        break;
      case 'columnWidth':
        answer.columns = [...(answer.columns ?? []), [operation.col, { width: operation.width }]];
        break;
      case 'freeze':
        answer.frozen = { rows: operation.rows, columns: operation.columns };
        break;
      case 'view': {
        const { kind: _kind, ...view } = operation;
        answer.view = { ...answer.view, ...view };
        break;
      }
      case 'printArea':
        answer.printArea = operation.range;
        break;
    }
  }

  return answer;
}

/** The draft as the question the player renders. */
export function buildExcelQuestion(draft: ExcelQuestionDraft): ExcelQuestion {
  return {
    subject: 'excel',
    number: draft.number,
    topic: draft.topic,
    difficulty: draft.difficulty,
    instruction: draft.instruction,
    // A fresh sheet per question and per language: each owns its workbook, so
    // work on one cannot leak into another.
    workbook: draft.workbook,
    solution: draft.solution,
    modelAnswer: excelModelAnswer(draft.operations),
    marks: draft.marks,
    bookmarked: false,
  };
}
