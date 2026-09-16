'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import styles from './SelectExamModal.module.css';

export interface SelectExamOption {
  id: string;
  name: string;
  category: string | null;
}

export interface SelectExamModalProps {
  exams: SelectExamOption[];
  onClose: () => void;
}

/**
 * The nudge shown on opening the dashboard when a candidate has no target
 * exam yet — everything else on the portal (the topbar exam picker, the plan
 * widget, the mocks list) reads better once there's one to name. Dismissible
 * rather than blocking: `PortalShell` only decides whether to *mount* this
 * once per session (see its own comment), so closing it without choosing
 * doesn't need to be remembered here — it'll just not reopen until the next
 * full load.
 *
 * The registration itself is the same `POST /api/profile/enrollments`
 * `ExamEnrollmentsCard` uses on the profile page — a first registration is
 * automatically primary (`registerForExam`), which is exactly "set my
 * target exam" from here.
 */
export function SelectExamModal({ exams, onClose }: SelectExamModalProps) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [examId, setExamId] = useState(exams[0]?.id ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const element = dialogRef.current;
    if (element && !element.open) element.showModal();
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!examId) return;

    setError(null);
    setSubmitting(true);
    try {
      const response = await fetch('/api/profile/enrollments', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ examId }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { detail?: string } | null;
        setError(body?.detail ?? 'Could not set your exam. Try again.');
        return;
      }

      onClose();
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
    >
      <div className={styles.header}>
        <h2 id={titleId} className={styles.title}>
          What are you preparing for?
        </h2>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>

      <p className={styles.subtitle}>
        Pick your target exam and your dashboard, mocks, and streak all line up around it.
      </p>

      <form className={styles.form} onSubmit={handleSubmit}>
        <select className={styles.select} value={examId} onChange={(event) => setExamId(event.target.value)} autoFocus>
          {exams.map((exam) => (
            <option key={exam.id} value={exam.id}>
              {exam.name}
              {exam.category ? ` · ${exam.category}` : ''}
            </option>
          ))}
        </select>

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        <div className={styles.actions}>
          <button type="button" className={styles.later} onClick={onClose} disabled={submitting}>
            Maybe later
          </button>
          <button type="submit" className={styles.submit} disabled={submitting || !examId}>
            {submitting ? 'Saving…' : 'Set my exam'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
