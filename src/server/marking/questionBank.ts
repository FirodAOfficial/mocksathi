import 'server-only';

import { BOAT_LINE_TWO } from '@/exam/seedAttempt';
import { INDENT_STEP_PX } from '@/utils/indent';
import type { Criterion, QuestionRubric, Target } from '@/exam/marking/criteria';
import type { MarkName } from '@/exam/marking/flatten';
import type { ParagraphFormatting } from '@/services/document/types';

/**
 * The answer key.
 *
 * `import 'server-only'` is the point of this module: it holds the answers, so
 * an accidental import from a client component must fail the build rather than
 * quietly ship the marking scheme to every candidate's browser.
 */

/** The paragraph the candidate was asked to format. */
const PARAGRAPH: Target = { by: 'block', block: 0 };

/**
 * The question asked for these changes to the paragraph, and no others.
 *
 * Applying a second, unasked-for format is a wrong answer: the paper is testing
 * whether the candidate can perform one named operation, so bolding *and*
 * italicising when only bold was asked for is not a correct answer with a bonus.
 */
function onlyThis(options: {
  marks?: MarkName[];
  paragraph?: (keyof ParagraphFormatting)[];
} = {}): Criterion {
  return {
    kind: 'unchanged',
    label: 'Nothing was changed beyond what the question asked for',
    except: [{ target: PARAGRAPH, ...options }],
  };
}

/** Word's two reds: a candidate may reasonably pick either. */
const REDS = ['#ff0000', '#c00000'];

/*
 * Questions 8 and 13 address "the 2nd line of the document", and a line is what
 * the page shows on one row — the passage is a single paragraph that wraps.
 *
 * That makes the target a character range rather than a block, and the range is
 * only right because the layout is fixed: the page is a fixed width, and the
 * passage starts in the default font at the default size. Nothing the candidate
 * is asked to do on these two questions changes any of that.
 *
 * The offsets below were measured from the rendered page: line 2 runs from the
 * "h" of "had used it" to the "d" of "and". The trailing space that ends the
 * row is left out on purpose, so a candidate who selects the words without it
 * still passes, and `unchanged` forgives whitespace next to an exempt span.
 *
 * The offsets live in `BOAT_LINE_TWO` beside the passage, because the review
 * screen's worked answer highlights the same line and the two must not drift.
 *
 * Re-measure if the passage wording, the page width, or the default font or
 * size changes — jsdom has no layout, so no unit test can catch this. To
 * re-measure, walk the paragraph's text node a character at a time with a
 * `Range` and group the offsets by `getBoundingClientRect().top`.
 */
const SECOND_LINE: Target = { by: 'range', block: 0, ...BOAT_LINE_TWO };

/** Line 2 gains the one format asked for; the rest of the passage gains nothing. */
function onlyLineTwo(mark: MarkName): Criterion {
  return {
    kind: 'unchanged',
    label: 'Nothing was changed beyond what the question asked for',
    except: [{ target: SECOND_LINE, marks: [mark] }],
  };
}

export const QUESTION_BANK: QuestionRubric[] = [
  {
    number: 1,
    criteria: [
      { kind: 'marked', label: 'The paragraph is bold', target: PARAGRAPH, mark: 'bold' },
      { kind: 'marked', label: 'The paragraph is underlined', target: PARAGRAPH, mark: 'underline' },
      onlyThis({ marks: ['bold', 'underline'] }),
    ],
  },
  {
    number: 2,
    criteria: [
      {
        kind: 'marked',
        label: 'The paragraph is highlighted green',
        target: PARAGRAPH,
        mark: 'highlight',
        value: '#00ff00',
      },
      onlyThis({ marks: ['highlight'] }),
    ],
  },
  {
    number: 3,
    criteria: [
      {
        kind: 'marked',
        label: 'The font is Times New Roman',
        target: PARAGRAPH,
        mark: 'fontFamily',
        value: 'Times New Roman',
      },
      onlyThis({ marks: ['fontFamily'] }),
    ],
  },
  {
    number: 4,
    criteria: [
      { kind: 'marked', label: 'The font size is 15', target: PARAGRAPH, mark: 'fontSize', value: 15 },
      onlyThis({ marks: ['fontSize'] }),
    ],
  },
  {
    number: 5,
    criteria: [
      { kind: 'blockAttr', label: 'The paragraph is centred', block: 0, attr: 'align', value: 'center' },
      onlyThis({ paragraph: ['align'] }),
    ],
  },
  {
    number: 6,
    criteria: [
      { kind: 'blockAttr', label: 'The line spacing is 2.0', block: 0, attr: 'lineHeight', value: 2 },
      onlyThis({ paragraph: ['lineHeight'] }),
    ],
  },
  {
    number: 7,
    criteria: [
      {
        kind: 'blockAttr',
        label: 'The paragraph is indented by one level',
        block: 0,
        attr: 'indentLeft',
        value: INDENT_STEP_PX,
      },
      onlyThis({ paragraph: ['indentLeft'] }),
    ],
  },
  {
    number: 8,
    criteria: [
      { kind: 'marked', label: 'The 2nd line is underlined', target: SECOND_LINE, mark: 'underline' },
      onlyLineTwo('underline'),
    ],
  },
  {
    number: 9,
    criteria: [
      { kind: 'marked', label: 'The font size is 8', target: PARAGRAPH, mark: 'fontSize', value: 8 },
      onlyThis({ marks: ['fontSize'] }),
    ],
  },
  {
    number: 10,
    criteria: [
      { kind: 'blockAttr', label: 'The paragraph is justified', block: 0, attr: 'align', value: 'justify' },
      onlyThis({ paragraph: ['align'] }),
    ],
  },
  {
    number: 11,
    criteria: [
      {
        kind: 'marked',
        label: 'The font is Calibri',
        target: PARAGRAPH,
        mark: 'fontFamily',
        value: 'Calibri',
      },
      onlyThis({ marks: ['fontFamily'] }),
    ],
  },
  {
    number: 12,
    criteria: [
      { kind: 'marked', label: 'The paragraph is bold', target: PARAGRAPH, mark: 'bold' },
      { kind: 'marked', label: 'The paragraph is italic', target: PARAGRAPH, mark: 'italic' },
      onlyThis({ marks: ['bold', 'italic'] }),
    ],
  },
  {
    number: 13,
    criteria: [
      {
        kind: 'marked',
        label: 'The 2nd line is highlighted red',
        target: SECOND_LINE,
        mark: 'highlight',
        value: REDS,
      },
      onlyLineTwo('highlight'),
    ],
  },
  {
    number: 14,
    criteria: [
      { kind: 'marked', label: 'The font colour is red', target: PARAGRAPH, mark: 'color', value: REDS },
      onlyThis({ marks: ['color'] }),
    ],
  },
  {
    number: 15,
    criteria: [
      { kind: 'marked', label: 'The paragraph is bold', target: PARAGRAPH, mark: 'bold' },
      onlyThis({ marks: ['bold'] }),
    ],
  },
];

export function rubricFor(questionNumber: number): QuestionRubric | undefined {
  return QUESTION_BANK.find((rubric) => rubric.number === questionNumber);
}
