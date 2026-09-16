'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import profileStyles from './ProfileScreen.module.css';
import styles from './EditableName.module.css';

export interface EditableNameProps {
  name: string;
}

/**
 * The Account card's name, editable in place — a text "Edit" affordance
 * rather than an icon (there's no pencil glyph in `DashboardIcon` yet, and
 * one felt like more than this single field earns). `router.refresh()` on
 * success re-runs the server component, the same reason `AvatarUpload` does:
 * the name also shows in `PortalShell`'s topbar chip, fed by that same
 * server-rendered layout, not this component.
 */
export function EditableName({ name }: EditableNameProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEditing() {
    setValue(name);
    setError(null);
    setEditing(true);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || trimmed === name) {
      setEditing(false);
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const response = await fetch('/api/profile/name', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { detail?: string } | null;
        setError(body?.detail ?? 'Could not update your name. Try again.');
        return;
      }

      setEditing(false);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  if (!editing) {
    return (
      <div className={styles.viewRow}>
        <p className={profileStyles.name}>{name}</p>
        <button type="button" className={styles.editLink} onClick={startEditing}>
          Edit
        </button>
      </div>
    );
  }

  return (
    <form className={styles.editRow} onSubmit={handleSubmit}>
      <input
        className={styles.input}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        autoFocus
        required
        disabled={submitting}
      />
      <button type="submit" className={styles.editLink} disabled={submitting}>
        {submitting ? 'Saving…' : 'Save'}
      </button>
      <button
        type="button"
        className={styles.editLinkMuted}
        disabled={submitting}
        onClick={() => {
          setEditing(false);
          setError(null);
        }}
      >
        Cancel
      </button>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
