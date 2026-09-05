'use client';

import { findQuestion, localised } from '@/exam/types';
import { useExamStore } from '@/state/examStore';
import styles from './InstructionStrip.module.css';

/**
 * What the candidate has been asked to do with the passage below.
 *
 * Deliberately outside the editor: an instruction inside the document could be
 * formatted or deleted by the candidate, and the marker would have no clean way
 * to tell instruction from answer.
 */
export function InstructionStrip() {
  const attempt = useExamStore((state) => state.attempt);
  const selectedNumber = useExamStore((state) => state.selectedNumber);
  const language = useExamStore((state) => state.language);
  const question = findQuestion(attempt, selectedNumber);

  if (!question) return null;

  return (
    <div className={styles.strip} role="note" aria-label={`Question ${question.number} instruction`}>
      <span className={styles.number}>Question {question.number}</span>
      <p className={styles.instruction}>{localised(question.instruction, language)}</p>
      <span className={styles.marks}>
        {question.marks} {question.marks === 1 ? 'mark' : 'marks'}
      </span>
    </div>
  );
}
