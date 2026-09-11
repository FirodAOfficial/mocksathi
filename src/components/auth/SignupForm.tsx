'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { DashboardIcon } from '@/components/dashboard/icons/DashboardIcon';
import { MIN_PASSWORD_LENGTH } from '@/auth/validation';
import cardStyles from './AuthCard.module.css';
import { inter } from './authFont';
import { GoogleButton } from './GoogleButton';
import { googleErrorMessage } from './googleErrorMessage';
import { LegalLinks } from './LegalLinks';
import styles from './LoginScreen.module.css';
import { MarketingPanel } from './MarketingPanel';

export interface SignupExamOption {
  id: string;
  name: string;
  category: string | null;
}

export interface SignupFormProps {
  /** Published exams to choose from — the field is hidden entirely when none exist yet. */
  exams: SignupExamOption[];
  /** The `?error=` query param from a failed `/api/auth/google/callback` redirect, if any. */
  googleError?: string;
}

export function SignupForm({ exams, googleError }: SignupFormProps) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [examId, setExamId] = useState('');
  const [error, setError] = useState<string | null>(googleErrorMessage(googleError));
  const [submitting, setSubmitting] = useState(false);
  const [agreed, setAgreed] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, email, password, examId: examId || undefined }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { detail?: string } | null;
        setError(body?.detail ?? 'Something went wrong. Try again.');
        return;
      }

      router.push('/dashboard');
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={`${styles.split} ${inter.className}`}>
      <MarketingPanel />

      <div className={styles.formSide}>
        <p className={styles.topTagline}>
          Same exams. <em>Higher chances.</em>
        </p>

        <div className={cardStyles.card}>
          <div className={cardStyles.logoRow}>
            <div className={cardStyles.logoMark}>M</div>
            <div>
              <div className={cardStyles.logoName}>Mocksathi</div>
              <div className={cardStyles.logoBy}>by TypingSathi</div>
            </div>
          </div>

          <h1 className={cardStyles.title}>Create your account</h1>
          <p className={cardStyles.subtitle}>Track your mocks, streaks and analysis in one place.</p>

          <form className={cardStyles.form} onSubmit={handleSubmit} noValidate>
            <div className={cardStyles.field}>
              <label className={cardStyles.label} htmlFor="name">
                Name
              </label>
              <input
                id="name"
                type="text"
                autoComplete="name"
                required
                className={cardStyles.input}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>

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
                autoComplete="new-password"
                required
                minLength={MIN_PASSWORD_LENGTH}
                className={cardStyles.input}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>

            {exams.length > 0 && (
              <div className={cardStyles.field}>
                <label className={cardStyles.label} htmlFor="examId">
                  Target exam <span className={cardStyles.optional}>(optional)</span>
                </label>
                <select
                  id="examId"
                  className={cardStyles.input}
                  value={examId}
                  onChange={(event) => setExamId(event.target.value)}
                >
                  <option value="">Choose later</option>
                  {exams.map((exam) => (
                    <option key={exam.id} value={exam.id}>
                      {exam.name}
                      {exam.category ? ` · ${exam.category}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {error && (
              <p className={cardStyles.error} role="alert">
                {error}
              </p>
            )}

            <LegalLinks agreed={agreed} onAgreedChange={setAgreed} />

            <button type="submit" className={cardStyles.primary} disabled={submitting || !agreed}>
              {submitting ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <div className={cardStyles.divider}>or sign up with</div>
          <GoogleButton disabled={!agreed} />

          <p className={cardStyles.footer}>
            Already have an account? <Link href="/login">Sign in</Link>
          </p>

          <div className={cardStyles.trustNote}>
            <DashboardIcon name="shield" size={16} />
            <span>
              <b>Your data is safe with us.</b> We don&apos;t share your information with third parties.
            </span>
          </div>
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
