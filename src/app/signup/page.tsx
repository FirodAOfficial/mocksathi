import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser, signOutIfUnverified } from '@/auth/cookies';
import { SignupForm } from '@/components/auth/SignupForm';
import { publishedExams } from '@/db/enrollments';
import { pageMetadata } from '@/site/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Create Account',
  description:
    'Create a free MockSathi account and start practising Word and Excel efficiency mock tests for state government recruitment exams.',
  path: '/signup',
  index: false,
});

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (user?.emailVerifiedAt) redirect('/dashboard');
  // Same reasoning as /login — see `signOutIfUnverified`.
  const signedOut = await signOutIfUnverified(user);

  const exams = await publishedExams();
  const params = await searchParams;
  const error = Array.isArray(params.error) ? params.error[0] : params.error;
  // Set by `VerifyEmailForm`'s "Back" — see its own comment — carrying back
  // what was already typed rather than making someone retype it.
  const nameParam = Array.isArray(params.name) ? params.name[0] : params.name;
  const emailParam = Array.isArray(params.email) ? params.email[0] : params.email;

  return (
    <SignupForm
      exams={exams.map((exam) => ({ id: exam.id, name: exam.name, category: exam.category }))}
      googleError={error}
      clearStaleSession={signedOut}
      initialName={nameParam}
      initialEmail={emailParam}
    />
  );
}
