import type { Metadata } from 'next';

/**
 * Shared metadata for every page that search engines and answer engines see.
 *
 * The wording is drawn from the About page rather than invented, so a change to
 * what MockSathi says it does moves through one file instead of being restated
 * — differently — in five `<meta>` tags.
 *
 * The states and exam names matter more than they look. Someone searching
 * "RSSB LDC Excel typing mock test" is the entire audience, and an answer
 * engine summarising the site has nothing else to go on: the pages are policy
 * text, and the product itself sits behind a login it cannot reach.
 */

export const SITE_NAME = 'MockSathi';

/**
 * Where the site is served from, for canonical and Open Graph URLs.
 *
 * Set `NEXT_PUBLIC_SITE_URL` in the deployment. Without it, canonicals would
 * point at localhost, which is worse than having none — so the fallback is
 * only ever right in development.
 */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

/** The states whose recruitment exams the current tests are built for. */
export const STATES = ['Rajasthan', 'Jharkhand', 'Odisha', 'Punjab', 'Haryana'] as const;

/** Exam series named on the About page as current or announced. */
export const EXAMS = ['RSSB LDC', 'Rajasthan High Court', 'SSC', 'Banking', 'RRB NTPC', 'DSSSB'] as const;

export const SITE_DESCRIPTION =
  'MockSathi offers expert-designed Word and Excel efficiency mock tests for typing and computer proficiency exams in Rajasthan, Jharkhand, Odisha, Punjab, Haryana and other state government recruitment exams. Practise under real exam conditions and improve your speed and accuracy.';

const KEYWORDS = [
  'Word efficiency test',
  'Excel efficiency test',
  'computer proficiency test',
  'typing test practice',
  'government exam mock test',
  ...STATES.map((state) => `${state} government exam mock test`),
  ...EXAMS.map((exam) => `${exam} mock test`),
];

export interface PageSeo {
  /** Without the site name — the template appends it. */
  title: string;
  description: string;
  /** Path from the site root, e.g. `/refund-policy`. */
  path: string;
  /**
   * Whether search engines should index the page.
   *
   * Off for the sign-in and sign-up screens: they are doorways, not content,
   * and indexing them puts a login form in front of someone who searched for
   * a mock test.
   */
  index?: boolean;
}

/**
 * One page's metadata, with the canonical URL and social cards filled in.
 *
 * A canonical on every page because the same content is reachable with and
 * without a trailing slash, and with tracking parameters attached — three URLs
 * that search engines would otherwise treat as three competing pages.
 */
export function pageMetadata({ title, description, path, index = true }: PageSeo): Metadata {
  const url = `${SITE_URL}${path}`;

  return {
    title,
    description,
    keywords: KEYWORDS,
    alternates: { canonical: url },
    robots: index ? { index: true, follow: true } : { index: false, follow: true },
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      title: `${title} · ${SITE_NAME}`,
      description,
      url,
      locale: 'en_IN',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} · ${SITE_NAME}`,
      description,
    },
  };
}
