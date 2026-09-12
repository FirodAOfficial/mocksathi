'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { OTP_LENGTH } from '@/auth/otpPolicy';
import { SiteFooterCompact } from '@/components/site/SiteFooter';
import { inter } from './authFont';
import cardStyles from './AuthCard.module.css';
import styles from './VerifyEmailForm.module.css';
import loginStyles from './LoginScreen.module.css';
import { MarketingPanel } from './MarketingPanel';

/**
 * The code-entry step, laid out as the sign-in screen is so arriving here does
 * not feel like leaving the product.
 *
 * The first code is sent by `POST /api/auth/signup`, so this page asks for
 * nothing on mount — a second automatic request would burn one of the five the
 * rate limit allows before the candidate has typed anything.
 */
export function VerifyEmailForm({ email }: { email: string }) {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  /** Ticks the resend cooldown down so the button says when it will work. */
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((left) => left - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setSubmitting(true);

    try {
      const response = await fetch('/api/auth/verify-email/confirm', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { detail?: string } | null;
        setError(body?.detail ?? 'Could not check that code. Try again.');
        return;
      }

      router.push('/dashboard');
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    setError(null);
    setNotice(null);

    const response = await fetch('/api/auth/verify-email/request', { method: 'POST' });
    const body = (await response.json().catch(() => null)) as
      | { detail?: string; retryAfterSeconds?: number }
      | null;

    if (response.ok) {
      setNotice('A new code is on its way. The previous one no longer works.');
      setCooldown(60);
      setCode('');
      return;
    }

    if (body?.retryAfterSeconds) setCooldown(body.retryAfterSeconds);
    setError(body?.detail ?? 'Could not send a new code. Try again in a moment.');
  }

  return (
    <div className={`${loginStyles.split} ${inter.className}`}>
      <MarketingPanel />

      <div className={loginStyles.formSide}>
        <div className={loginStyles.centerColumn}>
          <div className={cardStyles.card}>
            <div className={cardStyles.logoRow}>
              <div className={cardStyles.logoMark}>M</div>
              <div>
                <div className={cardStyles.logoName}>Mocksathi</div>
              </div>
            </div>

            <h1 className={cardStyles.title}>Verify your email</h1>
            <p className={cardStyles.subtitle}>
              We sent a {OTP_LENGTH}-digit code to <strong>{email}</strong>. Enter it below to
              finish setting up your account.
            </p>

            <form className={cardStyles.form} onSubmit={handleSubmit} noValidate>
              <div className={cardStyles.field}>
                <label className={cardStyles.label} htmlFor="verification-code">
                  Verification code
                </label>
                <input
                  id="verification-code"
                  className={styles.codeInput}
                value={code}
                /*
                 * `one-time-code` is what lets iOS and Android offer the code
                 * from the notification, so it never has to be retyped.
                 */
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  // The pattern is advisory; the server re-checks the shape.
                  pattern={`\\d{${OTP_LENGTH}}`}
                  maxLength={OTP_LENGTH}
                  autoFocus
                  required
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
                />
              </div>

              {error ? (
                <p className={cardStyles.error} role="alert">
                  {error}
                </p>
              ) : null}
              {notice ? (
                <p className={styles.notice} role="status">
                  {notice}
                </p>
              ) : null}

              <button
                type="submit"
                className={cardStyles.primary}
                disabled={submitting || code.length !== OTP_LENGTH}
              >
                {submitting ? 'Checking…' : 'Verify email'}
              </button>
            </form>

            <p className={cardStyles.footer}>
              Didn&rsquo;t get it?{' '}
              <button type="button" className={styles.resend} disabled={cooldown > 0} onClick={handleResend}>
                {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
              </button>
            </p>
          </div>

          <SiteFooterCompact />
        </div>
      </div>
    </div>
  );
}
