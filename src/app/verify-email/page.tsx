import { redirect } from 'next/navigation';
import { requireUser } from '@/auth/cookies';
import { VerifyEmailForm } from '@/components/auth/VerifyEmailForm';
import { pageMetadata } from '@/site/seo';
import type { Metadata } from 'next';

export const metadata: Metadata = pageMetadata({
  title: 'Verify Your Email',
  description:
    'Enter the verification code sent to your email address to finish setting up your MockSathi account.',
  path: '/verify-email',
  // A step inside signup, not content. Indexing it would put a code box in
  // front of someone who searched for a mock test.
  index: false,
});

/**
 * Where an unverified account is sent.
 *
 * `requireUser`, not `requireVerifiedUser` — gating this page on verification
 * would redirect it to itself.
 */
export default async function VerifyEmailPage() {
  const user = await requireUser();
  if (user.emailVerifiedAt) redirect('/dashboard');

  return <VerifyEmailForm email={user.email} />;
}
