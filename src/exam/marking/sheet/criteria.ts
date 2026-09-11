import type { RangeAddress } from '@/spreadsheet/model/address';
import type { CellValue } from '@/spreadsheet/model/Cell';
import type { CellStyle } from '@/spreadsheet/model/styles';

/**
 * What an Excel question asks for.
 *
 * The spreadsheet counterpart of `criteria.ts`, deliberately the same shape: a
 * closed union of declarative assertions, each carrying the `label` the
 * candidate is shown. A rubric is data, so the answer key can be read and
 * checked without running it.
 *
 * Every rubric ends in `unchanged`. That is not boilerplate — it is the rule
 * the paper is built on. Applying a format the question did not ask for is a
 * wrong answer, because the paper tests whether the candidate can perform one
 * named operation, not whether they can reach a nice-looking sheet.
 */

/** Which cells a criterion is about. */
export type SheetTarget =
  | { by: 'cell'; row: number; col: number }
  | { by: 'range'; range: RangeAddress }
  /** Every occupied cell of a column, optionally skipping the header row. */
  | { by: 'column'; col: number; skipHeader?: boolean }
  /** Every occupied cell of the sheet. */
  | { by: 'sheet' };

/**
 * What may differ from the starting workbook, and where.
 *
 * Anything not exempted must be untouched. `style` names the properties the
 * question asked the candidate to change; without it, an exemption would
 * license *any* formatting on those cells.
 */
export interface SheetExemption {
  /** Cells the exemption covers. Omit to cover the whole sheet. */
  target?: SheetTarget;
  /** Style properties allowed to differ on those cells. */
  style?: (keyof CellStyle)[];
  /** Whether the value or formula of those cells may differ. */
  content?: boolean;
  /** Columns whose width or visibility may differ. */
  columns?: number[];
  /** Rows whose height or visibility may differ. */
  rows?: number[];
  /** Whether merges may be added or removed. */
  merges?: boolean;
  /** Whether the frozen panes may differ. */
  frozen?: boolean;
  /** Whether the sheet's gridlines or headings may differ. */
  view?: boolean;
  /** Whether the print area may differ. */
  printArea?: boolean;
}

export type SheetCriterion = { label: string } & (
  | {
      /** The cells hold these values. */
      kind: 'cellValue';
      target: SheetTarget;
      /** A single expected value, or several a candidate may reasonably produce. */
      equals: CellValue | CellValue[];
      /** Absolute tolerance for a computed number, e.g. a rounded average. */
      tolerance?: number;
    }
  | {
      /** The cell holds a formula. */
      kind: 'cellFormula';
      target: SheetTarget;
      /**
       * The function it must call, e.g. `SUM`.
       *
       * Checked instead of the exact text: `=SUM(B2:B7)` and `=SUM(B2:B7)+0`
       * are not the same answer, but `=sum(b2:b7)` is, and a candidate who
       * types a valid equivalent range should not be failed on spelling.
       */
      usesFunction?: string;
      /** The exact formula, compared case- and space-insensitively. */
      equals?: string;
      /** The value it must evaluate to, which is what actually proves it works. */
      resultEquals?: CellValue;
      tolerance?: number;
    }
  | {
      /** Every cell in the target carries these style properties. */
      kind: 'styled';
      target: SheetTarget;
      style: Partial<CellStyle>;
      /** Alternatives for one property, e.g. either of Excel's two reds. */
      anyOf?: { property: keyof CellStyle; values: unknown[] };
    }
  | {
      /** Every cell in the target uses this number format. */
      kind: 'numberFormat';
      target: SheetTarget;
      format: string | string[];
    }
  | {
      /**
       * The cells hold these values, in reading order.
       *
       * For a question whose answer is a *sequence* — Auto Fill's months, a
       * column of computed totals. Expressing that as one criterion per cell
       * would put a dozen near-identical lines in the candidate's feedback.
       */
      kind: 'cellSeries';
      target: SheetTarget;
      values: CellValue[];
      tolerance?: number;
      /** Each cell must also hold a formula, and call this function if named. */
      formula?: { required: true; usesFunction?: string };
    }
  | {
      /**
       * The range carries a border around its perimeter, and only there.
       *
       * Distinct from `styled` because Outside Borders is not one style applied
       * to every cell: the top row gets a top edge, the interior gets nothing.
       * Checking it as a uniform style would pass All Borders, which is the
       * answer to a different question.
       */
      kind: 'outsideBorder';
      range: RangeAddress;
    }
  | { kind: 'merged'; range: RangeAddress }
  | { kind: 'columnWidth'; col: number; atLeast?: number; atMost?: number }
  | { kind: 'frozen'; rows: number; columns: number }
  | { kind: 'sheetView'; showGridlines?: boolean; showHeadings?: boolean }
  | { kind: 'printArea'; range: RangeAddress | null }
  | { kind: 'unchanged'; except: SheetExemption[] }
);

export interface SheetQuestionRubric {
  number: number;
  criteria: SheetCriterion[];
}
