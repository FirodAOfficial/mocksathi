import styles from './AuthCard.module.css';

export interface GoogleButtonProps {
  /** Signup requires the Terms/Privacy checkbox before *any* account gets created, Google included — this renders an inert button instead of a navigable link until that's checked. Login has no such gate, so it's omitted there. */
  disabled?: boolean;
}

const GOOGLE_LOGO = (
  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
    <path
      fill="#4285F4"
      d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62z"
    />
    <path
      fill="#34A853"
      d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.81.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.33A9 9 0 0 0 9 18z"
    />
    <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.03z" />
    <path
      fill="#EA4335"
      d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.97L3.95 7.3C4.66 5.17 6.65 3.58 9 3.58z"
    />
  </svg>
);

/**
 * A plain navigation to `GET /api/auth/google`, not a fetch — the whole point
 * is a full-page redirect to Google's consent screen, so the enabled state is
 * an `<a>`, not a button with an `onClick` handler.
 */
export function GoogleButton({ disabled = false }: GoogleButtonProps) {
  if (disabled) {
    return (
      <button type="button" className={styles.googleButton} disabled title="Agree to the Terms and Privacy Policy first">
        {GOOGLE_LOGO}
        Continue with Google
      </button>
    );
  }

  return (
    <a href="/api/auth/google" className={styles.googleButton}>
      {GOOGLE_LOGO}
      Continue with Google
    </a>
  );
}
