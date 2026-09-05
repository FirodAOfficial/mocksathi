'use client';

import { useMemo, useState } from 'react';
import { allQuestions, findQuestion } from '@/exam/types';
import { answeredSet, selectIsLocked, useExamStore } from '@/state/examStore';
import { SubmitDialog } from './SubmitDialog';
import styles from './QuestionActions.module.css';

export interface QuestionActionsProps {
  /** Restores the open question's document to its starting text. */
  onClearAnswer: () => void;
  /** Stores what is currently typed, so it is not lost on submit. */
  onSaveAnswer: () => void;
}

/**
 * The controls at the foot of the summary panel.
 *
 * They act on the question that is currently open, which is why they live
 * beside the palette rather than in the ribbon: the ribbon formats text, these
 * record what the candidate did with a question.
 */
export function QuestionActions({ onClearAnswer, onSaveAnswer }: QuestionActionsProps) {
  const attempt = useExamStore((state) => state.attempt);
  const answers = useExamStore((state) => state.answers);
  const selectedNumber = useExamStore((state) => state.selectedNumber);
  const toggleMarkedForReview = useExamStore((state) => state.toggleMarkedForReview);
  const stepQuestion = useExamStore((state) => state.stepQuestion);
  const submit = useExamStore((state) => state.submit);
  const locked = useExamStore(selectIsLocked);

  const answered = useMemo(() => answeredSet(answers), [answers]);

  const [confirming, setConfirming] = useState(false);

  const questions = allQuestions(attempt);
  const current = findQuestion(attempt, selectedNumber);
  const index = questions.findIndex((question) => question.number === selectedNumber);

  const atStart = index <= 0;
  const atEnd = index >= questions.length - 1;

  /** Navigation stays available after submitting so the paper can be read back. */
  const lockedReason = locked ? 'the paper is closed' : undefined;

  return (
    <div className={styles.actions}>
      {/*
        There are no Attempted / Not Attempted buttons: a question counts as
        attempted exactly when its document has been edited, so a button could
        only ever contradict what is actually typed.
      */}
      <p className={styles.state}>
        This question is{' '}
        <strong>{answered.has(selectedNumber) ? 'attempted' : 'not attempted'}</strong>.
      </p>

      <div className={styles.grid}>
        <button
          type="button"
          className={`${styles.action} ${current?.bookmarked ? styles.actionMarked : ''}`}
          aria-pressed={current?.bookmarked ?? false}
          disabled={locked}
          title={lockedReason ? `Mark for Review — ${lockedReason}` : 'Flag this question to come back to'}
          onClick={() => toggleMarkedForReview(selectedNumber)}
        >
          Mark for Review
        </button>

        <button
          type="button"
          className={styles.action}
          disabled={locked || !answered.has(selectedNumber)}
          title={
            lockedReason
              ? `Clear — ${lockedReason}`
              : answered.has(selectedNumber)
                ? 'Discard this question’s text; it becomes not attempted again'
                : 'Clear — nothing has been typed for this question'
          }
          onClick={onClearAnswer}
        >
          Clear
        </button>
      </div>

      <div className={styles.grid}>
        <button
          type="button"
          className={styles.nav}
          disabled={atStart}
          title={atStart ? 'Previous — this is the first question' : 'Previous question'}
          onClick={() => stepQuestion(-1)}
        >
          ‹ Previous
        </button>
        <button
          type="button"
          className={styles.nav}
          disabled={atEnd}
          title={atEnd ? 'Next — this is the last question' : 'Next question'}
          onClick={() => stepQuestion(1)}
        >
          Next ›
        </button>
      </div>

      <button
        type="button"
        className={styles.submit}
        disabled={locked}
        title={locked ? 'The paper has already been closed' : 'Submit the paper'}
        onClick={() => {
          // Store what is currently typed so the confirmation counts it.
          onSaveAnswer();
          setConfirming(true);
        }}
      >
        {locked ? 'Submitted' : 'Submit'}
      </button>

      {confirming ? (
        <SubmitDialog
          attempt={attempt}
          answered={answered}
          onClose={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false);
            submit('candidate');
          }}
        />
      ) : null}
    </div>
  );
}
