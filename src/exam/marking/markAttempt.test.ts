import { Editor } from '@tiptap/core';
import { afterEach, describe, expect, it } from 'vitest';
import { buildEditorExtensions } from '@/editor/extensions';
import {
  changeCase,
  clearFormatting,
  setAlignment,
  setCharacterScale,
  setCharacterSpacing,
  setFontFamily,
  setFontSize,
  setHighlightColor,
  setTextColor,
  setTextEffect,
  toggleOrderedList,
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

function mark(number: number, editor: Editor, language: Language = 'en') {
  const question = findQuestion(SEED_ATTEMPT, number)!;
  return markQuestion(question, rubricFor(number), editor.getJSON(), evaluateCriterion, language);
}

/** Puts the cursor inside one table cell, counting rows and columns from zero. */
function focusCell(editor: Editor, row: number, column: number): void {
  let rowIndex = -1;
  let found: number | null = null;

  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'tableRow') {
      rowIndex += 1;
      if (rowIndex === row) {
        let columnIndex = -1;
        node.forEach((cell, offset) => {
          columnIndex += 1;
          if (columnIndex === column && found === null) found = pos + 1 + offset + 2;
        });
      }
      return false;
    }
    return true;
  });

  if (found === null) throw new Error(`no cell at ${row},${column}`);
  editor.commands.setTextSelection(found);
}

describe('the paper is well formed', () => {
  it('has an answer key for every question and marks that add up', () => {
    expect(validateQuestionBank(SEED_ATTEMPT, QUESTION_BANK, PAPER.maximumMarks)).toEqual([]);
  });

  it('starts with nothing flagged for review', () => {
    // A fresh paper is entirely untouched; the candidate does the flagging.
    expect(SEED_ATTEMPT.sections[0]!.questions.every((question) => !question.bookmarked)).toBe(true);
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

  it('Q2 — strikethrough', () => {
    const editor = open(2);
    editor.chain().focus().toggleStrike().run();
    expect(mark(2, editor).outcome).toBe('correct');
  });

  it('Q3 — copying column 1 into column 2', () => {
    const editor = open(3);
    for (const [row, word] of [[1, 'Keyboard'], [2, 'Monitor'], [3, 'Printer']] as const) {
      focusCell(editor, row, 2);
      editor.commands.insertContent(word);
    }
    expect(mark(3, editor).outcome).toBe('correct');

    const partial = open(3);
    focusCell(partial, 1, 2);
    partial.commands.insertContent('Keyboard');
    expect(mark(3, partial).outcome).toBe('incorrect');
  });

  it('Q4 — uppercase, checked against the passage rather than fixed text', () => {
    const editor = open(4);
    changeCase(editor, 'upper');
    expect(mark(4, editor).outcome).toBe('correct');

    const lowered = open(4);
    changeCase(lowered, 'lower');
    expect(mark(4, lowered).outcome).toBe('incorrect');
  });

  it('Q5 — green highlight, and not another green', () => {
    const editor = open(5);
    setHighlightColor(editor, '#00ff00');
    expect(mark(5, editor).outcome).toBe('correct');

    const wrong = open(5);
    setHighlightColor(wrong, '#00b050');
    expect(mark(5, wrong).outcome).toBe('incorrect');
  });

  it('Q6 — red font colour, accepting either of Word’s reds', () => {
    for (const red of ['#ff0000', '#c00000']) {
      const editor = open(6);
      setTextColor(editor, red);
      expect(mark(6, editor).outcome).toBe('correct');
    }

    const blue = open(6);
    setTextColor(blue, '#0070c0');
    expect(mark(6, blue).outcome).toBe('incorrect');
  });

  it('Q7 — engrave, and the left alignment the question also asks for', () => {
    const editor = open(7);
    setTextEffect(editor, 'engrave');
    setAlignment(editor, 'left');
    expect(mark(7, editor).outcome).toBe('correct');

    const noAlign = open(7);
    setTextEffect(noAlign, 'engrave');
    expect(mark(7, noAlign).criteria.find((c) => !c.passed)?.label).toContain('left-aligned');
  });

  it('Q8 — remove formatting strips everything', () => {
    const editor = open(8);
    clearFormatting(editor);
    expect(mark(8, editor).outcome).toBe('correct');

    const untouched = open(8);
    expect(mark(8, untouched).outcome).toBe('incorrect');
  });

  it('Q9 — emboss plus left alignment', () => {
    const editor = open(9);
    setTextEffect(editor, 'emboss');
    setAlignment(editor, 'left');
    expect(mark(9, editor).outcome).toBe('correct');

    const engraved = open(9);
    setTextEffect(engraved, 'engrave');
    setAlignment(engraved, 'left');
    expect(mark(9, engraved).outcome).toBe('incorrect');
  });

  it('Q10 — Times New Roman', () => {
    const editor = open(10);
    setFontFamily(editor, 'Times New Roman');
    expect(mark(10, editor).outcome).toBe('correct');
  });

  it('Q11 — font size 20', () => {
    const editor = open(11);
    setFontSize(editor, 20);
    expect(mark(11, editor).outcome).toBe('correct');

    const wrong = open(11);
    setFontSize(wrong, 22);
    expect(mark(11, wrong).outcome).toBe('incorrect');
  });

  it('Q12 — character scale 200%', () => {
    const editor = open(12);
    setCharacterScale(editor, 200);
    expect(mark(12, editor).outcome).toBe('correct');
  });

  it('Q13 — spacing expanded by 5 pt', () => {
    const editor = open(13);
    setCharacterSpacing(editor, 5);
    expect(mark(13, editor).outcome).toBe('correct');

    const condensed = open(13);
    setCharacterSpacing(condensed, -5);
    expect(mark(13, condensed).outcome).toBe('incorrect');
  });

  it('Q14 — spacing condensed by 5 pt plus left alignment', () => {
    const editor = open(14);
    setCharacterSpacing(editor, -5);
    setAlignment(editor, 'left');
    expect(mark(14, editor).outcome).toBe('correct');
  });

  it('Q15 — auto numbering down the S. No. column', () => {
    const editor = open(15);
    for (const row of [1, 2, 3]) {
      focusCell(editor, row, 0);
      toggleOrderedList(editor);
    }
    expect(mark(15, editor).outcome).toBe('correct');

    const partial = open(15);
    focusCell(partial, 1, 0);
    toggleOrderedList(partial);
    expect(mark(15, partial).outcome).toBe('incorrect');
  });

  it('treats an untouched question as unattempted, not wrong', () => {
    const question = findQuestion(SEED_ATTEMPT, 1)!;
    expect(markQuestion(question, rubricFor(1), undefined, evaluateCriterion, 'en').outcome).toBe(
      'unattempted',
    );
  });
});

/**
 * The paper is sat in one language, and the passages differ between them. One
 * answer key has to mark both, which is only true because no criterion names
 * the passage's words.
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

  it('marks the Hindi table questions by coordinates, not words', () => {
    const editor = open(3, 'hi');
    for (const [row, word] of [[1, 'कीबोर्ड'], [2, 'मॉनिटर'], [3, 'प्रिंटर']] as const) {
      focusCell(editor, row, 2);
      editor.commands.insertContent(word);
    }
    expect(mark(3, editor, 'hi').outcome).toBe('correct');
  });

  it('reaches the same verdict in either language for a formatting task', () => {
    for (const language of ['en', 'hi'] as Language[]) {
      const editor = open(10, language);
      setFontFamily(editor, 'Times New Roman');
      expect(mark(10, editor, language).outcome).toBe('correct');
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
    editor.chain().focus().toggleStrike().run();

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
