import type { Metadata, Viewport } from 'next';
import { Analytics } from '@vercel/analytics/next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Document Editor',
  description: 'A browser word processor that opens .docx documents from a URL.',
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
