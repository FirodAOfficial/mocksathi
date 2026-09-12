import type { Metadata } from 'next';
import { AboutContent } from '@/components/legal/AboutContent';
import { PublicPageLayout } from '@/components/legal/PublicPageLayout';

export const metadata: Metadata = { title: 'About Us · Mocksathi' };

export default function AboutPage() {
  return (
    <PublicPageLayout title="About MockSathi">
      <AboutContent />
    </PublicPageLayout>
  );
}
