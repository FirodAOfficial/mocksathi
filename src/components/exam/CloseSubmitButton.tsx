'use client';

import { useMemo, useState } from 'react';
import { answeredSet, selectIsLocked, useExamStore } from '@/state/examStore';
import { SubmitDialog } from './SubmitDialog';
import styles from './CloseSubmitButton.module.css';

export interface CloseSubmitButtonProps {
  /** The shell's own window-button skin, so each editor keeps its chrome. */
  className?: string;
  /** Stores what is currently typed, so the confirmation counts it. */
  onSaveAnswer: () => void;
}

/**
 * The window close button, as the paper's submit control.
 *
 * In a real Word or Excel window the ✕ closes the document, and closing a paper
 * is submitting it — so during an exam it does that, through the same
 * confirmation the Submit button in the summary panel opens. Outside an exam
 * the shells keep a decorative ✕ instead: there is nothing to submit, and a
 * close button on a web page would be a lie.
 *
 * It is the same `SubmitDialog` and the same store action as `QuestionActions`,
 * deliberately: two ways to submit a paper must not be able to submit it two
 * different ways.
 */
export function CloseSubmitButton({ className, onSaveAnswer }: CloseSubmitButtonProps) {
  const attempt = useExamStore((state) => state.attempt);
  const answers = useExamStore((state) => state.answers);
  const submit = useExamStore((state) => state.submit);
  const locked = useExamStore(selectIsLocked);

  const answered = useMemo(() => answeredSet(answers), [answers]);
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <button
        type="button"
        className={`${styles.close} ${className ?? ''}`}
        disabled={locked}
        /* The glyph is a symbol, not a label: assistive technology is told what
           the control does, not what it looks like. */
        aria-label={locked ? 'Paper submitted' : 'Submit paper'}
        title={locked ? 'The paper has already been closed' : 'Submit the paper'}
        onClick={() => {
          onSaveAnswer();
          setConfirming(true);
        }}
      >
        <span aria-hidden="true">✕</span>
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
    </>
  );
}
