import { describe, expect, it } from 'vitest';
import { EXCEL_DRAFTS } from '@/exam/excelSeedAttempt';
import { WORD_DRAFTS, modelAnswerDocument, SEED_ATTEMPT } from '@/exam/seedAttempt';
import { EXCEL_SEED_ATTEMPT } from '@/exam/excelSeedAttempt';
import { modelWorkbookSnapshot } from '@/exam/modelWorkbook';
import { markQuestion } from '@/exam/marking/markAttempt';
import { WORD_MARKER } from '@/exam/marking/wordMarker';
import { SHEET_MARKER } from '@/exam/marking/sheet/sheetMarker';
import { findQuestion, isExcelQuestion, isWordQuestion } from '@/exam/types';
import { excelRubricFor, wordRubricFor } from './rubricFromOperations';

/**
 * The load-bearing test for authored papers.
 *
 * A question's model answer and its answer key are both derived from the same
 * `operations`, and the whole point of deriving them is that they cannot
 * disagree. This asserts exactly that: the worked answer the candidate is shown
 * after the paper closes must *pass* the key the same operations produce, for
 * every question in both sample papers.
 *
 * It is the check that catches the failure that matters — a question that says
 * "make it bold" being marked against something else — and no screen test
 * would see it.
 *
 * The negative half matters just as much: the untouched starting document must
 * fail. A key that passes everything would satisfy the first half perfectly.
 */

describe('a derived Word key marks the paper it was derived from', () => {
  const numbers = WORD_DRAFTS.map((draft) => draft.number);

  it.each(numbers)('question %i: the model answer is correct', (number) => {
    const draft = WORD_DRAFTS.find((entry) => entry.number === number)!;
    const question = findQuestion(SEED_ATTEMPT, number)!;
    if (!isWordQuestion(question)) throw new Error(`question ${number} is not a Word question`);

    const answer = modelAnswerDocument(question, 'en');
    const marked = markQuestion(question, wordRubricFor(draft), answer, WORD_MARKER, 'en');

    expect(marked.criteria.filter((criterion) => !criterion.passed)).toEqual([]);
    expect(marked.outcome).toBe('correct');
  });

  it.each(numbers)('question %i: the untouched passage is not', (number) => {
    const draft = WORD_DRAFTS.find((entry) => entry.number === number)!;
    const question = findQuestion(SEED_ATTEMPT, number)!;
    if (!isWordQuestion(question)) throw new Error(`question ${number} is not a Word question`);

    const marked = markQuestion(question, wordRubricFor(draft), question.passage.en, WORD_MARKER, 'en');
    expect(marked.outcome).toBe('incorrect');
  });

  it('marks the model answer of the Hindi paper by the same key', () => {
    // One key, both languages — the rule the papers are built on. No criterion
    // names the passage's words, so a translated passage marks identically.
    const draft = WORD_DRAFTS[0]!;
    const question = findQuestion(SEED_ATTEMPT, draft.number)!;
    if (!isWordQuestion(question)) throw new Error('not a Word question');

    const marked = markQuestion(
      question,
      wordRubricFor(draft),
      modelAnswerDocument(question, 'hi'),
      WORD_MARKER,
      'hi',
    );
    expect(marked.outcome).toBe('correct');
  });

  it('fails an answer that does more than the question asked for', () => {
    // Question 15 asks for bold and nothing else. Bold *and* italic is a wrong
    // answer, not a correct one with a bonus — which is what the closing
    // `unchanged` criterion is there to enforce.
    const draft = WORD_DRAFTS.find((entry) => entry.number === 15)!;
    const question = findQuestion(SEED_ATTEMPT, 15)!;
    if (!isWordQuestion(question)) throw new Error('not a Word question');

    const overdone = modelAnswerDocument(
      { ...question, modelAnswer: { scope: 'all', marks: [{ type: 'bold' }, { type: 'italic' }] } },
      'en',
    );
    expect(markQuestion(question, wordRubricFor(draft), overdone, WORD_MARKER, 'en').outcome).toBe('incorrect');
  });
});

describe('a derived Excel key marks the paper it was derived from', () => {
  const numbers = EXCEL_DRAFTS.map((draft) => draft.number);

  it.each(numbers)('question %i: the model workbook is correct', (number) => {
    const draft = EXCEL_DRAFTS.find((entry) => entry.number === number)!;
    const question = findQuestion(EXCEL_SEED_ATTEMPT, number)!;
    if (!isExcelQuestion(question)) throw new Error(`question ${number} is not an Excel question`);

    const answer = modelWorkbookSnapshot(question, 'en');
    const marked = markQuestion(question, excelRubricFor(draft), answer, SHEET_MARKER, 'en');

    expect(marked.criteria.filter((criterion) => !criterion.passed)).toEqual([]);
    expect(marked.outcome).toBe('correct');
  });

  it.each(numbers)('question %i: the untouched sheet is not', (number) => {
    const draft = EXCEL_DRAFTS.find((entry) => entry.number === number)!;
    const question = findQuestion(EXCEL_SEED_ATTEMPT, number)!;
    if (!isExcelQuestion(question)) throw new Error(`question ${number} is not an Excel question`);

    const marked = markQuestion(question, excelRubricFor(draft), question.workbook.en, SHEET_MARKER, 'en');
    expect(marked.outcome).toBe('incorrect');
  });

  it('marks the Hindi sheet by the same key', () => {
    const draft = EXCEL_DRAFTS[0]!;
    const question = findQuestion(EXCEL_SEED_ATTEMPT, draft.number)!;
    if (!isExcelQuestion(question)) throw new Error('not an Excel question');

    const marked = markQuestion(
      question,
      excelRubricFor(draft),
      modelWorkbookSnapshot(question, 'hi'),
      SHEET_MARKER,
      'hi',
    );
    expect(marked.outcome).toBe('correct');
  });
});

describe('what the derived key says', () => {
  it('closes every rubric with "nothing else changed"', () => {
    // Not decoration: without it, doing what was asked plus something else
    // would score full marks.
    for (const draft of WORD_DRAFTS) {
      expect(wordRubricFor(draft).criteria.at(-1)?.kind).toBe('unchanged');
    }
    for (const draft of EXCEL_DRAFTS) {
      expect(excelRubricFor(draft).criteria.at(-1)?.kind).toBe('unchanged');
    }
  });

  it('licenses exactly the formatting the question asked for, and no more', () => {
    const draft = WORD_DRAFTS.find((entry) => entry.number === 1)!;
    const closing = wordRubricFor(draft).criteria.at(-1)!;
    if (closing.kind !== 'unchanged') throw new Error('expected an unchanged criterion');

    expect(closing.except).toEqual([{ target: { by: 'block', block: 0 }, marks: ['bold', 'underline'] }]);
  });

  it('scopes marks to a named line while letting paragraph formatting reach the block', () => {
    // Question 8 underlines the 2nd line. Word cannot centre half a line, so a
    // paragraph-level operation would still apply to the block — the exemption
    // has to express both at once.
    const draft = WORD_DRAFTS.find((entry) => entry.number === 8)!;
    const closing = wordRubricFor(draft).criteria.at(-1)!;
    if (closing.kind !== 'unchanged') throw new Error('expected an unchanged criterion');

    expect(closing.except[0]!.target).toMatchObject({ by: 'range', block: 0 });
    expect(closing.except[0]!.marks).toEqual(['underline']);
  });

  it('accepts either of Office’s two reds', () => {
    // The hand-written banks make the same allowance: which red a candidate
    // lands on is not what the question is testing.
    const draft = WORD_DRAFTS.find((entry) => entry.number === 14)!;
    const criterion = wordRubricFor(draft).criteria[0]!;
    if (criterion.kind !== 'marked') throw new Error('expected a marked criterion');

    expect(criterion.value).toEqual(['#ff0000', '#c00000']);
  });

  it('writes labels a candidate can act on, not assertion names', () => {
    const draft = WORD_DRAFTS.find((entry) => entry.number === 2)!;
    expect(wordRubricFor(draft).criteria[0]!.label).toBe('The paragraph is highlighted green');
  });

  it('collapses a run of cells into one criterion rather than one per cell', () => {
    // Question 9 auto-fills eleven months. Eleven near-identical feedback lines
    // saying the same thing would teach nothing.
    const draft = EXCEL_DRAFTS.find((entry) => entry.number === 9)!;
    const criteria = excelRubricFor(draft).criteria;

    expect(criteria).toHaveLength(2);
    expect(criteria[0]!.kind).toBe('cellSeries');
  });

  it('names the function a formula must call, so an equivalent formula still passes', () => {
    const draft = EXCEL_DRAFTS.find((entry) => entry.number === 10)!;
    const criterion = excelRubricFor(draft).criteria[0]!;
    if (criterion.kind !== 'cellFormula') throw new Error('expected a cellFormula criterion');

    expect(criterion.usesFunction).toBe('MIN');
    expect(criterion.resultEquals).toBe(67);
  });

  it('asks for a border on the outside edge only, never a uniform style', () => {
    // A uniform style would describe All Borders, which is a different answer.
    const draft = EXCEL_DRAFTS.find((entry) => entry.number === 4)!;
    expect(excelRubricFor(draft).criteria[0]!.kind).toBe('outsideBorder');
  });
});
