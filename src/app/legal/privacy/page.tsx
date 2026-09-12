import type { Metadata } from 'next';
import { PublicPageLayout } from '@/components/legal/PublicPageLayout';
import { PrivacyContent } from '@/components/legal/PrivacyContent';
import { pageMetadata } from '@/site/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Privacy Policy',
  description:
    'How MockSathi collects, uses, stores and protects your information - account details, test performance data, cookies, payment handling, and your rights over your data.',
  path: '/legal/privacy',
});

export default function PrivacyPage() {
  return (
    <PublicPageLayout title="Privacy Policy" lastUpdated="10-09-2026">
      <PrivacyContent />
    </PublicPageLayout>
  );
}
