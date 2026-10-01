import type { JSONContent } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import { documentMarker, lastDocuments, segmentsByQuestion } from '@/exam/marking/documentMarker';
import { markAttempt } from '@/exam/marking/markAttempt';
import type { AnswerPayload, ExamAttempt } from '@/exam/types';
import { documentRubricFor } from '@/server/marking/documentRubric';
import { applySteps, faithful, normaliseDocument, project, replay } from './apply';
import { describeStep, suggestInstruction } from './describe';
import { detectChanges, hasVisibleChange } from './detect';
import { overlapWarnings } from './overlap';
import type { DocumentStep, TimelineEntry } from './types';

/*
 * The single-document flow end to end, without a browser: an admin records
 * questions on one passage in order, and a candidate answers them in another.
 * Editor JSON is written by hand in the shapes TipTap produces, so these are
 * the documents the real editor would hand over.
 */

type Mark = NonNullable<JSONContent['marks']>[number];

function text(value: string, marks?: Mark[]): JSONContent {
  return { type: 'text', text: value, ...(marks ? { marks } : {}) };
}

function paragraph(content: JSONContent[], attrs: Record<string, unknown> = {}): JSONContent {
  return { type: 'paragraph', attrs, content };
}

function doc(...content: JSONContent[]): JSONContent {
  return { type: 'doc', content };
}

const BOLD: Mark = { type: 'bold' };
const ITALIC: Mark = { type: 'italic' };
const YELLOW: Mark = { type: 'highlight', attrs: { color: '#ffff00' } };

const LINE_ONE = 'The quick brown fox jumps over the lazy dog.';
const LINE_TWO = 'Monsoon rains arrive in June every year.';

const PASSAGE = doc(paragraph([text(LINE_ONE)]), paragraph([]), paragraph([text(LINE_TWO)]));

/** The admin's three operations, as the editor would leave the document after each. */
const AFTER_Q1 = doc(
  paragraph([text('The '), text('quick', [BOLD]), text(' brown fox jumps over the lazy dog.')]),
  paragraph([]),
  paragraph([text(LINE_TWO)]),
);
const AFTER_Q2 = doc(
  paragraph([text('The '), text('quick', [BOLD]), text(' brown fox jumps over the lazy dog.')]),
  paragraph([]),
  paragraph([text(LINE_TWO)], { textAlign: 'center' }),
);
const AFTER_Q3 = doc(
  paragraph([text('The '), text('quick', [BOLD]), text(' brown fox jumps over the '), text('lazy dog', [YELLOW]), text('.')]),
  paragraph([]),
  paragraph([text(LINE_TWO)], { textAlign: 'center' }),
);

function detect(before: JSONContent, after: JSONContent): DocumentStep[] {
  const detection = detectChanges(project(before), project(after));
  expect(detection.problems).toEqual([]);
  return detection.steps;
}

describe('detecting what the admin did', () => {
  it('reads a bold word as one character step on exactly that word', () => {
    const steps = detect(PASSAGE, AFTER_Q1);
    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatchObject({ level: 'character', block: 0, from: 4, to: 9, text: 'quick' });
    expect(describeStep(project(PASSAGE), steps[0]!)).toBe('Bold — the second word of paragraph 1 (“quick”)');
  });

  it('reads alignment as a paragraph step', () => {
    const steps = detect(AFTER_Q1, AFTER_Q2);
    expect(steps).toEqual([
      { level: 'paragraph', blocks: [2], changes: [{ property: 'align', value: 'center', previous: null }] },
    ]);
  });

  it('groups two buttons on one selection into one step', () => {
    const after = doc(
      paragraph([text('The '), text('quick', [BOLD, ITALIC]), text(' brown fox jumps over the lazy dog.')]),
      paragraph([]),
      paragraph([text(LINE_TWO)]),
    );
    const steps = detect(PASSAGE, after);
    expect(steps).toHaveLength(1);
    expect(steps[0]!.level === 'character' && steps[0]!.changes.map((change) => change.property)).toEqual([
      'bold',
      'italic',
    ]);
  });

  it('trims a selected trailing space from what is asked, but keeps it licensed', () => {
    const after = doc(
      paragraph([text('The '), text('quick ', [BOLD]), text('brown fox jumps over the lazy dog.')]),
      paragraph([]),
      paragraph([text(LINE_TWO)]),
    );
    const [step] = detect(PASSAGE, after);
    expect(step).toMatchObject({ from: 4, to: 9 });
    expect(step!.level === 'character' && step!.changes[0]!.range).toEqual({ from: 4, to: 10 });
  });

  it('refuses a change to the wording', () => {
    const after = doc(paragraph([text('The quick brown fox.')]), paragraph([]), paragraph([text(LINE_TWO)]));
    const detection = detectChanges(project(PASSAGE), project(after));
    expect(detection.problems[0]).toMatch(/wording of paragraph 1 changed/);
  });

  it('treats a change to an empty paragraph as allowed but not asked for', () => {
    const after = doc(paragraph([text(LINE_ONE)]), paragraph([], { textAlign: 'center' }), paragraph([text(LINE_TWO)]));
    const steps = detect(PASSAGE, after);
    expect(steps[0]).toMatchObject({ level: 'paragraph', blocks: [1], licenceOnly: true });
    expect(hasVisibleChange(steps)).toBe(false);
  });

  it('suggests an instruction from what was detected', () => {
    expect(suggestInstruction(project(PASSAGE), detect(AFTER_Q2, AFTER_Q3))).toBe(
      'Apply highlight yellow to the eighth to ninth words of paragraph 1 (“lazy dog”).',
    );
  });
});

describe('replaying recorded questions', () => {
  const q1 = detect(PASSAGE, AFTER_Q1);
  const q2 = detect(AFTER_Q1, AFTER_Q2);
  const q3 = detect(AFTER_Q2, AFTER_Q3);

  it('reproduces each recorded after exactly', () => {
    expect(faithful(PASSAGE, q1, AFTER_Q1)).toBe(true);
    expect(faithful(AFTER_Q1, q2, AFTER_Q2)).toBe(true);
    expect(faithful(AFTER_Q2, q3, AFTER_Q3)).toBe(true);
  });

  it('rebuilds the authoring state from the passage and every question', () => {
    const rebuilt = replay(PASSAGE, [{ steps: q1 }, { steps: q2 }, { steps: q3 }]);
    expect(detectChanges(project(rebuilt), project(AFTER_Q3)).steps).toEqual([]);
  });

  it('shows one question alone as its worked answer', () => {
    const worked = applySteps(PASSAGE, q3);
    const steps = detect(PASSAGE, worked);
    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatchObject({ level: 'character', text: 'lazy dog' });
  });

  it('normalises a passage without changing what the marker sees', () => {
    expect(detectChanges(project(PASSAGE), project(normaliseDocument(PASSAGE))).steps).toEqual([]);
  });

  it('drops values that are not what they claim to be', () => {
    const hostile = doc(
      paragraph([text('Hello', [{ type: 'textStyle', attrs: { color: 'red; background:url(x)' } }])], {
        textAlign: 'sideways',
      }),
    );
    const clean = project(normaliseDocument(hostile));
    expect(clean.chars[0]!.marks.color).toBeUndefined();
    expect(clean.blocks[0]!.paragraph.align).toBeNull();
  });
});

describe('marking a candidate who answers in another order', () => {
  const recorded = [
    { number: 1, steps: detect(PASSAGE, AFTER_Q1) },
    { number: 2, steps: detect(AFTER_Q1, AFTER_Q2) },
    { number: 3, steps: detect(AFTER_Q2, AFTER_Q3) },
  ];

  const attempt: ExamAttempt = {
    candidateName: 'Candidate',
    subject: 'word',
    durationSeconds: 900,
    sharedDocument: PASSAGE,
    sections: [
      {
        name: 'Word',
        questions: recorded.map(({ number }) => ({
          subject: 'word' as const,
          number,
          topic: 'Formatting',
          difficulty: 'Easy' as const,
          instruction: { en: `Question ${number}`, hi: `Question ${number}` },
          solution: { en: [], hi: [] },
          passage: { en: PASSAGE, hi: PASSAGE },
          modelAnswer: { scope: 'all' as const },
          marks: 2,
          bookmarked: false,
        })),
      },
    ],
  };

  const rubrics = recorded.map(({ number, steps }) => documentRubricFor(number, steps, project(PASSAGE)));

  function mark(timeline: TimelineEntry[]) {
    const segments = segmentsByQuestion(PASSAGE, timeline);
    const answers: Record<number, AnswerPayload> = {};
    for (const [number, list] of segments) answers[number] = { segments: list } as unknown as AnswerPayload;

    return markAttempt(
      attempt,
      rubrics,
      { answers, language: 'en', totalTimeSeconds: 60 },
      { topper: { score: 0, timeSeconds: 0 }, average: { score: 0, timeSeconds: 0 }, topperTimePerQuestion: [], averageTimePerQuestion: [] } as never,
      documentMarker(),
      { testName: 'Test', tagline: '', qualifyingMarks: 0 },
    );
  }

  // The candidate highlights first, then centres, then bolds.
  const S1 = doc(
    paragraph([text('The quick brown fox jumps over the '), text('lazy dog', [YELLOW]), text('.')]),
    paragraph([]),
    paragraph([text(LINE_TWO)]),
  );
  const S2 = doc(
    paragraph([text('The quick brown fox jumps over the '), text('lazy dog', [YELLOW]), text('.')]),
    paragraph([]),
    paragraph([text(LINE_TWO)], { textAlign: 'center' }),
  );
  const S3 = doc(
    paragraph([text('The '), text('quick', [BOLD]), text(' brown fox jumps over the '), text('lazy dog', [YELLOW]), text('.')]),
    paragraph([]),
    paragraph([text(LINE_TWO)], { textAlign: 'center' }),
  );

  it('marks every question right whatever order they were answered in', () => {
    const { result } = mark([
      { question: 3, document: S1 },
      { question: 2, document: S2 },
      { question: 1, document: S3 },
    ]);
    expect(result.you.correct).toBe(3);
    expect(result.you.score).toBe(6);
  });

  it('marks a question wrong when its change was made while another was open', () => {
    // The bold was done while question 2 was open; question 1 was never touched.
    const { result, marks } = mark([
      { question: 3, document: S1 },
      { question: 2, document: S3 },
    ]);
    expect(marks.find((entry) => entry.number === 1)?.outcome).toBe('unattempted');
    expect(marks.find((entry) => entry.number === 2)?.outcome).toBe('incorrect');
    expect(marks.find((entry) => entry.number === 3)?.outcome).toBe('correct');
    expect(result.you.score).toBe(2);
  });

  it('marks an extra change on the same question wrong', () => {
    const boldAndItalic = doc(
      paragraph([text('The '), text('quick', [BOLD, ITALIC]), text(' brown fox jumps over the lazy dog.')]),
      paragraph([]),
      paragraph([text(LINE_TWO)]),
    );
    const { marks } = mark([{ question: 1, document: boldAndItalic }]);
    const q1 = marks.find((entry) => entry.number === 1)!;
    expect(q1.outcome).toBe('incorrect');
    expect(q1.criteria.find((criterion) => !criterion.passed)?.label).toMatch(/Nothing else/);
  });

  it('accepts a question finished over two visits', () => {
    const half = doc(
      paragraph([text('The quick brown fox jumps over the '), text('lazy', [YELLOW]), text(' dog.')]),
      paragraph([]),
      paragraph([text(LINE_TWO)]),
    );
    const { marks } = mark([
      { question: 3, document: half },
      { question: 2, document: doc(half.content![0]!, paragraph([]), paragraph([text(LINE_TWO)], { textAlign: 'center' })) },
      {
        question: 3,
        document: doc(
          paragraph([text('The quick brown fox jumps over the '), text('lazy dog', [YELLOW]), text('.')]),
          paragraph([]),
          paragraph([text(LINE_TWO)], { textAlign: 'center' }),
        ),
      },
    ]);
    expect(marks.find((entry) => entry.number === 3)?.outcome).toBe('correct');
    expect(marks.find((entry) => entry.number === 2)?.outcome).toBe('correct');
  });

  it('keeps each question’s last document as its answer', () => {
    expect(lastDocuments([{ question: 1, document: S1 }, { question: 1, document: S3 }])[1]).toBe(S3);
  });
});

describe('overlap between questions', () => {
  it('warns when two questions set the same property on the same text', () => {
    const red = doc(
      paragraph([text('The '), text('quick', [{ type: 'textStyle', attrs: { color: '#ff0000' } }]), text(' brown fox jumps over the lazy dog.')]),
      paragraph([]),
      paragraph([text(LINE_TWO)]),
    );
    const blue = doc(
      paragraph([text('The '), text('quick', [{ type: 'textStyle', attrs: { color: '#0000ff' } }]), text(' brown fox jumps over the lazy dog.')]),
      paragraph([]),
      paragraph([text(LINE_TWO)]),
    );
    const first = detect(PASSAGE, red);
    const second = detect(red, blue);
    expect(overlapWarnings(second, [{ number: 1, steps: first }])).toHaveLength(1);
    expect(overlapWarnings(detect(PASSAGE, AFTER_Q1), [{ number: 2, steps: detect(AFTER_Q1, AFTER_Q2) }])).toEqual([]);
  });
});
