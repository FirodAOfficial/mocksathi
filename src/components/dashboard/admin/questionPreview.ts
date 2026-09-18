'use client';

import type { JSONContent } from '@tiptap/core';
import { buildWordQuestion, startingPassage, type WordOperation, type WordScope } from '@/exam/authoring';
import { modelAnswerDocument } from '@/exam/modelAnswerDocument';

/**
 * What the question being written will actually look like.
 *
 * The admin form states a question as data — a passage, a selection, a list of
 * operations — and an author cannot tell from that whether they have written
 * "bold the third word" or "bold the third paragraph". These two documents are
 * the answer: the passage as the candidate will open it, and the passage as it
 * looks once the question has been answered correctly.
 *
 * They are built by the *real* builders, not by a preview-only approximation.
 * `startingPassage` is what the player renders and `modelAnswerDocument` is
 * what the review screen shows, so a preview that looked right and a sitting
 * that went wrong is not a state this can reach — and the same functions feed
 * the answer key, so what the author sees is what the candidate is marked on.
 */

export interface QuestionPreview {
  /** The passage as the candidate first sees it, starting formatting included. */
  start: JSONContent;
  /** The passage once the question has been answered correctly. */
  answer: JSONContent;
}

export interface PreviewInput {
  /** One paragraph per line, as typed into the passage box. */
  lines: string[];
  scope: WordScope;
  operations: WordOperation[];
  /** Formatting the passage starts with, applied to the same selection. */
  initial: WordOperation[];
}

/**
 * The two documents, or null when the question is not yet enough to show one.
 *
 * Null rather than a half-rendered guess: a passage with no text, or a
 * selection naming a word that is not there, is a question that cannot be sat,
 * and the form says so in words rather than showing an empty page.
 */
export function questionPreview(input: PreviewInput): QuestionPreview | null {
  const lines = input.lines.length > 0 ? input.lines : [''];
  if (lines.every((line) => line.trim() === '')) return null;

  const initial = input.initial.length > 0 ? [{ scope: input.scope, operations: input.initial }] : undefined;

  try {
    const question = buildWordQuestion({
      subject: 'word',
      number: 1,
      topic: 'preview',
      difficulty: 'Easy',
      marks: 1,
      instruction: { en: '', hi: '' },
      solution: { en: [], hi: [] },
      lines: { en: lines, hi: lines },
      scope: input.scope,
      operations: input.operations,
      ...(initial ? { initial } : {}),
    });

    return {
      start: startingPassage(lines, initial),
      answer: modelAnswerDocument(question, 'en'),
    };
  } catch {
    // A half-typed operation — a font size box the author has just emptied —
    // is not an error worth shouting about; the preview simply waits.
    return null;
  }
}
