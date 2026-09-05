import type { JSONContent } from '@tiptap/core';
import type { ExamQuestion } from '@/exam/types';

/**
 * The document each question starts with, and how to tell it has been changed.
 *
 * Every question owns a separate ProseMirror document rather than a region of
 * one shared document. Switching questions then cannot disturb another
 * question's text, and "clear this question" is a single replacement instead of
 * a range edit that has to find the right paragraph.
 */
export type AnswerDocument = JSONContent;

/**
 * A heading naming the question, the question itself, and an empty paragraph to
 * answer in — so the text area visibly belongs to the selected question.
 */
export function defaultAnswerDocument(question: ExamQuestion): AnswerDocument {
  return {
    type: 'doc',
    content: [
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: `Question ${question.number}` }],
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: question.prompt }],
      },
      { type: 'paragraph', content: [] },
    ],
  };
}

/**
 * Structural comparison of two documents.
 *
 * Both sides must already have been through the editor's schema. `getJSON()`
 * fills in every default attribute a node type declares — `styleName: null`,
 * `textAlign: null`, and so on — which a hand-written document does not carry,
 * so comparing raw against serialised marks every question as edited.
 *
 * Serialising is enough once both sides are canonical: ProseMirror emits a
 * stable key order, the documents are a few paragraphs long, and this runs only
 * when the candidate moves between questions.
 */
export function documentsEqual(a: AnswerDocument, b: AnswerDocument): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
