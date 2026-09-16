import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/auth/cookies';
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm';
import { pageMetadata } from '@/site/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Reset Your Password',
  description: 'Request a password reset code for your MockSathi account.',
  path: '/forgot-password',
  // A password-reset form is a doorway, not content — same reasoning as /login.
  index: false,
});

export default async function ForgotPasswordPage() {
  const user = await getCurrentUser();
  if (user) redirect('/dashboard');

  return <ForgotPasswordForm />;
}
