import type { Metadata } from 'next';
import Link from 'next/link';
import { Section, SitePage } from '@/components/site/SitePage';
import { pageMetadata } from '@/site/seo';

export const metadata: Metadata = pageMetadata({
  title: 'About Us',
  description:
    'MockSathi builds expert-designed Word and Excel efficiency mock tests for state government recruitment exams in Rajasthan, Jharkhand, Odisha, Punjab and Haryana, with SSC, Banking, RRB NTPC and DSSSB series coming next.',
  path: '/about',
});

export default function AboutPage() {
  return (
    <SitePage
      title="About MockSathi"
      intro={
        <p>
          MockSathi is a mock test platform built for one purpose — helping students excel in
          competitive and government exams through expert-designed practice.
        </p>
      }
    >
      <Section heading="Built by subject-matter experts">
        <p>
          We are not just another mock test website. Every test on MockSathi is created by
          subject-matter experts, ensuring each mock reflects real exam patterns and difficulty
          levels.
        </p>
      </Section>

      <Section heading="What we offer today">
        <p>
          Currently, MockSathi offers Word and Excel efficiency mock tests for typing and computer
          proficiency exams conducted in Rajasthan, Jharkhand, Odisha, Punjab, Haryana, and other
          state government recruitment exams. These tests are designed to help candidates practice
          under real exam conditions and improve both speed and accuracy before the actual test.
        </p>
      </Section>

      <Section heading="What is coming next">
        <p>
          We&rsquo;re continuously expanding. In the coming months, MockSathi will launch dedicated
          mock test series for SSC, Banking, RRB NTPC, DSSSB, and other major state-level government
          exams — giving aspirants a single, reliable platform for all their exam preparation needs.
        </p>
      </Section>

      <Section heading="Our focus">
        <p>
          At MockSathi, our only focus is quality — high-quality mocks built by experts, so students
          can prepare with confidence and perform their best on exam day.
        </p>
        <p>
          Questions about a test, your account, or a purchase? <Link href="/contact">Contact us</Link>
          {' '}— we read everything that comes in.
        </p>
      </Section>
    </SitePage>
  );
}
