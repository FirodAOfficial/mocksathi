import type { Metadata } from 'next';
import { PublicPageLayout } from '@/components/legal/PublicPageLayout';
import { TermsContent } from '@/components/legal/TermsContent';

export const metadata: Metadata = { title: 'Terms and Conditions · Mocksathi' };

export default function TermsPage() {
  return (
    <PublicPageLayout title="Terms and Conditions" lastUpdated="10-09-2026">
      <TermsContent />
    </PublicPageLayout>
  );
}
