'use client';

import { create } from 'zustand';
import type { AnswerDocument } from '@/editor/answerDocument';
import { SEED_ATTEMPT } from '@/exam/seedAttempt';
import { allQuestions, type AnsweredSet, type ExamAttempt } from '@/exam/types';

/**
 * Exam state: which question is open, what has been typed for each, and whether
 * the paper is still open.
 *
 * Separate from `uiStore`, which holds editor chrome (zoom, ribbon tab). The
 * editor still works standalone if the exam panels are dropped.
 *
 * Answers live in memory only. That is deliberate rather than an omission —
 * edits survive moving between questions and are dropped on refresh or when
 * the candidate clears them, which is exactly the required behaviour.
 */

/** How the paper came to be closed. */
export type SubmissionReason = 'candidate' | 'timeout';

interface ExamState {
  attempt: ExamAttempt;
  /** The 1-based question number currently open. */
  selectedNumber: number;
  /**
   * Only questions edited away from their starting document appear here, which
   * is what makes "attempted" derivable rather than something to keep in sync.
   */
  answers: Record<number, AnswerDocument>;

  submittedBy: SubmissionReason | null;
  /** Set once the candidate has closed the result screen. */
  resultSeen: boolean;

  setAttempt: (attempt: ExamAttempt) => void;
  selectQuestion: (number: number) => void;
  stepQuestion: (direction: 1 | -1) => void;

  saveAnswer: (number: number, document: AnswerDocument) => void;
  /** Drops the stored edit, returning the question to its starting document. */
  clearAnswer: (number: number) => void;

  toggleMarkedForReview: (number: number) => void;

  submit: (reason: SubmissionReason) => void;
  dismissResult: () => void;
}

export const useExamStore = create<ExamState>((set, get) => ({
  attempt: SEED_ATTEMPT,
  selectedNumber: 1,
  answers: {},
  submittedBy: null,
  resultSeen: false,

  setAttempt: (attempt) =>
    set({
      attempt,
      selectedNumber: allQuestions(attempt)[0]?.number ?? 1,
      answers: {},
      submittedBy: null,
      resultSeen: false,
    }),

  selectQuestion: (selectedNumber) => set({ selectedNumber }),

  stepQuestion: (direction) => {
    const questions = allQuestions(get().attempt);
    const index = questions.findIndex((question) => question.number === get().selectedNumber);
    const next = questions[Math.min(questions.length - 1, Math.max(0, index + direction))];
    if (next) set({ selectedNumber: next.number });
  },

  saveAnswer: (number, document) =>
    set((state) => ({ answers: { ...state.answers, [number]: document } })),

  clearAnswer: (number) =>
    set((state) => {
      if (!(number in state.answers)) return state;
      const answers = { ...state.answers };
      delete answers[number];
      return { answers };
    }),

  toggleMarkedForReview: (number) =>
    set((state) => ({
      attempt: {
        ...state.attempt,
        sections: state.attempt.sections.map((section) => ({
          ...section,
          questions: section.questions.map((question) =>
            question.number === number ? { ...question, bookmarked: !question.bookmarked } : question,
          ),
        })),
      },
    })),

  // Submitting is one-way, and the first reason wins: a candidate pressing
  // Submit as the clock runs out should not have it recorded as a timeout.
  submit: (reason) => set((state) => (state.submittedBy ? state : { submittedBy: reason })),

  dismissResult: () => set({ resultSeen: true }),
}));

/** The paper is closed: submitted by the candidate, or by the clock. */
export function selectIsLocked(state: { submittedBy: SubmissionReason | null }): boolean {
  return state.submittedBy !== null;
}

/**
 * Question numbers that have been edited, as the set the exam model expects.
 *
 * Not a store selector: it builds a new Set each call, which would fail the
 * store's referential equality check and re-render on every update. Components
 * subscribe to `answers` — a stable reference — and memoise this from it.
 */
export function answeredSet(answers: Record<number, unknown>): AnsweredSet {
  return new Set(Object.keys(answers).map(Number));
}
