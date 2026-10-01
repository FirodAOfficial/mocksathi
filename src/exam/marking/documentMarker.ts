import type { JSONContent } from '@tiptap/core';
import { project } from '@/exam/document/apply';
import type { AnswerPayload } from '../types';
import type { Criterion, CriterionResult } from './criteria';
import { evaluateCriterion } from './evaluate';
import type { FlatDocument } from './flatten';
import type { SubjectMarker } from './markAttempt';

/**
 * Marking a single-document Word paper.
 *
 * The per-question papers mark one document per question against the passage
 * it started from. Here there is one document for the whole paper, and the
 * candidate moves between questions in any order, so a question cannot be
 * marked against the final document — by then it carries every other answer
 * too, and two questions on the same paragraph could not both be right. It is
 * marked on its *segments* instead: each visit to the question that changed
 * something, as the document before the visit and the document after.
 *
 * Positive criteria ("the word is bold") are read off the last segment's
 * after; `unchanged` must hold for every segment, since each visit is a time
 * the candidate had this question open and could only have been doing this
 * question's work.
 */

export interface DocumentSegment {
  before: JSONContent;
  after: JSONContent;
}

/** What the submit route hands `markAttempt` for one question of such a paper. */
export interface DocumentAnswer {
  segments: DocumentSegment[];
}

interface ProjectedAnswer {
  segments: { before: FlatDocument; after: FlatDocument }[];
}

/**
 * Each question's visits, from the whole sitting's timeline — a document's or,
 * for a single-workbook paper, a workbook's.
 *
 * The before of each entry is the after of the one preceding it — the first
 * one's is the paper's own passage — so the chain is rebuilt here from the
 * server's copy of the passage and cannot be supplied by the client. An entry
 * for a question the paper does not have still takes its place in the chain:
 * dropping it would hand its changes to whichever question came next.
 */
export function segmentsByQuestion<T = JSONContent>(
  passage: T,
  timeline: readonly { question: number; document: T }[],
): Map<number, { before: T; after: T }[]> {
  const segments = new Map<number, { before: T; after: T }[]>();
  let before = passage;

  for (const entry of timeline) {
    const list = segments.get(entry.question) ?? [];
    list.push({ before, after: entry.document });
    segments.set(entry.question, list);
    before = entry.document;
  }

  return segments;
}

/** The answer each question ends on: its last visit's after, for "your answer" on the review screen. */
export function lastDocuments<T = JSONContent>(timeline: readonly { question: number; document: T }[]): Record<number, T> {
  const last: Record<number, T> = {};
  for (const entry of timeline) last[entry.question] = entry.document;
  return last;
}

/**
 * A marker for one sitting.
 *
 * Built per submission so its projection cache lives exactly as long as the
 * request: consecutive segments share a document (one's after is the next
 * one's before), and projecting each only once halves the work.
 */
export function documentMarker(): SubjectMarker<ProjectedAnswer, Criterion> {
  const cache = new WeakMap<object, FlatDocument>();
  const projectOnce = (document: JSONContent): FlatDocument => {
    const cached = cache.get(document);
    if (cached) return cached;
    const projected = project(document);
    cache.set(document, projected);
    return projected;
  };

  return {
    project: (answer: AnswerPayload) => ({
      segments: ((answer as unknown as DocumentAnswer).segments ?? []).map((segment) => ({
        before: projectOnce(segment.before),
        after: projectOnce(segment.after),
      })),
    }),

    // The starting point is per segment, carried in the answer itself.
    start: () => ({ segments: [] }),

    evaluate: (criterion, submitted): CriterionResult => {
      const { segments } = submitted;
      const last = segments[segments.length - 1];
      if (!last) return { label: criterion.label, passed: false, detail: 'Nothing was recorded for this question.' };

      if (criterion.kind !== 'unchanged') return evaluateCriterion(criterion, last.after, last.before);

      for (const [index, segment] of segments.entries()) {
        const result = evaluateCriterion(criterion, segment.after, segment.before);
        if (result.passed) continue;
        return segments.length === 1
          ? result
          : { ...result, detail: `${result.detail ?? ''} (on visit ${index + 1} of ${segments.length} to this question)`.trim() };
      }
      return { label: criterion.label, passed: true };
    },
  };
}
