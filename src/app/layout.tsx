import type { Metadata, Viewport } from 'next';
import { Analytics } from '@vercel/analytics/next';
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/site/seo';
import './globals.css';

export const metadata: Metadata = {
  /*
   * The default was "Document Editor", which described one route and was what
   * every other page inherited — including the public ones a search engine
   * actually reads. The template lets each page name itself and still be
   * attributed to the site.
   */
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — Word & Excel Efficiency Mock Tests`,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  // The audience sits state government exams in India; the locale tells an
  // answer engine which English, and which country's exams, this is about.
  openGraph: { type: 'website', siteName: SITE_NAME, locale: 'en_IN' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      {/*
        Browser extensions decorate <body> before React hydrates — Grammarly
        adds `data-gr-ext-installed` and `data-new-gr-c-s-check-loaded`, and
        password managers and dark-mode tools do similar. React sees attributes
        the server never rendered and warns.

        The suppression covers this element's own attributes and text only; it
        does not cascade to children, so a genuine hydration mismatch anywhere
        inside the app still reports normally.
      */}
      <body suppressHydrationWarning>
        {children}
        {/*
          Vercel Analytics. It injects its script only on Vercel, so local runs
          and any other host are unaffected — nothing to gate it behind here.
        */}
        <Analytics />
      </body>
    </html>
  );
}
