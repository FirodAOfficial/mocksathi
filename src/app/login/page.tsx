import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/auth/cookies';
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
  if (user) redirect('/dashboard');

  const params = await searchParams;
  const error = Array.isArray(params.error) ? params.error[0] : params.error;

  return <LoginForm googleError={error} />;
}
