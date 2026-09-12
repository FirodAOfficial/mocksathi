'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { DashboardIcon } from '@/components/dashboard/icons/DashboardIcon';
import { SiteFooter } from '@/components/site/SiteFooter';
import cardStyles from './AuthCard.module.css';
import { inter } from './authFont';
import { GoogleButton } from './GoogleButton';
import { googleErrorMessage } from './googleErrorMessage';
import styles from './LoginScreen.module.css';
import { MarketingPanel } from './MarketingPanel';

export interface LoginFormProps {
  /** The `?error=` query param from a failed `/api/auth/google/callback` redirect, if any. */
  googleError?: string;
}

type Status = 'idle' | 'submitting' | 'redirecting';

export function LoginForm({ googleError }: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(googleErrorMessage(googleError));
  const [status, setStatus] = useState<Status>('idle');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setStatus('submitting');

    let response: Response;
    try {
      response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
    } catch {
      setError('Something went wrong. Try again.');
      setStatus('idle');
      return;
    }

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { detail?: string } | null;
      setError(body?.detail ?? 'Something went wrong. Try again.');
      setStatus('idle');
      return;
    }

    // Deliberately never resets to 'idle' on success: `router.push` returns
    // as soon as the navigation *starts*, not once `/dashboard` has actually
    // rendered (it still has its own DB queries to run). Resetting here in a
    // `finally` — the previous shape of this function — re-enabled the
    // button for that whole gap, which read as the click having done
    // nothing right up until the page suddenly swapped in.
    setStatus('redirecting');
    router.push('/dashboard');
    router.refresh();
  }

  return (
    <div className={`${styles.split} ${inter.className}`}>
      <MarketingPanel />

      <div className={styles.formSide}>
        <p className={styles.topTagline}>
          Same exams. <em>Higher chances.</em>
        </p>

        <div className={styles.centerColumn}>
          <div className={cardStyles.card}>
            <div className={cardStyles.logoRow}>
              <div className={cardStyles.logoMark}>M</div>
              <div>
                <div className={cardStyles.logoName}>Mocksathi</div>
              </div>
            </div>

            <h1 className={cardStyles.title}>Welcome back</h1>
            <p className={cardStyles.subtitle}>Sign in to continue your preparation.</p>

            <form className={cardStyles.form} onSubmit={handleSubmit} noValidate>
              <div className={cardStyles.field}>
                <label className={cardStyles.label} htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  className={cardStyles.input}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>

              <div className={cardStyles.field}>
                <label className={cardStyles.label} htmlFor="password">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className={cardStyles.input}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>

              {error && (
                <p className={cardStyles.error} role="alert">
                  {error}
                </p>
              )}

              <button type="submit" className={cardStyles.primary} disabled={status !== 'idle'}>
                {status === 'redirecting' ? 'Redirecting…' : status === 'submitting' ? 'Signing in…' : 'Sign in'}
              </button>
            </form>

            <div className={cardStyles.divider}>or</div>
            <GoogleButton />

            <p className={cardStyles.footer}>
              Don&apos;t have an account? <Link href="/signup">Create one</Link>
            </p>

            <div className={cardStyles.trustNote}>
              <DashboardIcon name="shield" size={16} />
              <span>
                <b>Your data is safe with us.</b> We don&apos;t share your information with third parties.
              </span>
            </div>
          </div>

          <SiteFooter />
        </div>

        <p className={styles.bottomTagline}>
          Taiyari Wahi,
          <br />
          Sahi Saathi ke Saath.
        </p>
      </div>
    </div>
  );
}
