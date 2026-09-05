import type { JSONContent } from '@tiptap/core';
import type { ExamQuestion, Language } from '@/exam/types';

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
 * The passage the question starts from.
 *
 * The document holds the passage and nothing else — no heading, no instruction,
 * no scratch paragraph. The whole document is therefore the answer, which is
 * what lets the marker treat every character in it as under test.
 */
export function defaultAnswerDocument(question: ExamQuestion, language: Language): AnswerDocument {
  // Deep-copied: the passage is shared question data, and the editor would
  // otherwise mutate the paper itself as the candidate types.
  return structuredClone(question.passage[language]) as AnswerDocument;
}

/** True when a document contains a table, which changes how it is selected. */
export function hasTable(document: AnswerDocument): boolean {
  return (document.content ?? []).some((node) => node.type === 'table');
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
