import type { Metadata } from 'next';
import { PublicPageLayout } from '@/components/legal/PublicPageLayout';
import { RefundPolicyContent } from '@/components/legal/RefundPolicyContent';
import { pageMetadata } from '@/site/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Refund & Cancellation Policy',
  description:
    'When a MockSathi purchase can be refunded, when it cannot, how to request a refund within 7 days, refund timelines of 7-14 working days, and how to cancel subscription auto-renewal.',
  path: '/legal/refund-policy',
});

export default function RefundPolicyPage() {
  return (
    <PublicPageLayout title="Refund & Cancellation Policy" lastUpdated="10-09-2026">
      <RefundPolicyContent />
    </PublicPageLayout>
  );
}
