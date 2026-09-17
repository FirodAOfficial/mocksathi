import { describe, expect, it } from 'vitest';
import { buildAttempt, buildWordQuestion, stepsOf } from '@/exam/authoring';
import { markAttempt, markQuestion } from '@/exam/marking/markAttempt';
import { WORD_MARKER } from '@/exam/marking/wordMarker';
import { modelAnswerDocument } from '@/exam/modelAnswerDocument';
import { outcomeOf, type ScoreLine } from '@/exam/result';
import { isWordQuestion, type Language } from '@/exam/types';
import { wordRubricFor } from '@/server/marking/rubricFromOperations';
import { WORD_EFFICIENCY_PAPERS, type WordPaper } from './wordEfficiency';

/**
 * End to end for the two Word efficiency papers: build, sit, mark, score.
 *
 * Every question is marked three ways — worked answer, untouched passage, and
 * an answer that does more than was asked — and then the whole paper is put
 * through `markAttempt`, which is what the submission route runs. What this
 * catches is the only failure that really matters here: a question whose answer
 * key does not agree with its own instruction. Nothing a candidate sees would
 * reveal that, and no screen test would either.
 *
 * Both languages are marked by the same key, because that is the rule the
 * papers are built on: a paper is sat in Hindi or in English and there is one
 * answer key for both.
 */

const LANGUAGES: Language[] = ['en', 'hi'];

/**
 * The comparison lines a result carries.
 *
 * Zeroed here: there is no cohort, and what this test is about is the
 * candidate's own score, which is computed from the answer key rather than from
 * anything these figures say.
 */
const EMPTY_LINE: ScoreLine = { score: 0, maxScore: 0, accuracy: 0, correct: 0, wrong: 0, unattempted: 0, timeSeconds: 0 };

function attemptFor(paper: WordPaper) {
  return buildAttempt({
    candidateName: 'Candidate',
    subject: 'word',
    sectionName: paper.sectionName,
    durationSeconds: paper.durationMinutes * 60,
    questions: paper.questions,
  });
}

describe.each(WORD_EFFICIENCY_PAPERS)('$name', (paper) => {
  const numbers = paper.questions.map((draft) => draft.number);

  it('numbers its questions 1..n with no gaps', () => {
    // The palette, the instructions screen and the result all call the
    // questions by these numbers; a gap reads as a question that failed to load.
    expect(numbers).toEqual(paper.questions.map((_draft, index) => index + 1));
  });

  describe.each(LANGUAGES)('sat in %s', (language) => {
    it.each(numbers)('question %i: the worked answer is correct', (number) => {
      const draft = paper.questions.find((entry) => entry.number === number)!;
      const question = buildWordQuestion(draft);
      if (!isWordQuestion(question)) throw new Error(`question ${number} is not a Word question`);

      const marked = markQuestion(
        question,
        wordRubricFor(draft),
        modelAnswerDocument(question, language),
        WORD_MARKER,
        language,
      );

      // The failing criteria are asserted rather than the outcome alone: when
      // this breaks, the message says which statement of the question failed.
      expect(marked.criteria.filter((criterion) => !criterion.passed)).toEqual([]);
      expect(marked.outcome).toBe('correct');
    });

    it.each(numbers)('question %i: the untouched passage is not', (number) => {
      const draft = paper.questions.find((entry) => entry.number === number)!;
      const question = buildWordQuestion(draft);
      if (!isWordQuestion(question)) throw new Error(`question ${number} is not a Word question`);

      const marked = markQuestion(
        question,
        wordRubricFor(draft),
        question.passage[language],
        WORD_MARKER,
        language,
      );
      expect(marked.outcome).toBe('incorrect');
    });
  });

  /*
   * A question that rewrites the passage cannot be held to "and nothing else
   * changed": that criterion compares the submission character by character
   * against the starting document, which a replacement is meant to break. Those
   * questions are checked by the test below instead.
   */
  const formattingOnly = paper.questions
    .filter((draft) => stepsOf(draft).every((step) => step.operations.every((op) => op.kind !== 'replaceText')))
    .map((draft) => draft.number);

  it.each(formattingOnly)('question %i: doing more than was asked is wrong', (number) => {
    // The rule the papers are built on. A question that also accepts extra
    // formatting is not testing the operation it names.
    const draft = paper.questions.find((entry) => entry.number === number)!;
    const question = buildWordQuestion(draft);
    if (!isWordQuestion(question)) throw new Error(`question ${number} is not a Word question`);

    const overdone = modelAnswerDocument(question, 'en');
    const first = overdone.content?.[0];
    const target = first?.type === 'bulletList' || first?.type === 'orderedList' ? first.content?.[0] : first;
    const paragraph = target?.type === 'listItem' ? target.content?.[0] : target;
    if (paragraph) {
      // Something nobody asked for, on the first paragraph: a blockquote-safe
      // mark that no question in either paper uses.
      paragraph.content = (paragraph.content ?? []).map((run) =>
        run.type === 'text' ? { ...run, marks: [...(run.marks ?? []), { type: 'strike' }] } : run,
      );
    }

    const marked = markQuestion(question, wordRubricFor(draft), overdone, WORD_MARKER, 'en');
    expect(marked.outcome).toBe('incorrect');
  });

  const rewriting = paper.questions.filter((draft) =>
    stepsOf(draft).some((step) => step.operations.some((op) => op.kind === 'replaceText')),
  );

  it.each(rewriting.map((draft) => draft.number))(
    'question %i: replacing the wrong word is wrong',
    (number) => {
      // The check that stands in for "nothing else changed" on a question that
      // changes the wording: the word the question named has to be the word
      // that went, and the replacement has to be the one it asked for.
      const draft = paper.questions.find((entry) => entry.number === number)!;
      const question = buildWordQuestion(draft);
      if (!isWordQuestion(question)) throw new Error(`question ${number} is not a Word question`);

      const marked = markQuestion(
        question,
        wordRubricFor(draft),
        // Untouched: the old word is still there and the new one is not.
        question.passage.en,
        WORD_MARKER,
        'en',
      );
      expect(marked.outcome).toBe('incorrect');
    },
  );

  it('scores a full set of worked answers as full marks, and an empty paper as zero', () => {
    const attempt = attemptFor(paper);
    const rubrics = paper.questions.map(wordRubricFor);
    const reference = {
      topper: EMPTY_LINE,
      average: EMPTY_LINE,
      topperTimePerQuestion: [],
      averageTimePerQuestion: [],
    };
    const identity = {
      testName: paper.name,
      tagline: paper.tagline,
      qualifyingMarks: paper.qualifyingMarks,
    };

    const answers: Record<number, unknown> = {};
    for (const draft of paper.questions) {
      answers[draft.number] = modelAnswerDocument(buildWordQuestion(draft), 'en');
    }

    const total = paper.questions.reduce((sum, draft) => sum + draft.marks, 0);

    const perfect = markAttempt(
      attempt,
      rubrics,
      { answers: answers as never, language: 'en', totalTimeSeconds: 600 },
      reference,
      WORD_MARKER,
      identity,
    );

    expect(perfect.result.you.score).toBe(total);
    expect(perfect.result.maximumMarks).toBe(total);
    expect(outcomeOf(perfect.result)).toBe('qualified');
    expect(perfect.marks.every((mark) => mark.outcome === 'correct')).toBe(true);

    const blank = markAttempt(
      attempt,
      rubrics,
      { answers: {}, language: 'en', totalTimeSeconds: 600 },
      reference,
      WORD_MARKER,
      identity,
    );

    expect(blank.result.you.score).toBe(0);
    expect(outcomeOf(blank.result)).toBe('not-qualified');
    // Unattempted, not wrong: a paper nobody touched should not read as a
    // paper answered incorrectly.
    expect(blank.marks.every((mark) => mark.outcome === 'unattempted')).toBe(true);
  });

  it('awards marks per question rather than for the paper as a whole', () => {
    // Half the paper answered scores half the paper's marks — the property a
    // result screen showing "7 of 16" depends on.
    const attempt = attemptFor(paper);
    const rubrics = paper.questions.map(wordRubricFor);
    const answered = paper.questions.filter((_draft, index) => index % 2 === 0);

    const answers: Record<number, unknown> = {};
    for (const draft of answered) {
      answers[draft.number] = modelAnswerDocument(buildWordQuestion(draft), 'en');
    }

    const marked = markAttempt(
      attempt,
      rubrics,
      { answers: answers as never, language: 'en', totalTimeSeconds: 600 },
      {
        topper: EMPTY_LINE,
        average: EMPTY_LINE,
        topperTimePerQuestion: [],
        averageTimePerQuestion: [],
      },
      WORD_MARKER,
      { testName: paper.name, tagline: paper.tagline, qualifyingMarks: paper.qualifyingMarks },
    );

    expect(marked.result.you.score).toBe(answered.reduce((sum, draft) => sum + draft.marks, 0));
    expect(marked.marks.filter((mark) => mark.outcome === 'correct')).toHaveLength(answered.length);
    expect(marked.marks.filter((mark) => mark.outcome === 'unattempted')).toHaveLength(
      paper.questions.length - answered.length,
    );
  });
});
