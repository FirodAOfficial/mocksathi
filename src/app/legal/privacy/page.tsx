import type { Metadata } from 'next';
import { PublicPageLayout } from '@/components/legal/PublicPageLayout';
import { PrivacyContent } from '@/components/legal/PrivacyContent';

export const metadata: Metadata = { title: 'Privacy Policy · Mocksathi' };

export default function PrivacyPage() {
  return (
    <PublicPageLayout title="Privacy Policy" lastUpdated="10-09-2026">
      <PrivacyContent />
    </PublicPageLayout>
  );
}
