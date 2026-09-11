'use client';

import { create } from 'zustand';
import { SEED_ATTEMPT } from '@/exam/seedAttempt';
import {
  allQuestions,
  type AnswerPayload,
  type AnsweredSet,
  type ExamAttempt,
  type Language,
} from '@/exam/types';

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
  /** Chosen before the paper starts; the passage and instruction follow it. */
  language: Language;
  /** The 1-based question number currently open. */
  selectedNumber: number;
  /**
   * Only questions edited away from their starting document appear here, which
   * is what makes "attempted" derivable rather than something to keep in sync.
   */
  answers: Record<number, AnswerPayload>;

  submittedBy: SubmissionReason | null;
  /**
   * When the candidate started, so the result can report how long they took.
   * Set from the client on mount rather than at store creation, which would
   * otherwise be evaluated during server rendering.
   */
  startedAt: number | null;
  /** Seconds accrued per question, banked whenever the candidate moves on. */
  timePerQuestion: Record<number, number>;
  /** When the open question was opened; the running part of the total. */
  questionOpenedAt: number | null;

  setAttempt: (attempt: ExamAttempt) => void;
  /**
   * Begins a fresh sitting in the given language.
   *
   * This store outlives any one paper: it is a module singleton, so a candidate
   * who finishes a paper and walks back to the instructions without a full page
   * load still holds the previous attempt's answers, timings, review flags and —
   * worst of all — its `submittedBy`, which would drop them straight back onto
   * the result screen. Starting a paper therefore clears the last one rather
   * than assuming a reload did it.
   */
  startAttempt: (language: Language) => void;
  selectQuestion: (number: number) => void;
  stepQuestion: (direction: 1 | -1) => void;

  /**
   * Stores what the candidate produced for one question.
   *
   * The payload is opaque here: a Word answer is a document, an Excel answer is
   * a workbook, and nothing in this store inspects either. That is what lets
   * one store, one palette and one timer serve both papers.
   */
  saveAnswer: (number: number, answer: AnswerPayload) => void;
  /** Drops the stored edit, returning the question to its starting document. */
  clearAnswer: (number: number) => void;

  toggleMarkedForReview: (number: number) => void;

  /** Banks time on the open question without moving away from it. */
  bankTime: () => void;
  submit: (reason: SubmissionReason) => void;
}

/**
 * Moves the time spent on the open question into the ledger.
 *
 * Called on every question change and again at submit, so the totals cover the
 * question the candidate was still looking at when the paper closed.
 */
function bankOpenQuestion(state: ExamState, now = Date.now()): Pick<ExamState, 'timePerQuestion' | 'questionOpenedAt'> {
  if (state.questionOpenedAt === null) return { timePerQuestion: state.timePerQuestion, questionOpenedAt: now };

  const spent = Math.max(0, (now - state.questionOpenedAt) / 1000);
  return {
    timePerQuestion: {
      ...state.timePerQuestion,
      [state.selectedNumber]: (state.timePerQuestion[state.selectedNumber] ?? 0) + spent,
    },
    questionOpenedAt: now,
  };
}

export const useExamStore = create<ExamState>((set, get) => ({
  attempt: SEED_ATTEMPT,
  language: 'en',
  selectedNumber: 1,
  answers: {},
  submittedBy: null,
  startedAt: null,
  timePerQuestion: {},
  questionOpenedAt: null,

  setAttempt: (attempt) =>
    set({
      attempt,
      selectedNumber: allQuestions(attempt)[0]?.number ?? 1,
      answers: {},
      submittedBy: null,
      startedAt: Date.now(),
      timePerQuestion: {},
      questionOpenedAt: Date.now(),
    }),

  startAttempt: (language) =>
    set((state) => ({
      language,
      answers: {},
      submittedBy: null,
      selectedNumber: allQuestions(state.attempt)[0]?.number ?? 1,
      timePerQuestion: {},
      startedAt: Date.now(),
      questionOpenedAt: Date.now(),
      // Review flags live on the questions themselves, so they have to be
      // cleared here too or the new paper opens with the last one's marks.
      attempt: {
        ...state.attempt,
        sections: state.attempt.sections.map((section) => ({
          ...section,
          questions: section.questions.map((question) =>
            question.bookmarked ? { ...question, bookmarked: false } : question,
          ),
        })),
      },
    })),

  selectQuestion: (selectedNumber) =>
    set((state) => (state.selectedNumber === selectedNumber ? state : { ...bankOpenQuestion(state), selectedNumber })),

  stepQuestion: (direction) => {
    const questions = allQuestions(get().attempt);
    const index = questions.findIndex((question) => question.number === get().selectedNumber);
    const next = questions[Math.min(questions.length - 1, Math.max(0, index + direction))];
    if (next && next.number !== get().selectedNumber) {
      set((state) => ({ ...bankOpenQuestion(state), selectedNumber: next.number }));
    }
  },

  saveAnswer: (number, answer) =>
    set((state) => ({ answers: { ...state.answers, [number]: answer } })),

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

  bankTime: () => set((state) => bankOpenQuestion(state)),

  // Submitting is one-way, and the first reason wins: a candidate pressing
  // Submit as the clock runs out should not have it recorded as a timeout.
  submit: (reason) =>
    set((state) => (state.submittedBy ? state : { ...bankOpenQuestion(state), submittedBy: reason })),
}));

/** The paper is closed: submitted by the candidate, or by the clock. */
export function selectIsLocked(state: { submittedBy: SubmissionReason | null }): boolean {
  return state.submittedBy !== null;
}

/** Seconds spent on the paper so far; 0 before the clock has started. */
export function elapsedSeconds(startedAt: number | null): number {
  return startedAt === null ? 0 : Math.max(0, (Date.now() - startedAt) / 1000);
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
