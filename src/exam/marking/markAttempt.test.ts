import { Editor } from '@tiptap/core';
import { afterEach, describe, expect, it } from 'vitest';
import { buildEditorExtensions } from '@/editor/extensions';
import {
  changeIndent,
  setAlignment,
  setFontFamily,
  setFontSize,
  setHighlightColor,
  setLineSpacing,
  setTextColor,
} from '@/editor/ribbonActions';
import { findQuestion, type Language } from '@/exam/types';
import { SEED_ATTEMPT } from '@/exam/seedAttempt';
import {
  PAPER,
  REFERENCE_AVERAGE,
  REFERENCE_AVERAGE_TIMES,
  REFERENCE_TOPPER,
  REFERENCE_TOPPER_TIMES,
} from '@/exam/result';
import { QUESTION_BANK, rubricFor } from '@/server/marking/questionBank';
import { evaluateCriterion } from './evaluate';
import { markAttempt, markQuestion, validateQuestionBank } from './markAttempt';

/**
 * The load-bearing test: the marker is checked against documents produced by
 * the real ribbon commands, not by hand-written JSON. If the editor ever
 * represents a result differently — a schema change, a Tiptap upgrade — this
 * fails, where a test built on assumed output would keep passing while the
 * product silently marked every candidate wrong.
 */

const editors: Editor[] = [];

afterEach(() => {
  while (editors.length) editors.pop()?.destroy();
});

function open(number: number, language: Language = 'en'): Editor {
  const question = findQuestion(SEED_ATTEMPT, number);
  if (!question) throw new Error(`no question ${number}`);

  const element = document.createElement('div');
  document.body.appendChild(element);
  const editor = new Editor({
    element,
    extensions: buildEditorExtensions(),
    content: question.passage[language],
  });
  editors.push(editor);
  editor.commands.selectAll();
  return editor;
}

/**
 * Selects a character range of the first paragraph, the way a candidate drags
 * across one line.
 *
 * The paragraph is the document's first node, so its text begins at position 1.
 */
function selectInFirstParagraph(editor: Editor, from: number, to: number): void {
  editor.commands.setTextSelection({ from: from + 1, to: to + 1 });
}

/** The wrapped line 2 that questions 8 and 13 are about. */
const LINE_TWO = { from: 92, to: 178 };

describe('the paper is well formed', () => {
  it('has an answer key for every question and marks that add up', () => {
    expect(validateQuestionBank(SEED_ATTEMPT, QUESTION_BANK, PAPER.maximumMarks)).toEqual([]);
  });

  it('starts with nothing flagged for review', () => {
    // A fresh paper is entirely untouched; the candidate does the flagging.
    expect(SEED_ATTEMPT.sections[0]!.questions.every((question) => !question.bookmarked)).toBe(true);
  });

  it('still wraps line 2 of the boat passage where the answer key says it does', () => {
    // jsdom cannot lay text out, so this cannot check the wrap itself. It does
    // check the half that a reworded passage would break: that the offsets
    // still land on whole words, which a shifted passage would not.
    const question = findQuestion(SEED_ATTEMPT, 8)!;
    const text = (question.passage.en.content?.[0]?.content?.[0]?.text ?? '') as string;

    expect(text.slice(LINE_TWO.from, LINE_TWO.to)).toBe(
      'had used it since the previous summer, but every morning someone checked the ropes and',
    );
  });
});

describe('marking real ribbon output', () => {
  it('Q1 — bold and underline together', () => {
    const editor = open(1);
    editor.chain().focus().toggleBold().toggleUnderline().run();
    expect(mark(1, editor).outcome).toBe('correct');

    const onlyBold = open(1);
    onlyBold.chain().focus().toggleBold().run();
    expect(mark(1, onlyBold).outcome).toBe('incorrect');
  });

  it('Q2 — green highlight, and not another green', () => {
    const editor = open(2);
    setHighlightColor(editor, '#00ff00');
    expect(mark(2, editor).outcome).toBe('correct');

    const wrong = open(2);
    setHighlightColor(wrong, '#00b050');
    expect(mark(2, wrong).outcome).toBe('incorrect');
  });

  it('Q3 — Times New Roman', () => {
    const editor = open(3);
    setFontFamily(editor, 'Times New Roman');
    expect(mark(3, editor).outcome).toBe('correct');

    const wrong = open(3);
    setFontFamily(wrong, 'Georgia');
    expect(mark(3, wrong).outcome).toBe('incorrect');
  });

  it('Q4 — font size 15, which is not on the ribbon’s size list', () => {
    const editor = open(4);
    setFontSize(editor, 15);
    expect(mark(4, editor).outcome).toBe('correct');

    // 14 and 16 are the neighbouring presets: picking one instead of typing 15
    // is the mistake this question is looking for.
    for (const size of [14, 16]) {
      const wrong = open(4);
      setFontSize(wrong, size);
      expect(mark(4, wrong).outcome).toBe('incorrect');
    }
  });

  it('Q5 — centre alignment', () => {
    const editor = open(5);
    setAlignment(editor, 'center');
    expect(mark(5, editor).outcome).toBe('correct');

    const wrong = open(5);
    setAlignment(wrong, 'justify');
    expect(mark(5, wrong).outcome).toBe('incorrect');
  });

  it('Q6 — line spacing 2.0', () => {
    const editor = open(6);
    setLineSpacing(editor, 2);
    expect(mark(6, editor).outcome).toBe('correct');

    const wrong = open(6);
    setLineSpacing(wrong, 1.5);
    expect(mark(6, wrong).outcome).toBe('incorrect');
  });

  it('Q7 — one indent level, not two', () => {
    const editor = open(7);
    changeIndent(editor, 1);
    expect(mark(7, editor).outcome).toBe('correct');

    const twice = open(7);
    changeIndent(twice, 1);
    changeIndent(twice, 1);
    expect(mark(7, twice).outcome).toBe('incorrect');
  });

  it('Q8 — underlining line 2 only', () => {
    const editor = open(8);
    selectInFirstParagraph(editor, LINE_TWO.from, LINE_TWO.to);
    editor.chain().focus().toggleUnderline().run();
    expect(mark(8, editor).outcome).toBe('correct');

    // Underlining the whole passage answers a different question.
    const everything = open(8);
    everything.chain().focus().toggleUnderline().run();
    expect(mark(8, everything).outcome).toBe('incorrect');

    // So does underlining line 1.
    const wrongLine = open(8);
    selectInFirstParagraph(wrongLine, 0, LINE_TWO.from);
    wrongLine.chain().focus().toggleUnderline().run();
    expect(mark(8, wrongLine).outcome).toBe('incorrect');
  });

  it('Q9 — font size 8', () => {
    const editor = open(9);
    setFontSize(editor, 8);
    expect(mark(9, editor).outcome).toBe('correct');

    const wrong = open(9);
    setFontSize(wrong, 9);
    expect(mark(9, wrong).outcome).toBe('incorrect');
  });

  it('Q10 — justified alignment', () => {
    const editor = open(10);
    setAlignment(editor, 'justify');
    expect(mark(10, editor).outcome).toBe('correct');

    const wrong = open(10);
    setAlignment(wrong, 'center');
    expect(mark(10, wrong).outcome).toBe('incorrect');
  });

  it('Q11 — Calibri must be set, not merely inherited', () => {
    const editor = open(11);
    setFontFamily(editor, 'Calibri');
    expect(mark(11, editor).outcome).toBe('correct');

    const wrong = open(11);
    setFontFamily(wrong, 'Cambria');
    expect(mark(11, wrong).outcome).toBe('incorrect');
  });

  it('Q12 — bold and italic together', () => {
    const editor = open(12);
    editor.chain().focus().toggleBold().toggleItalic().run();
    expect(mark(12, editor).outcome).toBe('correct');

    const onlyItalic = open(12);
    onlyItalic.chain().focus().toggleItalic().run();
    expect(mark(12, onlyItalic).outcome).toBe('incorrect');
  });

  it('Q13 — red highlight on line 2 only', () => {
    const editor = open(13);
    selectInFirstParagraph(editor, LINE_TWO.from, LINE_TWO.to);
    setHighlightColor(editor, '#ff0000');
    expect(mark(13, editor).outcome).toBe('correct');

    const green = open(13);
    selectInFirstParagraph(green, LINE_TWO.from, LINE_TWO.to);
    setHighlightColor(green, '#00ff00');
    expect(mark(13, green).outcome).toBe('incorrect');

    const everything = open(13);
    setHighlightColor(everything, '#ff0000');
    expect(mark(13, everything).outcome).toBe('incorrect');
  });

  it('Q14 — red font colour, accepting either of Word’s reds', () => {
    for (const red of ['#ff0000', '#c00000']) {
      const editor = open(14);
      setTextColor(editor, red);
      expect(mark(14, editor).outcome).toBe('correct');
    }

    const blue = open(14);
    setTextColor(blue, '#0070c0');
    expect(mark(14, blue).outcome).toBe('incorrect');
  });

  it('Q15 — bold', () => {
    const editor = open(15);
    editor.chain().focus().toggleBold().run();
    expect(mark(15, editor).outcome).toBe('correct');

    const italic = open(15);
    italic.chain().focus().toggleItalic().run();
    expect(mark(15, italic).outcome).toBe('incorrect');
  });

  it('rejects a correct answer that also applies formatting nobody asked for', () => {
    // The paper tests one named operation at a time. Getting it right and then
    // adding a second format is not a correct answer with a bonus.
    const alsoItalic = open(15);
    alsoItalic.chain().focus().toggleBold().toggleItalic().run();
    expect(mark(15, alsoItalic).outcome).toBe('incorrect');

    const alsoCentred = open(15);
    alsoCentred.chain().focus().toggleBold().run();
    setAlignment(alsoCentred, 'center');
    expect(mark(15, alsoCentred).outcome).toBe('incorrect');

    // The same holds for a paragraph-level question gaining a character format.
    const centredAndBold = open(5);
    setAlignment(centredAndBold, 'center');
    centredAndBold.chain().focus().toggleBold().run();
    expect(mark(5, centredAndBold).outcome).toBe('incorrect');

    // And for the line-2 questions, where the allowance is narrower still.
    const lineTwoExtra = open(8);
    selectInFirstParagraph(lineTwoExtra, LINE_TWO.from, LINE_TWO.to);
    lineTwoExtra.chain().focus().toggleUnderline().toggleBold().run();
    expect(mark(8, lineTwoExtra).outcome).toBe('incorrect');
  });

  it('treats an untouched question as unattempted, not wrong', () => {
    const question = findQuestion(SEED_ATTEMPT, 1)!;
    expect(markQuestion(question, rubricFor(1), undefined, evaluateCriterion, 'en').outcome).toBe(
      'unattempted',
    );
  });
});

function mark(number: number, editor: Editor, language: Language = 'en') {
  const question = findQuestion(SEED_ATTEMPT, number)!;
  return markQuestion(question, rubricFor(number), editor.getJSON(), evaluateCriterion, language);
}

/**
 * The paper is sat in one language. The demo paper's passages happen to be the
 * same text in both, but the answer key must not depend on that — no criterion
 * names the passage's words, so a translated passage would mark identically.
 */
describe('one answer key, both languages', () => {
  it('marks the Hindi paper by the same rules', () => {
    const hindi = open(1, 'hi');
    hindi.chain().focus().toggleBold().toggleUnderline().run();
    expect(mark(1, hindi, 'hi').outcome).toBe('correct');

    const wrong = open(1, 'hi');
    wrong.chain().focus().toggleBold().run();
    expect(mark(1, wrong, 'hi').outcome).toBe('incorrect');
  });

  it('reaches the same verdict in either language for a formatting task', () => {
    for (const language of ['en', 'hi'] as Language[]) {
      const editor = open(3, language);
      setFontFamily(editor, 'Times New Roman');
      expect(mark(3, editor, language).outcome).toBe('correct');
    }
  });
});

describe('markAttempt', () => {
  const reference = {
    topper: REFERENCE_TOPPER,
    average: REFERENCE_AVERAGE,
    topperTimePerQuestion: [...REFERENCE_TOPPER_TIMES],
    averageTimePerQuestion: [...REFERENCE_AVERAGE_TIMES],
  };
  const paper = { testName: PAPER.testName, tagline: PAPER.tagline, qualifyingMarks: PAPER.qualifyingMarks };

  it('scores an empty paper as nothing attempted', () => {
    const { result } = markAttempt(
      SEED_ATTEMPT,
      QUESTION_BANK,
      { answers: {}, totalTimeSeconds: 0, language: 'en' },
      reference,
      evaluateCriterion,
      paper,
    );

    expect(result.you).toMatchObject({ score: 0, correct: 0, wrong: 0, unattempted: 15 });
    expect(result.maximumMarks).toBe(50);
  });

  it('aggregates marks, counts and per-question timings', () => {
    const editor = open(2);
    setHighlightColor(editor, '#00ff00');

    const { result } = markAttempt(
      SEED_ATTEMPT,
      QUESTION_BANK,
      { answers: { 2: editor.getJSON() }, timePerQuestion: { 2: 42 }, totalTimeSeconds: 90, language: 'en' },
      reference,
      evaluateCriterion,
      paper,
    );

    expect(result.you).toMatchObject({ score: 3, correct: 1, wrong: 0, unattempted: 14, timeSeconds: 90 });
    expect(result.you.accuracy).toBe(100);
    expect(result.questions[1]).toMatchObject({ number: 2, outcome: 'correct', yourTimeSeconds: 42 });
  });

  it('flags a paper whose marks do not add up', () => {
    const broken = {
      ...SEED_ATTEMPT,
      sections: [{ name: 'x', questions: [{ ...findQuestion(SEED_ATTEMPT, 1)!, marks: 7 }] }],
    };
    expect(validateQuestionBank(broken, QUESTION_BANK, 50)[0]).toContain('add up to 7');
  });
});
