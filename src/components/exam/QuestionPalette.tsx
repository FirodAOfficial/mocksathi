'use client';

import { statusOf, type AnsweredSet, type ExamQuestion, type QuestionStatus } from '@/exam/types';
import styles from './QuestionPalette.module.css';

export interface QuestionPaletteProps {
  questions: ExamQuestion[];
  /** Question numbers that have been edited. */
  answered: AnsweredSet;
  selectedNumber: number;
  onSelect: (number: number) => void;
}

const STATUS_CLASS: Record<QuestionStatus, string> = {
  attempted: styles.attempted ?? '',
  unattempted: styles.unattempted ?? '',
};

const SPOKEN_STATUS: Record<QuestionStatus, string> = {
  attempted: 'attempted',
  unattempted: 'not attempted',
};

/**
 * The grid of question numbers.
 *
 * Status is carried by shape as well as colour — attempted questions are domes,
 * unattempted ones squares — so the palette is still readable without colour
 * vision, and each button states its status in its accessible name.
 */
export function QuestionPalette({ questions, answered, selectedNumber, onSelect }: QuestionPaletteProps) {
  if (questions.length === 0) {
    return <p className={styles.empty}>No questions match this filter.</p>;
  }

  return (
    <div className={styles.grid}>
      {questions.map((question) => {
        const status = statusOf(question, answered);

        return (
          <button
            key={question.number}
            type="button"
            className={[
              styles.cell,
              STATUS_CLASS[status],
              question.number === selectedNumber ? styles.current : '',
              question.bookmarked ? styles.bookmarked : '',
            ]
              .filter(Boolean)
              .join(' ')}
            aria-current={question.number === selectedNumber ? 'true' : undefined}
            aria-label={`Question ${question.number}, ${SPOKEN_STATUS[status]}${
              question.bookmarked ? ', marked for review' : ''
            }`}
            title={`Question ${question.number} — ${SPOKEN_STATUS[status]}`}
            onClick={() => onSelect(question.number)}
          >
            {question.number}
          </button>
        );
      })}
    </div>
  );
}
