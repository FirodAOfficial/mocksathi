'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { MIN_PASSWORD_LENGTH } from '@/auth/validation';
import profileStyles from './ProfileScreen.module.css';
import styles from './ChangePasswordCard.module.css';

export interface ChangePasswordCardProps {
  /** Whether the account already has a password (false for a Google-only account). */
  hasPassword: boolean;
}

/**
 * Password change, on its own card rather than folded into the Account card
 * above it — the identity fields there are read-only display, this is the
 * one mutable, security-sensitive form on the page and reads more clearly
 * kept apart.
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
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
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
      <p className={profileStyles.cardTitle}>{hasPassword ? 'Change password' : 'Set a password'}</p>
      {!hasPassword && (
        <p className={styles.hint}>
          Your account currently signs in with Google only. Set a password to also sign in with email.
        </p>
      )}

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
        {notice && (
          <p className={styles.notice} role="status">
            {notice}
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
    </div>
  );
}
