'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { OTP_LENGTH } from '@/auth/otpPolicy';
import { MIN_PASSWORD_LENGTH } from '@/auth/validation';
import { DashboardIcon } from '@/components/dashboard/icons/DashboardIcon';
import { SiteFooterCompact } from '@/components/site/SiteFooter';
import cardStyles from './AuthCard.module.css';
import { inter } from './authFont';
import loginStyles from './LoginScreen.module.css';
import { MarketingPanel } from './MarketingPanel';
import verifyStyles from './VerifyEmailForm.module.css';

type Step = 'request' | 'reset';

/**
 * Forgot/reset password, as one two-step form rather than two routes.
 *
 * The email typed in step one is kept in local state and carried straight
 * into step two's request body — not round-tripped through a URL query
 * param, which would leave it sitting in browser history and any referrer
 * header the page's own assets triggered.
 *
 * Step one always reports success, whatever actually happened server-side
 * (`POST /api/auth/forgot-password` is deliberately silent about whether the
 * address has an account — see that route's own comment). This form mirrors
 * that: it moves to step two unconditionally, the same way a real inbox
 * check would leave someone not knowing whether to expect an email either.
 */
export function ForgotPasswordForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((left) => left - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function requestCode(targetEmail: string) {
    await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: targetEmail }),
    }).catch(() => null);
  }

  async function handleRequestSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await requestCode(email);
      setStep('reset');
      setCooldown(60);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    setError(null);
    setNotice(null);
    setCode('');
    await requestCode(email);
    setNotice('If that account exists, a new code is on its way.');
    setCooldown(60);
  }

  async function handleResetSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setSubmitting(true);

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, code, newPassword }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { detail?: string } | null;
        setError(body?.detail ?? 'Could not reset your password. Try again.');
        setSubmitting(false);
        return;
      }

      // Same "prove it, then land them in" shape as signup/login: a
      // successful reset already signed a fresh session in.
      router.push('/dashboard');
      router.refresh();
    } catch {
      setError('Something went wrong. Try again.');
      setSubmitting(false);
    }
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

            {step === 'request' ? (
              <>
                <h1 className={cardStyles.title}>Forgot your password?</h1>
                <p className={cardStyles.subtitle}>
                  Enter the email on your account and we&rsquo;ll send you a code to reset it.
                </p>

                <form className={cardStyles.form} onSubmit={handleRequestSubmit} noValidate>
                  <div className={cardStyles.field}>
                    <label className={cardStyles.label} htmlFor="email">
                      Email
                    </label>
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      required
                      autoFocus
                      className={cardStyles.input}
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                    />
                  </div>

                  <button type="submit" className={cardStyles.primary} disabled={submitting}>
                    {submitting ? 'Sending…' : 'Send reset code'}
                  </button>
                </form>
              </>
            ) : (
              <>
                <h1 className={cardStyles.title}>Reset your password</h1>
                <p className={cardStyles.subtitle}>
                  If an account exists for <strong>{email}</strong>, we&rsquo;ve sent a {OTP_LENGTH}-digit code.
                  Enter it below with your new password.
                </p>

                <form className={cardStyles.form} onSubmit={handleResetSubmit} noValidate>
                  <div className={cardStyles.field}>
                    <label className={cardStyles.label} htmlFor="reset-code">
                      Verification code
                    </label>
                    <input
                      id="reset-code"
                      className={verifyStyles.codeInput}
                      value={code}
                      autoComplete="one-time-code"
                      inputMode="numeric"
                      pattern={`\\d{${OTP_LENGTH}}`}
                      maxLength={OTP_LENGTH}
                      autoFocus
                      required
                      onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
                    />
                  </div>

                  <div className={cardStyles.field}>
                    <label className={cardStyles.label} htmlFor="new-password">
                      New password
                    </label>
                    <input
                      id="new-password"
                      type="password"
                      autoComplete="new-password"
                      required
                      minLength={MIN_PASSWORD_LENGTH}
                      className={cardStyles.input}
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                    />
                  </div>

                  {error && (
                    <p className={cardStyles.error} role="alert">
                      {error}
                    </p>
                  )}
                  {notice && (
                    <p className={verifyStyles.notice} role="status">
                      {notice}
                    </p>
                  )}

                  <button
                    type="submit"
                    className={cardStyles.primary}
                    disabled={submitting || code.length !== OTP_LENGTH || newPassword.length < MIN_PASSWORD_LENGTH}
                  >
                    {submitting ? 'Resetting…' : 'Reset password'}
                  </button>
                </form>

                <p className={cardStyles.footer}>
                  Didn&rsquo;t get it?{' '}
                  <button
                    type="button"
                    className={verifyStyles.resend}
                    disabled={cooldown > 0}
                    onClick={handleResend}
                  >
                    {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
                  </button>
                </p>
                <p className={cardStyles.footer}>
                  <button
                    type="button"
                    className={verifyStyles.resend}
                    onClick={() => {
                      setStep('request');
                      setCode('');
                      setNewPassword('');
                      setError(null);
                      setNotice(null);
                    }}
                  >
                    Use a different email
                  </button>
                </p>
              </>
            )}

            <div className={cardStyles.trustNote}>
              <DashboardIcon name="shield" size={16} />
              <span>
                <b>Your data is safe with us.</b> We don&apos;t share your information with third parties.
              </span>
            </div>
          </div>

          <SiteFooterCompact />
        </div>
      </div>
    </div>
  );
}
