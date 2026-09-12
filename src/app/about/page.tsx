import type { Metadata } from 'next';
import { AboutContent } from '@/components/legal/AboutContent';
import { PublicPageLayout } from '@/components/legal/PublicPageLayout';
import { pageMetadata } from '@/site/seo';

export const metadata: Metadata = pageMetadata({
  title: 'About Us',
  description:
    'MockSathi builds expert-designed Word and Excel efficiency mock tests for state government recruitment exams in Rajasthan, Jharkhand, Odisha, Punjab and Haryana, with SSC, Banking, RRB NTPC and DSSSB series coming next.',
  path: '/about',
});

export default function AboutPage() {
  return (
    <PublicPageLayout title="About MockSathi">
      <AboutContent />
    </PublicPageLayout>
  );
}
