import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser, signOutIfUnverified } from '@/auth/cookies';
import { LoginForm } from '@/components/auth/LoginForm';
import { pageMetadata } from '@/site/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Sign In',
  description:
    'Sign in to MockSathi to take Word and Excel efficiency mock tests, review your solutions, and track your progress.',
  path: '/login',
  // A login form is a doorway, not content: indexing it puts a password field
  // in front of someone who searched for a mock test.
  index: false,
});

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (user?.emailVerifiedAt) redirect('/dashboard');
  // An unverified session landing here — the browser's Back button from
  // /verify-email, a stale tab, a bookmark — gets signed out rather than
  // bounced back into the /dashboard -> /verify-email loop. See
  // `signOutIfUnverified`'s own comment.
  const signedOut = await signOutIfUnverified(user);

  const params = await searchParams;
  const error = Array.isArray(params.error) ? params.error[0] : params.error;
  // Set by `ForgotPasswordForm`'s "Back to login" — carrying the email
  // already typed there back rather than making someone retype it.
  const emailParam = Array.isArray(params.email) ? params.email[0] : params.email;

  return <LoginForm googleError={error} clearStaleSession={signedOut} initialEmail={emailParam} />;
}
