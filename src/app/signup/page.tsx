import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/auth/cookies';
import { SignupForm } from '@/components/auth/SignupForm';
import { publishedExams } from '@/db/enrollments';

export const metadata: Metadata = {
  title: 'Create account — Mocksathi',
};

export default async function SignupPage() {
  const user = await getCurrentUser();
  if (user) redirect('/dashboard');

  const exams = await publishedExams();

  return <SignupForm exams={exams.map((exam) => ({ id: exam.id, name: exam.name, category: exam.category }))} />;
}
