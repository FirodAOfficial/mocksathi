import type { Metadata } from 'next';
import { PublicPageLayout } from '@/components/legal/PublicPageLayout';
import { TermsContent } from '@/components/legal/TermsContent';
import { pageMetadata } from '@/site/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Terms and Conditions',
  description:
    'The terms governing your use of MockSathi — accounts, paid plans and subscriptions, payments, coupons, permitted use of test content, and the limits of our liability.',
  path: '/legal/terms',
});

export default function TermsPage() {
  return (
    <PublicPageLayout title="Terms and Conditions" lastUpdated="10-09-2026">
      <TermsContent />
    </PublicPageLayout>
  );
}
