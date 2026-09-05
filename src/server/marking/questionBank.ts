import 'server-only';

import type { Criterion, QuestionRubric } from '@/exam/marking/criteria';

/**
 * The answer key.
 *
 * `import 'server-only'` is the point of this module: it holds the answers, so
 * an accidental import from a client component must fail the build rather than
 * quietly ship the marking scheme to every candidate's browser.
 *
 * Every criterion here is language-agnostic. Because the paper is offered in
 * Hindi and English with different passages, criteria address whole blocks,
 * table cells, or text derived from the passage — never literal words. One key
 * therefore marks both languages, and a third language would need no new key.
 */

/** The paragraph the candidate was asked to format. */
const PARAGRAPH = { by: 'block' as const, block: 0 };

/** Nothing outside the paragraph itself was disturbed. */
const NOTHING_ELSE: Criterion = {
  kind: 'unchanged',
  label: 'The wording of the passage was left as it was',
  except: [PARAGRAPH],
};

/** Word's two reds: a candidate may reasonably pick either. */
const REDS = ['#ff0000', '#c00000'];

export const QUESTION_BANK: QuestionRubric[] = [
  {
    number: 1,
    criteria: [
      { kind: 'marked', label: 'The paragraph is bold', target: PARAGRAPH, mark: 'bold' },
      { kind: 'marked', label: 'The paragraph is underlined', target: PARAGRAPH, mark: 'underline' },
      NOTHING_ELSE,
    ],
  },
  {
    number: 2,
    criteria: [
      { kind: 'marked', label: 'The paragraph is struck through', target: PARAGRAPH, mark: 'strike' },
      NOTHING_ELSE,
    ],
  },
  {
    number: 3,
    criteria: [
      // Column 2 repeats column 1, row for row — true whatever the words are.
      { kind: 'columnsMatch', label: 'Column 2 repeats column 1', from: 1, to: 2 },
    ],
  },
  {
    number: 4,
    criteria: [
      {
        kind: 'text',
        label: 'The paragraph is in uppercase',
        block: 0,
        expect: { matchesStart: 'upper' },
      },
    ],
  },
  {
    number: 5,
    criteria: [
      {
        kind: 'marked',
        label: 'The paragraph is highlighted green',
        target: PARAGRAPH,
        mark: 'highlight',
        value: '#00ff00',
      },
      NOTHING_ELSE,
    ],
  },
  {
    number: 6,
    criteria: [
      { kind: 'marked', label: 'The font colour is red', target: PARAGRAPH, mark: 'color', value: REDS },
      NOTHING_ELSE,
    ],
  },
  {
    number: 7,
    criteria: [
      { kind: 'marked', label: 'The engrave effect is applied', target: PARAGRAPH, mark: 'engrave' },
      { kind: 'blockAttr', label: 'The paragraph is left-aligned', block: 0, attr: 'align', value: 'left' },
      NOTHING_ELSE,
    ],
  },
  {
    number: 8,
    criteria: [
      { kind: 'plain', label: 'All formatting has been removed', target: PARAGRAPH },
    ],
  },
  {
    number: 9,
    criteria: [
      { kind: 'marked', label: 'The emboss effect is applied', target: PARAGRAPH, mark: 'emboss' },
      { kind: 'blockAttr', label: 'The paragraph is left-aligned', block: 0, attr: 'align', value: 'left' },
      NOTHING_ELSE,
    ],
  },
  {
    number: 10,
    criteria: [
      {
        kind: 'marked',
        label: 'The font is Times New Roman',
        target: PARAGRAPH,
        mark: 'fontFamily',
        value: 'Times New Roman',
      },
      NOTHING_ELSE,
    ],
  },
  {
    number: 11,
    criteria: [
      { kind: 'marked', label: 'The font size is 20', target: PARAGRAPH, mark: 'fontSize', value: 20 },
      NOTHING_ELSE,
    ],
  },
  {
    number: 12,
    criteria: [
      { kind: 'marked', label: 'The character scale is 200%', target: PARAGRAPH, mark: 'charScale', value: 200 },
      NOTHING_ELSE,
    ],
  },
  {
    number: 13,
    criteria: [
      {
        kind: 'marked',
        label: 'Character spacing is expanded by 5 pt',
        target: PARAGRAPH,
        mark: 'charSpacing',
        value: 5,
      },
      NOTHING_ELSE,
    ],
  },
  {
    number: 14,
    criteria: [
      {
        kind: 'marked',
        label: 'Character spacing is condensed by 5 pt',
        target: PARAGRAPH,
        mark: 'charSpacing',
        value: -5,
      },
      { kind: 'blockAttr', label: 'The paragraph is left-aligned', block: 0, attr: 'align', value: 'left' },
      NOTHING_ELSE,
    ],
  },
  {
    number: 15,
    criteria: [
      // Column 0 is the S. No. column; the header row is not numbered.
      { kind: 'columnAutoNumbered', label: 'The S. No. column is auto numbered', column: 0 },
    ],
  },
];

export function rubricFor(questionNumber: number): QuestionRubric | undefined {
  return QUESTION_BANK.find((rubric) => rubric.number === questionNumber);
}
