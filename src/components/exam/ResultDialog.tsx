'use client';

import { summarise, type AnsweredSet, type ExamAttempt } from '@/exam/types';
import type { SubmissionReason } from '@/state/examStore';
import { Dialog } from '../dialogs/Dialog';
import styles from './ResultDialog.module.css';

export interface ResultDialogProps {
  attempt: ExamAttempt;
  answered: AnsweredSet;
  reason: SubmissionReason;
  onClose: () => void;
}

/**
 * The screen shown once the paper closes, whether the candidate submitted or
 * the clock ran out.
 *
 * It reports what was handed in, not a score: nothing in this build marks
 * answers, so there is no result to give beyond the attempt itself. Inventing a
 * percentage would be worse than saying so.
 */
export function ResultDialog({ attempt, answered, reason, onClose }: ResultDialogProps) {
  const summary = summarise(attempt, answered);
  const completion = summary.total === 0 ? 0 : Math.round((summary.attempted / summary.total) * 100);

  return (
    <Dialog
      title={reason === 'timeout' ? 'Time up — paper submitted' : 'Paper submitted'}
      onClose={onClose}
      footer={
        // "Done" rather than a second "Close": the dialog frame already has a
        // close control, and two identically named buttons is a poor target for
        // both screen readers and muscle memory.
        <button type="button" className={`${styles.button} ${styles.primary}`} onClick={onClose}>
          Done
        </button>
      }
    >
      <p className={styles.lede}>
        {reason === 'timeout'
          ? 'The time allowed has run out. Everything written was submitted automatically.'
          : 'Your paper has been submitted.'}
      </p>

      <div className={styles.headline}>
        <span className={styles.figure}>
          {summary.attempted}
          <span className={styles.of}>/{summary.total}</span>
        </span>
        <span className={styles.figureLabel}>questions attempted</span>
      </div>

      <div className={styles.meter} role="img" aria-label={`${completion}% of the paper attempted`}>
        <div className={styles.meterFill} style={{ width: `${completion}%` }} />
      </div>

      <dl className={styles.breakdown}>
        <div className={styles.row}>
          <dt>Attempted</dt>
          <dd>{summary.attempted}</dd>
        </div>
        <div className={styles.row}>
          <dt>Not attempted</dt>
          <dd>{summary.unattempted}</dd>
        </div>
        <div className={styles.row}>
          <dt>Marked for review</dt>
          <dd>{summary.markedForReview}</dd>
        </div>
      </dl>

      <p className={styles.note}>
        Answers are not marked in this build, so no score is shown. The document stays on screen and
        can be read, but no longer edited.
      </p>
    </Dialog>
  );
}
