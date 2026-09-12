import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/auth/cookies';
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

export default async function SignupPage() {
  const user = await getCurrentUser();
  if (user) redirect('/dashboard');

  const exams = await publishedExams();

  return <SignupForm exams={exams.map((exam) => ({ id: exam.id, name: exam.name, category: exam.category }))} />;
}
