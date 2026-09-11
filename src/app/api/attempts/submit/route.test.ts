import { Editor } from '@tiptap/core';
import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it } from 'vitest';
import { buildEditorExtensions } from '@/editor/extensions';
import { findQuestion, isWordQuestion } from '@/exam/types';
import { SEED_ATTEMPT } from '@/exam/seedAttempt';
import type { ExamResult } from '@/exam/result';
import { POST } from './route';

const editors: Editor[] = [];

afterEach(() => {
  while (editors.length) editors.pop()?.destroy();
});

/** Answers question 1 correctly, through the same commands the ribbon uses. */
function correctAnswerToQuestionOne() {
  const question = findQuestion(SEED_ATTEMPT, 1)!;
  if (!isWordQuestion(question)) throw new Error('Question 1 should be a Word question.');
  const element = document.createElement('div');
  document.body.appendChild(element);
  const editor = new Editor({ element, extensions: buildEditorExtensions(), content: question.passage.en });
  editors.push(editor);

  editor.commands.selectAll();
  editor.chain().focus().toggleBold().toggleUnderline().run();
  return editor.getJSON();
}

function post(body: unknown): Promise<Response> {
  return POST(
    new NextRequest('http://localhost/api/attempts/submit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  );
}

describe('POST /api/attempts/submit', () => {
  it('marks a correct answer and returns the score', async () => {
    const response = await post({
      answers: { 1: correctAnswerToQuestionOne() },
      timePerQuestion: { 1: 30 },
      totalTimeSeconds: 45,
      language: 'en',
    });

    expect(response.status).toBe(200);
    const result = (await response.json()) as ExamResult;
    expect(result.you).toMatchObject({ score: 4, correct: 1, unattempted: 14, timeSeconds: 45 });
    expect(result.maximumMarks).toBe(50);
  });

  it('scores an empty paper as zero', async () => {
    const response = await post({ answers: {}, totalTimeSeconds: 10 });
    const result = (await response.json()) as ExamResult;

    expect(result.you.score).toBe(0);
    expect(result.you.unattempted).toBe(15);
  });

  it('returns what was checked, but never the answer key itself', async () => {
    const response = await post({ answers: { 1: correctAnswerToQuestionOne() }, totalTimeSeconds: 5 });
    const body = await response.text();

    // The review screen needs the criterion labels to say why a question was
    // wrong, so they ship with a marked result.
    expect(body).toContain('The paragraph is bold');

    // The rubric itself does not: no criterion kinds, no targets, and no values
    // to compare against. Marking stays something only the server can do.
    for (const leak of ['"kind"', '"target"', '"criteria"', 'notMarked', 'blockAttr', '#ff0000']) {
      expect(body).not.toContain(leak);
    }
  });

  it('rejects a body that is not JSON', async () => {
    const response = await post('not json at all');

    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe('INVALID_SUBMISSION');
  });

  it('rejects a body with no answers', async () => {
    const response = await post({ totalTimeSeconds: 5 });

    expect(response.status).toBe(400);
  });

  it('does not trust marks or passages sent by the client', async () => {
    const response = await post({
      answers: { 1: correctAnswerToQuestionOne() },
      totalTimeSeconds: 5,
      // All ignored: the paper is loaded server-side.
      maximumMarks: 5000,
      you: { score: 50 },
    });

    const result = (await response.json()) as ExamResult;
    expect(result.maximumMarks).toBe(50);
    expect(result.you.score).toBe(4);
  });
});
