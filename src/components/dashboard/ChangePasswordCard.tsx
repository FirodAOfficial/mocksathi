'use client';

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { MIN_PASSWORD_LENGTH } from '@/auth/validation';
import profileStyles from './ProfileScreen.module.css';
import styles from './ChangePasswordCard.module.css';

export interface ChangePasswordCardProps {
  /** Whether the account already has a password (false for a Google-only account). */
  hasPassword: boolean;
}

/**
 * Password change, on its own card. The form itself lives behind a button
 * and a modal rather than sitting open on the page — the identity fields
 * above are read-only display, and this is the one security-sensitive
 * mutation on the whole screen, so it stays out of view until asked for
 * rather than inviting a stray keystroke in an always-open password field.
 *
 * `hasPassword` decides whether "current password" is asked for at all: a
 * Google-only account has nothing to prove knowledge of, so submitting here
 * doubles as adding password sign-in to it (`POST /api/profile/password`
 * skips the check the same way). `router.refresh()` on success re-runs the
 * server component that computed `hasPassword`, so a first-time "set a
 * password" submit flips this card into normal "change password" mode
 * without a reload.
 */
export function ChangePasswordCard({ hasPassword }: ChangePasswordCardProps) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const element = dialogRef.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  function openModal() {
    setCurrentPassword('');
    setNewPassword('');
    setError(null);
    setOpen(true);
  }

  function closeModal() {
    setOpen(false);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const response = await fetch('/api/profile/password', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ currentPassword: hasPassword ? currentPassword : undefined, newPassword }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { detail?: string } | null;
        setError(body?.detail ?? 'Could not update your password. Try again.');
        return;
      }

      setOpen(false);
      setCurrentPassword('');
      setNewPassword('');
      setNotice(
        hasPassword
          ? 'Password updated. Other signed-in devices have been signed out.'
          : 'Password set — you can now sign in with email as well as Google.',
      );
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={profileStyles.card}>
      <div className={styles.header}>
        <div>
          <p className={profileStyles.cardTitle}>{hasPassword ? 'Password' : 'Set a password'}</p>
          <p className={styles.hint}>
            {hasPassword
              ? 'Change the password used to sign in with email.'
              : 'Your account currently signs in with Google only. Set a password to also sign in with email.'}
          </p>
        </div>
        <button type="button" className={styles.trigger} onClick={openModal}>
          {hasPassword ? 'Change password' : 'Set password'}
        </button>
      </div>

      {notice && (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      )}

      <dialog
        ref={dialogRef}
        className={styles.dialog}
        aria-labelledby={titleId}
        onCancel={(event) => {
          event.preventDefault();
          closeModal();
        }}
        onClick={(event) => {
          if (event.target === dialogRef.current) closeModal();
        }}
      >
        <div className={styles.dialogHeader}>
          <h2 id={titleId} className={styles.dialogTitle}>
            {hasPassword ? 'Change password' : 'Set a password'}
          </h2>
          <button type="button" className={styles.close} onClick={closeModal} aria-label="Close">
            ✕
          </button>
        </div>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          {hasPassword && (
            <div className={styles.field}>
              <label className={styles.label} htmlFor="current-password">
                Current password
              </label>
              <input
                id="current-password"
                type="password"
                autoComplete="current-password"
                required
                className={styles.input}
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
            </div>
          )}

          <div className={styles.field}>
            <label className={styles.label} htmlFor="new-password">
              New password
            </label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              className={styles.input}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </div>

          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            className={styles.submit}
            disabled={
              submitting || newPassword.length < MIN_PASSWORD_LENGTH || (hasPassword && currentPassword.length === 0)
            }
          >
            {submitting ? 'Saving…' : hasPassword ? 'Update password' : 'Set password'}
          </button>
        </form>
      </dialog>
    </div>
  );
}
