'use client';

import { summarise, type AnsweredSet, type ExamAttempt } from '@/exam/types';
import { Dialog } from '../dialogs/Dialog';
import styles from './SubmitDialog.module.css';

export interface SubmitDialogProps {
  attempt: ExamAttempt;
  answered: AnsweredSet;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * Confirmation before submitting.
 *
 * Submitting closes the paper and locks the editor, so it asks first and shows
 * what is about to be handed in — in particular how many questions are still
 * unanswered or flagged for review.
 */
export function SubmitDialog({ attempt, answered, onConfirm, onClose }: SubmitDialogProps) {
  const summary = summarise(attempt, answered);

  const rows: [string, number][] = [
    ['Attempted', summary.attempted],
    ['Not attempted', summary.unattempted],
    ['Marked for review', summary.markedForReview],
    ['Total questions', summary.total],
  ];

  return (
    <Dialog
      title="Submit paper"
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.button} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={`${styles.button} ${styles.primary}`} onClick={onConfirm}>
            Submit
          </button>
        </>
      }
    >
      <dl className={styles.summary}>
        {rows.map(([label, value]) => (
          <div key={label} className={styles.row}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      <p className={styles.warning}>Once submitted the paper is locked and no further editing is possible.</p>
    </Dialog>
  );
}
