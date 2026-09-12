'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import styles from './DeleteResource.module.css';

/**
 * Deleting something from the admin panel, with the cost shown first.
 *
 * One component for every admin delete, because the dangerous part is the same
 * everywhere: a button that destroys a paper's worth of authored work looks
 * exactly like one that removes an empty draft, and only the person who wrote
 * it knows which they are about to press. So the confirmation *names* what goes
 * — "and its 15 questions" — rather than asking "are you sure?", which is a
 * question nobody has ever read.
 *
 * Not `window.confirm`: it cannot say that much, cannot be styled to look as
 * serious as it is, and on some browsers is suppressed entirely after a few
 * uses — which would turn the guard off exactly for the admin doing this all
 * day.
 */
export interface DeleteResourceProps {
  /** The `DELETE` endpoint, e.g. `/api/admin/tests/<id>`. */
  endpoint: string;
  /** Where to go once it is gone. */
  redirectTo: string;
  /** The resting button, e.g. "Delete test". */
  label: string;
  /** The confirmation's heading — name the thing, not the action. */
  title: string;
  /** What goes with it. Say the number; a count is what makes someone stop. */
  detail: string;
  /**
   * Require typing DELETE first.
   *
   * For a deletion that takes other people's work with it. A single click is
   * right for an empty draft and wrong for a finished paper, and the caller is
   * the one that knows which this is.
   */
  requireTyping?: boolean;
}

export function DeleteResource({
  endpoint,
  redirectTo,
  label,
  title,
  detail,
  requireTyping = false,
}: DeleteResourceProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const armed = !requireTyping || typed.trim().toUpperCase() === 'DELETE';

  async function handleDelete() {
    setError(null);
    setDeleting(true);

    try {
      const response = await fetch(endpoint, { method: 'DELETE' });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { detail?: string } | null;
        setError(body?.detail ?? 'It could not be deleted. Try again.');
        return;
      }

      router.push(redirectTo);
      router.refresh();
    } catch {
      setError('It could not be deleted — check your connection and try again.');
    } finally {
      setDeleting(false);
    }
  }

  if (!confirming) {
    return (
      <button type="button" className={styles.trigger} onClick={() => setConfirming(true)}>
        {label}
      </button>
    );
  }

  return (
    <div className={styles.panel} role="group" aria-label={title}>
      <p className={styles.title}>{title}</p>
      <p className={styles.detail}>{detail}</p>

      {requireTyping && (
        <label className={styles.field}>
          <span className={styles.label}>
            Type <b>DELETE</b> to confirm
          </span>
          <input
            className={styles.input}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            autoComplete="off"
            aria-label="Type DELETE to confirm"
          />
        </label>
      )}

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <div className={styles.actions}>
        <button type="button" className={styles.confirm} onClick={handleDelete} disabled={!armed || deleting}>
          {deleting ? 'Deleting…' : 'Delete permanently'}
        </button>
        <button
          type="button"
          className={styles.cancel}
          onClick={() => {
            setConfirming(false);
            setTyped('');
            setError(null);
          }}
          disabled={deleting}
        >
          Keep it
        </button>
      </div>
    </div>
  );
}
