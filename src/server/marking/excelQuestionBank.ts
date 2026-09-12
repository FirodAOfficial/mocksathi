import 'server-only';

import {
  DUE_FEES,
  FULL_NAMES,
  MAX_MARK,
  MIN_MARK,
  MONTHS,
  PREFIXED_IDS,
  TARGETS,
} from '@/exam/excelSeedAttempt';
import type {
  SheetCriterion,
  SheetExemption,
  SheetQuestionRubric,
} from '@/exam/marking/sheet/criteria';
import type { RangeAddress } from '@/spreadsheet/model/address';
import type { CellStyle } from '@/spreadsheet/model/styles';

/**
 * The Excel answer key.
 *
 * `import 'server-only'` is the point of this module, exactly as it is for the
 * Word bank: it holds the answers, so an accidental import from a client
 * component must fail the build rather than quietly ship the marking scheme to
 * every candidate's browser. `serverSafety.test.ts` walks the import graph
 * below this file for the same reason.
 *
 * Every rubric is one or two positive assertions plus a closing `unchanged`.
 * That closer is what makes the paper strict: doing what was asked *and*
 * something else is not a correct answer with a bonus, because the question
 * tested one named operation.
 *
 * Expected values are imported from the paper rather than retyped, so a change
 * to the data cannot leave the key marking against numbers that are no longer
 * on the sheet.
 */

const NOTHING_ELSE = 'Nothing was changed beyond what the question asked for';

/** The closing criterion, with the one thing the question did ask for exempted. */
function onlyThis(...except: SheetExemption[]): SheetCriterion {
  return { kind: 'unchanged', label: NOTHING_ELSE, except };
}

/** A question that asks for formatting properties on one range. */
function formatting(
  range: RangeAddress,
  style: Partial<CellStyle>,
  label: string,
  anyOf?: { property: keyof CellStyle; values: unknown[] },
): SheetCriterion[] {
  return [
    { kind: 'styled', label, target: { by: 'range', range }, style, ...(anyOf ? { anyOf } : {}) },
    onlyThis({ target: { by: 'range', range }, style: Object.keys(style) as (keyof CellStyle)[] }),
  ];
}

/** Merge & Center: one merge plus the centring, which the button does together. */
function mergeAndCentre(range: RangeAddress, extra: Partial<CellStyle> = {}): SheetCriterion[] {
  const styled: Partial<CellStyle> = { horizontalAlignment: 'center', ...extra };

  return [
    { kind: 'merged', label: `${describe(range)} is merged into one cell`, range },
    {
      kind: 'styled',
      label: 'The heading is centred across the merged cell',
      target: { by: 'cell', row: range.start.row, col: range.start.col },
      style: styled,
    },
    onlyThis({
      target: { by: 'range', range },
      style: Object.keys(styled) as (keyof CellStyle)[],
      content: true,
      merges: true,
    }),
  ];
}

function describe(range: RangeAddress): string {
  return `${column(range.start.col)}${range.start.row + 1}:${column(range.end.col)}${range.end.row + 1}`;
}

function column(index: number): string {
  return String.fromCharCode(65 + index);
}

/** Excel's two blues and two reds — a candidate may reasonably pick either. */
const DARK_BLUES = ['#002060', '#1f497d'];
const ORANGES = ['#e36c0a', '#ffc000'];

export const EXCEL_QUESTION_BANK: SheetQuestionRubric[] = [
  { number: 1, criteria: mergeAndCentre(TARGETS.q1Title) },

  {
    number: 2,
    criteria: formatting(
      TARGETS.q2Title,
      { fontFamily: 'Calibri', fontSize: 20, bold: true },
      'A1:D1 is Calibri, 20 pt and bold',
    ),
  },

  {
    number: 3,
    criteria: formatting(
      TARGETS.q3Header,
      { fontColor: '#002060', fillColor: '#ffff00', fontSize: 19, italic: true },
      'A2:D2 is dark blue on yellow, 19 pt and italic',
      { property: 'fontColor', values: DARK_BLUES },
    ),
  },

  {
    number: 4,
    criteria: [
      {
        kind: 'outsideBorder',
        label: 'A1:D6 has a border around its outside edge, and none inside it',
        range: TARGETS.q4Table,
      },
      onlyThis({ target: { by: 'range', range: TARGETS.q4Table }, style: ['borders'] }),
    ],
  },

  {
    number: 5,
    criteria: [
      {
        kind: 'numberFormat',
        label: 'D2:D6 shows currency with no decimal places',
        target: { by: 'range', range: TARGETS.q5Fees },
        format: '₹#,##0',
      },
      {
        kind: 'styled',
        label: 'D2:D6 has an orange background',
        target: { by: 'range', range: TARGETS.q5Fees },
        style: { fillColor: '#e36c0a' },
        anyOf: { property: 'fillColor', values: ORANGES },
      },
      onlyThis({ target: { by: 'range', range: TARGETS.q5Fees }, style: ['numberFormat', 'fillColor'] }),
    ],
  },

  {
    number: 6,
    criteria: [
      {
        kind: 'cellSeries',
        label: 'A2:A6 reads STU1101 to STU1105',
        target: { by: 'range', range: TARGETS.q6Ids },
        values: [...PREFIXED_IDS],
      },
      onlyThis({ target: { by: 'range', range: TARGETS.q6Ids }, content: true }),
    ],
  },

  {
    number: 7,
    criteria: [
      {
        kind: 'cellSeries',
        label: 'D2:D6 builds each full name with CONCAT',
        target: { by: 'range', range: TARGETS.q7FullNames },
        values: [...FULL_NAMES],
        // A typed-in name looks identical on the sheet and demonstrates none of
        // the skill, so the formula is required as well as the result.
        formula: { required: true, usesFunction: 'CONCAT' },
      },
      onlyThis({ target: { by: 'range', range: TARGETS.q7FullNames }, content: true }),
    ],
  },

  {
    number: 8,
    criteria: [
      {
        kind: 'cellSeries',
        label: 'D2:D6 works out each due fee with a formula',
        target: { by: 'range', range: TARGETS.q8DueFees },
        values: [...DUE_FEES],
        // No function named: `=B2-C2` is the answer, however it is arranged.
        formula: { required: true },
      },
      onlyThis({ target: { by: 'range', range: TARGETS.q8DueFees }, content: true }),
    ],
  },

  {
    number: 9,
    criteria: [
      {
        kind: 'cellSeries',
        label: 'A3:A13 continues the months from Feb to Dec',
        target: { by: 'range', range: TARGETS.q9Months },
        values: [...MONTHS.slice(1)],
      },
      onlyThis({ target: { by: 'range', range: TARGETS.q9Months }, content: true }),
    ],
  },

  {
    number: 10,
    criteria: [
      {
        kind: 'cellFormula',
        label: 'B8 finds the lowest mark with a formula',
        target: { by: 'cell', ...TARGETS.q10Minimum },
        usesFunction: 'MIN',
        resultEquals: MIN_MARK,
      },
      onlyThis({ target: { by: 'cell', ...TARGETS.q10Minimum }, content: true }),
    ],
  },

  {
    number: 11,
    criteria: [
      {
        kind: 'cellFormula',
        label: 'B8 finds the highest mark with a formula',
        target: { by: 'cell', ...TARGETS.q11Maximum },
        usesFunction: 'MAX',
        resultEquals: MAX_MARK,
      },
      onlyThis({ target: { by: 'cell', ...TARGETS.q11Maximum }, content: true }),
    ],
  },

  {
    number: 12,
    criteria: [
      {
        kind: 'merged',
        label: 'A1:D1 is merged as its own row',
        range: { start: { row: 0, col: 0 }, end: { row: 0, col: 3 } },
      },
      {
        // Both rows, separately. Merge & Center would give one cell spanning
        // A1:D2, which is the answer to question 1, not this one.
        kind: 'merged',
        label: 'A2:D2 is merged as its own row',
        range: { start: { row: 1, col: 0 }, end: { row: 1, col: 3 } },
      },
      onlyThis({ target: { by: 'range', range: TARGETS.q12Across }, content: true, merges: true }),
    ],
  },

  {
    number: 13,
    criteria: [
      ...mergeAndCentre(TARGETS.q13Heading, { textEffect: 'subscript', fillColor: '#ffff00' }),
    ],
  },

  {
    number: 14,
    criteria: [
      { kind: 'sheetView', label: 'The row and column headings are shown', showHeadings: true },
      onlyThis({ view: true }),
    ],
  },

  {
    number: 15,
    criteria: [
      {
        kind: 'printArea',
        label: 'The print area is A1:D5, leaving the Month table out',
        range: TARGETS.q15PrintArea,
      },
      onlyThis({ printArea: true }),
    ],
  },
];

export function excelRubricFor(questionNumber: number): SheetQuestionRubric | undefined {
  return EXCEL_QUESTION_BANK.find((rubric) => rubric.number === questionNumber);
}
