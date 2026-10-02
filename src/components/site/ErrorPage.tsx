import Link from 'next/link';
import type { ReactNode } from 'react';
import { ButtonLink } from '../ui/Button';
import { BrandLogo } from './BrandLogo';
import styles from './ErrorPage.module.css';

export interface ErrorPageProps {
  /** The short status label above the heading, e.g. "404". */
  code: string;
  title: string;
  message: string;
  /** Where the primary action goes, and what it says. */
  action: { href: string; label: string };
  /** The quieter second action. A button when the page can retry itself. */
  secondary?: ReactNode;
  /** Shown in small print so a support message can name the failure. */
  digest?: string;
}

/**
 * The page a visitor reaches by accident: a missing URL, or a request that
 * threw.
 *
 * Both used to be Next.js's unstyled defaults — black text on white, no mark,
 * no navigation, no way back. On a product someone is paying to practise with,
 * that reads as the site being broken rather than the address being wrong.
 *
 * Shared between `not-found.tsx` and `error.tsx` so the two cannot drift. It
 * takes its words from the caller rather than deciding them, because "we could
 * not find that page" and "that did not load" are different apologies and only
 * the caller knows which one is true.
 */
export function ErrorPage({ code, title, message, action, secondary, digest }: ErrorPageProps) {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand} aria-label="MockSathi home">
          <BrandLogo size={30} tone="dark" />
        </Link>
      </header>

      <main id="main" tabIndex={-1} className={styles.body}>
        <p className={styles.code}>{code}</p>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.message}>{message}</p>

        <div className={styles.actions}>
          <ButtonLink href={action.href}>{action.label}</ButtonLink>
          {secondary}
        </div>

        {/*
          A way onward that is not the big button. Someone who landed here from
          a search result may want the policies rather than the product.
        */}
        <nav className={styles.links} aria-label="Elsewhere on MockSathi">
          <Link href="/about" className={styles.link}>
            About Us
          </Link>
          <Link href="/contact" className={styles.link}>
            Contact Us
          </Link>
          <Link href="/legal/terms" className={styles.link}>
            Terms &amp; Conditions
          </Link>
          <Link href="/legal/privacy" className={styles.link}>
            Privacy Policy
          </Link>
        </nav>

        {digest ? <p className={styles.digest}>Reference: {digest}</p> : null}
      </main>
    </div>
  );
}
