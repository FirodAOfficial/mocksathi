import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/auth/cookies';
import { SignupForm } from '@/components/auth/SignupForm';
import { publishedExams } from '@/db/enrollments';

export const metadata: Metadata = {
  title: 'Create account — Mocksathi',
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (user) redirect('/dashboard');

  const exams = await publishedExams();
  const params = await searchParams;
  const error = Array.isArray(params.error) ? params.error[0] : params.error;

  return (
    <SignupForm
      exams={exams.map((exam) => ({ id: exam.id, name: exam.name, category: exam.category }))}
      googleError={error}
    />
  );
}
