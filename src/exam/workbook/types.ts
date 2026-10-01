import type { RangeAddress } from '@/spreadsheet/model/address';
import type { CellValue } from '@/spreadsheet/model/Cell';
import type { CellStyle } from '@/spreadsheet/model/styles';

/**
 * An Excel paper written on one workbook.
 *
 * The spreadsheet counterpart of `src/exam/document/`, built the same way and
 * for the same reason: the admin enters the starting sheet once in the real
 * spreadsheet and then *performs* each question on it in turn; what changed is
 * detected from the workbook before and after (`detect.ts`) and stored as the
 * question. Candidates answer on one shared workbook in any order, and each
 * question is marked only on what changed while it was open.
 *
 * Unlike a Word passage, a sheet's *contents* are fair game — "type the total
 * in B8" is the commonest Excel question there is. What stays fixed is where
 * things are: changes are addressed by cell, and inserting or deleting rows or
 * columns (which would move every later question's cells) is not recordable.
 * Only the first sheet is marked, as in the per-question papers.
 *
 * Everything here is plain JSON, kept in `excel_doc_questions.steps`.
 */

/** A cell, 0-based. */
export interface CellRef {
  row: number;
  col: number;
}

/** The style properties marking compares — exactly those `canonicalStyle` keeps. */
export type StyleProperty = Exclude<keyof CellStyle, 'quotePrefix'>;

/** A typed value or a formula going into a cell, or the cell being cleared. */
export interface ContentChange extends CellRef {
  /** What the cell shows afterwards. For a formula, the result when it was recorded. */
  value: CellValue;
  /** The formula afterwards, when the cell holds one. */
  formula?: string;
  previous: CellValue;
  previousFormula?: string;
}

/** One style property set (or taken off) on some cells. */
export interface StyleChange extends CellRef {
  /** The canonical value afterwards; `null` when the property was taken off. */
  value: unknown;
  previous: unknown;
}

export type WorkbookStep =
  /** Values and formulas entered or cleared. */
  | { kind: 'content'; cells: ContentChange[] }
  | {
      kind: 'style';
      property: StyleProperty;
      cells: StyleChange[];
      /**
       * Further cells this step may touch without failing "nothing else
       * changed": cells inside the changed area that already carried the new
       * value. Selecting A1:D1 to bold it when A1 was bold already is the same
       * operation, in whichever order the candidate meets the two questions.
       */
      licence: CellRef[];
    }
  | { kind: 'merge'; range: RangeAddress; merged: boolean }
  | {
      kind: 'column';
      col: number;
      width?: { from: number; to: number };
      hidden?: { from: boolean; to: boolean };
    }
  | {
      kind: 'row';
      row: number;
      height?: { from: number; to: number };
      hidden?: { from: boolean; to: boolean };
    }
  | { kind: 'freeze'; rows: number; columns: number; previous: { rows: number; columns: number } }
  | { kind: 'view'; showGridlines?: boolean; showHeadings?: boolean }
  | { kind: 'printArea'; range: RangeAddress | null; previous: RangeAddress | null };
