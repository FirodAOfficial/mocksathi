/**
 * Maps the `?error=` code `GET /api/auth/google/callback` redirects back
 * with to what the login/signup card shows. Plain data, not `server-only` —
 * both `LoginForm` and `SignupForm` read it client-side from `searchParams`.
 */
const MESSAGES: Record<string, string> = {
  google_state_mismatch: 'That sign-in attempt expired or was cancelled. Please try again.',
  google_exchange_failed: 'Google sign-in failed. Please try again.',
  google_profile_failed: 'Could not read your Google account details. Please try again.',
  google_email_unverified: 'Your Google account email is not verified, so it can’t be used to sign in.',
};

export function googleErrorMessage(code: string | undefined): string | null {
  if (!code) return null;
  return MESSAGES[code] ?? 'Google sign-in failed. Please try again.';
}
