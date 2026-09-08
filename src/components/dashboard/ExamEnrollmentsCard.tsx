'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import styles from './ExamEnrollmentsCard.module.css';

export interface RegisteredExam {
  examId: string;
  examName: string;
  category: string | null;
  isPrimary: boolean;
}

export interface SelectableExam {
  id: string;
  name: string;
  category: string | null;
}

export interface ExamEnrollmentsCardProps {
  enrollments: RegisteredExam[];
  availableExams: SelectableExam[];
}

/**
 * "My exams" — register for, set primary among, and unregister from exams.
 * Reads straight from props (no local copy of the list): every mutation
 * calls the API then `router.refresh()`, which re-runs the server component
 * that fetched these props. Keeping a client-side copy in `useState` would
 * go stale on refresh, since new props don't reset existing state.
 */
export function ExamEnrollmentsCard({ enrollments, availableExams }: ExamEnrollmentsCardProps) {
  const router = useRouter();
  const [selectedExamId, setSelectedExamId] = useState(availableExams[0]?.id ?? '');
  const [pendingExamId, setPendingExamId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // `availableExams` shrinks after a successful registration (the newly-
  // registered exam drops out of it); fall back rather than keep pointing
  // `selectedExamId` at an option that no longer exists.
  const currentSelection = availableExams.some((exam) => exam.id === selectedExamId)
    ? selectedExamId
    : (availableExams[0]?.id ?? '');

  async function runAction(examId: string, action: () => Promise<Response>) {
    setError(null);
    setPendingExamId(examId);
    try {
      const response = await runAndCheck(action);
      if (!response.ok) {
        setError(response.detail);
        return;
      }
      router.refresh();
    } finally {
      setPendingExamId(null);
    }
  }

  async function runAndCheck(action: () => Promise<Response>): Promise<{ ok: true } | { ok: false; detail: string }> {
    const response = await action();
    if (response.ok) return { ok: true };
    const body = (await response.json().catch(() => null)) as { detail?: string } | null;
    return { ok: false, detail: body?.detail ?? 'Something went wrong. Try again.' };
  }

  function handleRegister() {
    if (!currentSelection) return;
    void runAction(currentSelection, () =>
      fetch('/api/profile/enrollments', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ examId: currentSelection }),
      }),
    );
  }

  function handleSetPrimary(examId: string) {
    void runAction(examId, () => fetch(`/api/profile/enrollments/${examId}`, { method: 'PATCH' }));
  }

  function handleUnregister(examId: string) {
    void runAction(examId, () => fetch(`/api/profile/enrollments/${examId}`, { method: 'DELETE' }));
  }

  return (
    <div className={styles.card}>
      <p className={styles.cardTitle}>My exams</p>
      <p className={styles.cardSubtitle}>The primary one drives the dashboard and the exam picker up top.</p>

      {error && <p className={styles.error}>{error}</p>}

      {enrollments.length === 0 ? (
        <p className={styles.empty}>You haven&apos;t registered for any exam yet.</p>
      ) : (
        <div className={styles.list}>
          {enrollments.map((enrollment) => {
            const pending = pendingExamId === enrollment.examId;
            return (
              <div className={styles.row} key={enrollment.examId}>
                <div className={styles.rowInfo}>
                  <span className={styles.examName}>{enrollment.examName}</span>
                  {enrollment.category && <span className={styles.categoryChip}>{enrollment.category}</span>}
                  {enrollment.isPrimary && <span className={styles.primaryBadge}>Primary</span>}
                </div>
                <div className={styles.rowActions}>
                  {!enrollment.isPrimary && (
                    <button
                      type="button"
                      className={styles.linkButton}
                      onClick={() => handleSetPrimary(enrollment.examId)}
                      disabled={pending}
                    >
                      Set primary
                    </button>
                  )}
                  <button
                    type="button"
                    className={styles.removeButton}
                    onClick={() => handleUnregister(enrollment.examId)}
                    disabled={pending}
                  >
                    {pending ? 'Working…' : 'Remove'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {availableExams.length > 0 ? (
        <div className={styles.addRow}>
          <select
            className={styles.select}
            value={currentSelection}
            onChange={(event) => setSelectedExamId(event.target.value)}
          >
            {availableExams.map((exam) => (
              <option key={exam.id} value={exam.id}>
                {exam.name}
                {exam.category ? ` · ${exam.category}` : ''}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={styles.registerButton}
            onClick={handleRegister}
            disabled={pendingExamId !== null}
          >
            {pendingExamId === currentSelection ? 'Registering…' : 'Register'}
          </button>
        </div>
      ) : (
        <p className={styles.allRegisteredNote}>
          {enrollments.length === 0
            ? 'No exams are open for registration yet.'
            : "You're registered for every published exam."}
        </p>
      )}
    </div>
  );
}
