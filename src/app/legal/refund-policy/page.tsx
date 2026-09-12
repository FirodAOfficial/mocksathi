import type { Metadata } from 'next';
import { PublicPageLayout } from '@/components/legal/PublicPageLayout';
import { RefundPolicyContent } from '@/components/legal/RefundPolicyContent';

export const metadata: Metadata = { title: 'Refund & Cancellation Policy · Mocksathi' };

export default function RefundPolicyPage() {
  return (
    <PublicPageLayout title="Refund & Cancellation Policy" lastUpdated="10-09-2026">
      <RefundPolicyContent />
    </PublicPageLayout>
  );
}
