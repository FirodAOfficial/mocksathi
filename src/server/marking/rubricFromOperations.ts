import 'server-only';

import type {
  ExcelOperation,
  ExcelQuestionDraft,
  QuestionDraft,
  WordOperation,
  WordQuestionDraft,
  WordScope,
  AnswerCell,
} from '@/exam/authoring';
import { rangeToA1 } from '@/exam/authoring';
import type { Criterion, Exemption, QuestionRubric, Target } from '@/exam/marking/criteria';
import type { MarkName } from '@/exam/marking/flatten';
import type {
  SheetCriterion,
  SheetExemption,
  SheetQuestionRubric,
} from '@/exam/marking/sheet/criteria';
import type { RangeAddress } from '@/spreadsheet/model/address';
import type { CellStyle } from '@/spreadsheet/model/styles';
import type { ParagraphFormatting } from '@/services/document/types';
import { INDENT_STEP_PX } from '@/utils/indent';

/**
 * The answer key for an authored paper, derived from what its questions ask.
 *
 * `import 'server-only'` is the point of this module, exactly as it is for
 * `questionBank.ts` and `excelQuestionBank.ts`: it produces the marking scheme,
 * so an accidental import from a client component must fail the build rather
 * than ship it to every candidate's browser.
 *
 * The hand-written banks state each question's criteria directly. An authored
 * question cannot: nobody is going to type a `Criterion` into an admin form,
 * and if they could, nothing would keep it in step with the instruction beside
 * it. So the same `operations` that produce the model answer produce the key —
 * one statement of what the question asks, feeding both. A question cannot be
 * marked against something other than what it showed.
 *
 * **Every rubric ends in `unchanged`.** That is the rule the papers are built
 * on, not boilerplate: doing what was asked *and* something else is a wrong
 * answer, because the question tested one named operation. Each operation
 * contributes its positive criterion *and* the exemption that licenses exactly
 * that change and no other.
 */

const NOTHING_ELSE = 'Nothing was changed beyond what the question asked for';

/* -- Colours --------------------------------------------------------------- */

/**
 * What to call a colour in feedback the candidate reads.
 *
 * "The paragraph is highlighted #00ff00" tells them nothing; "highlighted
 * green" tells them what to look for in the palette.
 */
const COLOUR_NAMES: Record<string, string> = {
  '#000000': 'black',
  '#ffffff': 'white',
  '#ff0000': 'red',
  '#c00000': 'dark red',
  '#00ff00': 'green',
  '#008000': 'dark green',
  '#0000ff': 'blue',
  '#002060': 'dark blue',
  '#1f497d': 'dark blue',
  '#ffff00': 'yellow',
  '#ffc000': 'amber',
  '#e36c0a': 'orange',
  '#7030a0': 'purple',
};

/**
 * Colours a candidate may reasonably reach for instead, and still be right.
 *
 * Office's palettes carry two reds and two dark blues, and which one a
 * candidate lands on is not what the question is testing — the hand-written
 * banks make the same allowance (`REDS`, `DARK_BLUES`). Without this an
 * authored question would be stricter than the sample papers for no reason
 * anyone could explain to the candidate who got it "wrong".
 */
const COLOUR_ALTERNATIVES: Record<string, string[]> = {
  '#ff0000': ['#ff0000', '#c00000'],
  '#c00000': ['#c00000', '#ff0000'],
  '#002060': ['#002060', '#1f497d'],
  '#1f497d': ['#1f497d', '#002060'],
  '#e36c0a': ['#e36c0a', '#ffc000'],
  '#ffc000': ['#ffc000', '#e36c0a'],
};

function colourName(hex: string): string {
  return COLOUR_NAMES[hex.toLowerCase()] ?? hex;
}

function acceptedColours(hex: string): string | string[] {
  return COLOUR_ALTERNATIVES[hex.toLowerCase()] ?? hex.toLowerCase();
}

/* -- Word ------------------------------------------------------------------ */

function wordTarget(scope: WordScope): Target {
  return scope === 'all'
    ? { by: 'block', block: 0 }
    : { by: 'range', block: 0, from: scope.from, to: scope.to };
}

/** What the criterion labels call the text under test. */
function wordSubject(scope: WordScope): string {
  return scope === 'all' ? 'The paragraph' : 'The named line';
}

/**
 * One operation's contribution to the key: what must be true, and what it is
 * therefore allowed to have changed.
 */
interface WordPiece {
  criterion: Criterion;
  /** Character formatting this operation licenses. */
  mark?: MarkName;
  /** Paragraph formatting this operation licenses. */
  paragraph?: keyof ParagraphFormatting;
}

function wordPiece(operation: WordOperation, scope: WordScope): WordPiece {
  const target = wordTarget(scope);
  const subject = wordSubject(scope);

  switch (operation.kind) {
    case 'bold':
    case 'italic':
    case 'underline':
    case 'strike': {
      const named = operation.kind === 'strike' ? 'struck through' : `${operation.kind}`;
      return {
        criterion: { kind: 'marked', label: `${subject} is ${named}`, target, mark: operation.kind },
        mark: operation.kind,
      };
    }

    case 'highlight':
      return {
        criterion: {
          kind: 'marked',
          label: `${subject} is highlighted ${colourName(operation.color)}`,
          target,
          mark: 'highlight',
          value: acceptedColours(operation.color),
        },
        mark: 'highlight',
      };

    case 'fontColor':
      return {
        criterion: {
          kind: 'marked',
          label: `${subject} is ${colourName(operation.color)}`,
          target,
          // The editor calls it `color`; the ribbon calls it Font Colour.
          mark: 'color',
          value: acceptedColours(operation.color),
        },
        mark: 'color',
      };

    case 'fontFamily':
      return {
        criterion: {
          kind: 'marked',
          label: `${subject} is in ${operation.family}`,
          target,
          mark: 'fontFamily',
          value: operation.family,
        },
        mark: 'fontFamily',
      };

    case 'fontSize':
      return {
        criterion: {
          kind: 'marked',
          label: `${subject} is ${operation.size} pt`,
          target,
          // A number, not "15pt": the projection canonicalises sizes to points.
          mark: 'fontSize',
          value: operation.size,
        },
        mark: 'fontSize',
      };

    // Alignment, spacing and indent are properties of a paragraph — Word has no
    // way to centre half a line — so these address the block whatever the
    // question was scoped to, matching what `wordModelAnswer` shows.
    case 'align':
      return {
        criterion: {
          kind: 'blockAttr',
          label: `The paragraph is ${operation.align === 'justify' ? 'justified' : `${operation.align}-aligned`}`,
          block: 0,
          attr: 'align',
          value: operation.align,
        },
        paragraph: 'align',
      };

    case 'lineHeight':
      return {
        criterion: {
          kind: 'blockAttr',
          label: `The line spacing is ${operation.value.toFixed(1)}`,
          block: 0,
          attr: 'lineHeight',
          value: operation.value,
        },
        paragraph: 'lineHeight',
      };

    case 'indent':
      return {
        criterion: {
          kind: 'blockAttr',
          label: `The paragraph is indented by ${operation.levels} level${operation.levels === 1 ? '' : 's'}`,
          block: 0,
          attr: 'indentLeft',
          value: operation.levels * INDENT_STEP_PX,
        },
        paragraph: 'indentLeft',
      };
  }
}

/**
 * The key for one authored Word question.
 *
 * One exemption covers the lot: its `marks` are licensed only on the scoped
 * text, while its `paragraph` entries reach the whole block — which is what
 * `checkUnchanged` does with a range target, and exactly the split the model
 * answer makes.
 */
export function wordRubricFor(draft: WordQuestionDraft): QuestionRubric {
  const pieces = draft.operations.map((operation) => wordPiece(operation, draft.scope));

  const marks = [...new Set(pieces.flatMap((piece) => (piece.mark ? [piece.mark] : [])))];
  const paragraph = [...new Set(pieces.flatMap((piece) => (piece.paragraph ? [piece.paragraph] : [])))];

  const exemption: Exemption = {
    target: wordTarget(draft.scope),
    ...(marks.length > 0 ? { marks } : {}),
    ...(paragraph.length > 0 ? { paragraph } : {}),
  };

  return {
    number: draft.number,
    criteria: [
      ...pieces.map((piece) => piece.criterion),
      { kind: 'unchanged', label: NOTHING_ELSE, except: [exemption] },
    ],
  };
}

/* -- Excel ----------------------------------------------------------------- */

function eachRow(target: RangeAddress): RangeAddress[] {
  const rows: RangeAddress[] = [];
  for (let row = target.start.row; row <= target.end.row; row += 1) {
    rows.push({ start: { row, col: target.start.col }, end: { row, col: target.end.col } });
  }
  return rows;
}

/**
 * The function a formula calls, if it opens with one.
 *
 * Checked instead of the exact text wherever it exists: `=SUM(B2:B7)` and
 * `=SUM(B2:B8)-B8` are not the same answer, but `=sum(b2:b7)` is, and a
 * candidate should not be failed on spelling. A formula that is pure
 * arithmetic — `=B2-C2` — has no function to name, and is then held to the
 * value it produces instead, which is what actually proves it works.
 */
function functionCalled(formula: string): string | undefined {
  const match = /^\s*=\s*([A-Za-z][A-Za-z0-9._]*)\s*\(/.exec(formula);
  return match ? match[1]!.toUpperCase() : undefined;
}

/** Cells in reading order, so a series lines up with what `resolveTarget` returns. */
function inReadingOrder(cells: readonly AnswerCell[]): AnswerCell[] {
  return [...cells].sort((a, b) => (a.row === b.row ? a.col - b.col : a.row - b.row));
}

/**
 * The single range a set of cells fills, or null if they are scattered.
 *
 * A run down one column or along one row becomes a `cellSeries` — one line of
 * feedback for "the months are filled in", rather than eleven near-identical
 * ones saying the same thing about each cell in turn.
 */
function runRange(cells: readonly AnswerCell[]): RangeAddress | null {
  if (cells.length < 2) return null;
  const first = cells[0]!;
  const last = cells[cells.length - 1]!;

  const downOneColumn =
    cells.every((cell, index) => cell.col === first.col && cell.row === first.row + index);
  if (downOneColumn) return { start: { row: first.row, col: first.col }, end: { row: last.row, col: last.col } };

  const alongOneRow =
    cells.every((cell, index) => cell.row === first.row && cell.col === first.col + index);
  if (alongOneRow) return { start: { row: first.row, col: first.col }, end: { row: last.row, col: last.col } };

  return null;
}

/** What the question asks those cells to hold. */
function valueCriteria(operation: Extract<ExcelOperation, { kind: 'values' }>): SheetCriterion[] {
  const cells = inReadingOrder(operation.cells);
  const everyCellHasAFormula = cells.every((cell) => cell.formula !== undefined);
  const noCellHasAFormula = cells.every((cell) => cell.formula === undefined);
  const run = runRange(cells);

  // A run of cells that are all alike collapses into one criterion.
  if (run && (everyCellHasAFormula || noCellHasAFormula)) {
    const functions = new Set(cells.map((cell) => (cell.formula ? functionCalled(cell.formula) : undefined)));
    const usesFunction = functions.size === 1 ? [...functions][0] : undefined;

    return [
      {
        kind: 'cellSeries',
        label: `${rangeToA1(run)} holds the expected ${everyCellHasAFormula ? 'formulas' : 'values'}`,
        target: { by: 'range', range: run },
        values: cells.map((cell) => cell.value ?? null),
        ...(everyCellHasAFormula
          ? { formula: { required: true as const, ...(usesFunction ? { usesFunction } : {}) } }
          : {}),
      },
    ];
  }

  return cells.map((cell): SheetCriterion => {
    const at = rangeToA1({ start: { row: cell.row, col: cell.col }, end: { row: cell.row, col: cell.col } });
    const target = { by: 'cell' as const, row: cell.row, col: cell.col };

    if (cell.formula) {
      const usesFunction = functionCalled(cell.formula);
      return {
        kind: 'cellFormula',
        label: `${at} holds a formula${usesFunction ? ` using ${usesFunction}` : ''}`,
        target,
        ...(usesFunction ? { usesFunction } : {}),
        ...(cell.value === undefined ? {} : { resultEquals: cell.value }),
      };
    }

    return { kind: 'cellValue', label: `${at} holds the expected value`, target, equals: cell.value ?? null };
  });
}

/** One operation's contribution: what must be true, and what it licenses changing. */
interface ExcelPiece {
  criteria: SheetCriterion[];
  exemptions: SheetExemption[];
}

function excelPiece(operation: ExcelOperation): ExcelPiece {
  switch (operation.kind) {
    case 'merge': {
      const where = rangeToA1(operation.range);
      const merges = operation.across ? eachRow(operation.range) : [operation.range];

      const criteria: SheetCriterion[] = merges.map((merge) => ({
        kind: 'merged',
        label: `${rangeToA1(merge)} is merged into one cell`,
        range: merge,
      }));

      if (operation.centre) {
        criteria.push({
          kind: 'styled',
          label: `${where} is centred`,
          // The anchor, not the range: merging leaves the covered cells empty,
          // and it is the anchor that carries the merged cell's formatting.
          target: { by: 'cell', row: operation.range.start.row, col: operation.range.start.col },
          style: { horizontalAlignment: 'center' },
        });
      }

      return {
        criteria,
        exemptions: [
          {
            target: { by: 'range', range: operation.range },
            ...(operation.centre ? { style: ['horizontalAlignment' as const] } : {}),
            // Merging moves content out of the covered cells, so that is not a
            // change the candidate made beyond what was asked.
            content: true,
            merges: true,
          },
        ],
      };
    }

    case 'style': {
      const where = rangeToA1(operation.range);
      const properties = Object.keys(operation.style) as (keyof CellStyle)[];

      // `anyOf` carries alternatives for one property only, so it goes to the
      // first colour that has any — in practice a question names at most one
      // colour whose twin a candidate might reasonably pick instead.
      const lenient = properties
        .map((property) => {
          const value = operation.style[property];
          if (typeof value !== 'string') return null;
          const alternatives = COLOUR_ALTERNATIVES[value.toLowerCase()];
          return alternatives ? { property, values: alternatives } : null;
        })
        .find((entry) => entry !== null);

      return {
        criteria: [
          {
            kind: 'styled',
            label: `${where} carries the formatting the question asked for`,
            target: { by: 'range', range: operation.range },
            style: operation.style,
            ...(lenient ? { anyOf: lenient } : {}),
          },
        ],
        exemptions: [{ target: { by: 'range', range: operation.range }, style: properties }],
      };
    }

    case 'outsideBorder':
      return {
        criteria: [
          {
            kind: 'outsideBorder',
            label: `${rangeToA1(operation.range)} has a border around its outside edge, and none inside it`,
            range: operation.range,
          },
        ],
        exemptions: [{ target: { by: 'range', range: operation.range }, style: ['borders'] }],
      };

    case 'values':
      return {
        criteria: valueCriteria(operation),
        // One exemption per cell rather than a bounding box: a bounding box
        // would also license changing whatever sits between two scattered
        // cells, which the question did not ask for.
        exemptions: operation.cells.map((cell) => ({
          target: { by: 'cell' as const, row: cell.row, col: cell.col },
          content: true,
        })),
      };

    case 'columnWidth':
      return {
        criteria: [
          {
            kind: 'columnWidth',
            label: `Column ${rangeToA1({ start: { row: 0, col: operation.col }, end: { row: 0, col: operation.col } }).replace(/\d+$/, '')} is widened`,
            col: operation.col,
            // At least, not exactly: a candidate dragging a column to fit its
            // contents lands near the asked-for width, never on it.
            atLeast: operation.width,
          },
        ],
        exemptions: [{ columns: [operation.col] }],
      };

    case 'freeze':
      return {
        criteria: [
          {
            kind: 'frozen',
            label: `${operation.rows} row(s) and ${operation.columns} column(s) are frozen`,
            rows: operation.rows,
            columns: operation.columns,
          },
        ],
        exemptions: [{ frozen: true }],
      };

    case 'view': {
      const asked = [
        operation.showGridlines === undefined ? null : `gridlines are ${operation.showGridlines ? 'shown' : 'hidden'}`,
        operation.showHeadings === undefined ? null : `headings are ${operation.showHeadings ? 'shown' : 'hidden'}`,
      ].filter((part) => part !== null);

      return {
        criteria: [
          {
            kind: 'sheetView',
            label: `The ${asked.join(' and the ')}`,
            ...(operation.showGridlines === undefined ? {} : { showGridlines: operation.showGridlines }),
            ...(operation.showHeadings === undefined ? {} : { showHeadings: operation.showHeadings }),
          },
        ],
        exemptions: [{ view: true }],
      };
    }

    case 'printArea':
      return {
        criteria: [
          {
            kind: 'printArea',
            label: operation.range ? `The print area is ${rangeToA1(operation.range)}` : 'The print area is cleared',
            range: operation.range,
          },
        ],
        exemptions: [{ printArea: true }],
      };
  }
}

export function excelRubricFor(draft: ExcelQuestionDraft): SheetQuestionRubric {
  const pieces = draft.operations.map(excelPiece);

  return {
    number: draft.number,
    criteria: [
      ...pieces.flatMap((piece) => piece.criteria),
      { kind: 'unchanged', label: NOTHING_ELSE, except: pieces.flatMap((piece) => piece.exemptions) },
    ],
  };
}

/* -- Both ------------------------------------------------------------------ */

/**
 * The key for a whole authored paper.
 *
 * Returned loosely typed for the same reason `paperFor` in the submit route
 * holds its rubrics opaquely: the criterion type differs per subject and is
 * checked inside the marker, not at the point the paper is selected.
 */
export function rubricsFor(drafts: readonly QuestionDraft[]): (QuestionRubric | SheetQuestionRubric)[] {
  return drafts.map((draft) =>
    draft.subject === 'word' ? wordRubricFor(draft) : excelRubricFor(draft),
  );
}
