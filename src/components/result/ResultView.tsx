'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import type { ExamResult } from '@/exam/result';
import type { AnswerPayload, ExamAttempt, Language } from '@/exam/types';
import { ResultScreen } from './ResultScreen';

/**
 * The solutions screen is loaded on demand. It renders the candidate's Word
 * answers in a real tiptap editor (`PassagePreview`) and their workbooks from
 * the spreadsheet model — ~160 KB of gzipped JavaScript that every result page
 * used to download up front, whether or not "View Solutions" was ever clicked.
 * `preloadSolutions` starts that download on hover/focus of the button, so by
 * the click it is usually already there.
 */
const loadSolutions = () => import('./SolutionsScreen');
const preloadSolutions = () => {
  void loadSolutions();
};
const SolutionsScreen = dynamic(() => loadSolutions().then((module) => module.SolutionsScreen), {
  loading: () => <p style={{ padding: 24, color: '#4a5c6e' }}>Loading solutions…</p>,
});

export interface ResultViewProps {
  result: ExamResult;
  /** The paper behind the result, for the worked solutions. */
  attempt: ExamAttempt;
  /** What the candidate submitted, for the review screen. */
  answers?: Record<number, AnswerPayload>;
  language: Language;
  backHref?: string;
  /** See `ResultScreenProps.attemptCount`. */
  attemptCount?: number;
}

/**
 * The result and its solutions, and the one piece of state that switches them.
 *
 * Both screens are pure presentation, so the toggle has to live somewhere; it
 * lives here rather than in either screen, which keeps the design preview route
 * and the live submission on exactly the same pair of components.
 */
export function ResultView({ result, attempt, answers, language, backHref = '/', attemptCount }: ResultViewProps) {
  const [showingSolutions, setShowingSolutions] = useState(false);

  if (showingSolutions) {
    return (
      <SolutionsScreen
        attempt={attempt}
        result={result}
        answers={answers}
        language={language}
        onBack={() => setShowingSolutions(false)}
      />
    );
  }

  return (
    <ResultScreen
      result={result}
      backHref={backHref}
      onViewSolutions={() => setShowingSolutions(true)}
      onSolutionsIntent={preloadSolutions}
      attemptCount={attemptCount}
    />
  );
}
