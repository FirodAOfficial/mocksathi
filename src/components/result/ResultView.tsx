'use client';

import { useState } from 'react';
import type { JSONContent } from '@tiptap/core';
import type { ExamResult } from '@/exam/result';
import type { ExamAttempt, Language } from '@/exam/types';
import { ResultScreen } from './ResultScreen';
import { SolutionsScreen } from './SolutionsScreen';

export interface ResultViewProps {
  result: ExamResult;
  /** The paper behind the result, for the worked solutions. */
  attempt: ExamAttempt;
  /** What the candidate submitted, for the review screen. */
  answers?: Record<number, JSONContent>;
  language: Language;
  backHref?: string;
}

/**
 * The result and its solutions, and the one piece of state that switches them.
 *
 * Both screens are pure presentation, so the toggle has to live somewhere; it
 * lives here rather than in either screen, which keeps the design preview route
 * and the live submission on exactly the same pair of components.
 */
export function ResultView({ result, attempt, answers, language, backHref = '/' }: ResultViewProps) {
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
    />
  );
}
