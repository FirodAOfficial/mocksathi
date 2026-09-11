import type { JSONContent } from '@tiptap/core';
import { proseMirrorToDocument } from '@/editor/proseMirrorToDocument';
import type { DocumentMetadata } from '@/services/document/types';
import type { Criterion } from './criteria';
import { evaluateCriterion } from './evaluate';
import { flatten, type FlatDocument } from './flatten';
import type { SubjectMarker } from './markAttempt';
import { isWordQuestion, type AnswerPayload, type ExamQuestion, type Language } from '../types';

/**
 * Marking a Word paper.
 *
 * Everything here was previously inlined in `markQuestion`; it moved out so the
 * scoring loop stopped knowing what a document is. The behaviour is unchanged —
 * project through the same canonical form, take the starting document from the
 * question's own passage, and check criteria with the same evaluator.
 */

/** Marking never reads metadata; this satisfies the model's shape. */
const NO_METADATA: DocumentMetadata = {
  title: '',
  format: 'blank',
  sourceUrl: null,
  unsupportedFeatures: [],
};

export function projectDocument(document: JSONContent): FlatDocument {
  return flatten(proseMirrorToDocument(document, NO_METADATA));
}

export const WORD_MARKER: SubjectMarker<FlatDocument, Criterion> = {
  project: (answer: AnswerPayload) => projectDocument(answer as JSONContent),

  start: (question: ExamQuestion, language: Language) => {
    if (!isWordQuestion(question)) {
      // An Excel question in a Word paper is a mis-built paper. Projecting an
      // empty document would mark every answer wrong without saying why.
      throw new Error(`Question ${question.number} is not a Word question.`);
    }
    return projectDocument(question.passage[language]);
  },

  evaluate: evaluateCriterion,
};
