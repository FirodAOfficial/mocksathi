import type { Metadata } from 'next';
import { SignupForm } from '@/components/auth/SignupForm';

export const metadata: Metadata = {
  title: 'Create account — Mocksathi',
};

export default function SignupPage() {
  return <SignupForm />;
}
