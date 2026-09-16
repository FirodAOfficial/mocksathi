'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { OTP_LENGTH, OTP_MAX_ATTEMPTS, OTP_TTL_MS } from '@/auth/otpPolicy';
import { SiteFooterCompact } from '@/components/site/SiteFooter';
import { inter } from './authFont';
import cardStyles from './AuthCard.module.css';
import styles from './VerifyEmailForm.module.css';
import loginStyles from './LoginScreen.module.css';
import { MarketingPanel } from './MarketingPanel';

export interface VerifyEmailFormProps {
  name: string;
  email: string;
  /**
   * ISO timestamp the active code expires at, or `null` if there isn't one
   * (never issued yet, or already spent by a wrong-guess exhaustion / failed
   * send) — in which case no countdown shows and nothing forces a redirect;
   * "Resend code" is the way forward from there, same as before this existed.
   */
  codeExpiresAt: string | null;
  /**
   * Guesses left on the active code, straight from its `attempts` column —
   * `null` in the same cases `codeExpiresAt` is. Seeded from the server on
   * every load, not just the first: the limit itself was always enforced in
   * the database (a wrong guess is written before anything is returned to
   * the caller), but without this, a reload would show a fresh-looking form
   * for a code that actually has one or zero guesses left on it.
   */
  initialAttemptsRemaining: number | null;
}

/** `623000` -> `"10:23"`. Ceilinged, not floored, so the display never reads "0:00" a full second before the deadline actually lands. */
function formatCountdown(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * The code-entry step, laid out as the sign-in screen is so arriving here does
 * not feel like leaving the product.
 *
 * The first code is sent by `POST /api/auth/signup`, so this page asks for
 * nothing on mount — a second automatic request would burn one of the five the
 * rate limit allows before the candidate has typed anything.
 *
 * A visible countdown tracks the *server's* deadline (`codeExpiresAt`), not a
 * client-only timer — so it's accurate however long ago the code was actually
 * issued, and a resend (which gets a fresh ten minutes) restarts it correctly.
 * Letting it run out, or tapping "Back", both sign the session out and
 * return to `/signup` — not `/login`: this page only exists mid-signup, so
 * "back" means back to that form, carrying `name`/`email` with it
 * (`?name=&email=`) so nothing already typed has to be retyped. The account
 * itself isn't lost either way — a fresh signup submit with the same email
 * reclaims the same unverified row (`POST /api/auth/signup`'s own resume
 * logic) rather than colliding with it.
 */
export function VerifyEmailForm({ name, email, codeExpiresAt, initialAttemptsRemaining }: VerifyEmailFormProps) {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(initialAttemptsRemaining);
  /** The fifth wrong guess consumes the code server-side — no sixth try is worth letting through, only Resend. */
  const [exhausted, setExhausted] = useState(false);
  const [expiresAt, setExpiresAt] = useState<number | null>(
    codeExpiresAt ? new Date(codeExpiresAt).getTime() : null,
  );
  const [now, setNow] = useState(() => Date.now());
  const abandonedRef = useRef(false);

  /** Ticks the resend cooldown down so the button says when it will work. */
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((left) => left - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  // Ticks the code countdown, only while there's a deadline to count down to.
  useEffect(() => {
    if (expiresAt === null) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  const remainingMs = expiresAt !== null ? expiresAt - now : null;
  const expired = remainingMs !== null && remainingMs <= 0;

  async function abandon() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      const query = new URLSearchParams({ name, email }).toString();
      router.push(`/signup?${query}`);
      router.refresh();
    }
  }

  // Fires once, the moment the countdown actually reaches zero. A ref guard
  // rather than a state flag — this is triggering a real side effect (log
  // out, navigate), not deriving render state, so it belongs in an effect,
  // and a ref avoids re-running it if `expired` flips again before the
  // navigation actually leaves this page.
  useEffect(() => {
    if (!expired || abandonedRef.current) return;
    abandonedRef.current = true;
    void abandon();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `abandon` closes over nothing that changes between renders in a way that matters here.
  }, [expired]);

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
        const body = (await response.json().catch(() => null)) as
          | { code?: string; detail?: string; attemptsRemaining?: number }
          | null;
        setError(body?.detail ?? 'Could not check that code. Try again.');

        if (body?.code === 'TOO_MANY_ATTEMPTS') {
          setExhausted(true);
          setCode('');
        } else if (typeof body?.attemptsRemaining === 'number') {
          setAttemptsRemaining(body.attemptsRemaining);
        }
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
      // A fresh code from here gets the same `OTP_TTL_MS` window the first
      // one did — matches what `issueVerificationCode` actually just wrote,
      // without a round trip back to the server to ask for it.
      setExpiresAt(Date.now() + OTP_TTL_MS);
      // A fresh code also gets a fresh five attempts.
      setExhausted(false);
      setAttemptsRemaining(null);
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

            <button type="button" className={styles.backLink} onClick={() => void abandon()}>
              ← Back
            </button>

            <h1 className={cardStyles.title}>Verify your email</h1>
            <p className={cardStyles.subtitle}>
              We sent a {OTP_LENGTH}-digit code to <strong>{email}</strong>. Enter it below to
              finish setting up your account.
            </p>

            {remainingMs !== null && (
              <p className={expired ? styles.countdownExpired : styles.countdown}>
                {expired
                  ? 'This code has expired — taking you back…'
                  : `Code expires in ${formatCountdown(remainingMs)}`}
              </p>
            )}

            {!exhausted && attemptsRemaining !== null && attemptsRemaining < OTP_MAX_ATTEMPTS && (
              <p className={styles.countdown}>
                {attemptsRemaining === 1
                  ? '1 attempt left before you need a new code.'
                  : `${attemptsRemaining} attempts left before you need a new code.`}
              </p>
            )}

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
                  disabled={expired || exhausted}
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
                disabled={submitting || expired || exhausted || code.length !== OTP_LENGTH}
              >
                {submitting ? 'Checking…' : 'Verify email'}
              </button>
            </form>

            <p className={cardStyles.footer}>
              {exhausted ? 'Out of attempts. ' : "Didn't get it? "}
              <button
                type="button"
                className={styles.resend}
                disabled={cooldown > 0 || expired}
                onClick={handleResend}
              >
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
