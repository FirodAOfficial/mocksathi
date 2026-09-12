import Link from 'next/link';
import type { ReactNode } from 'react';
import { BrandLogo } from '@/components/site/BrandLogo';
import { SiteFooter } from '@/components/site/SiteFooter';
import { CloseButton } from './CloseButton';
import styles from './PublicPageLayout.module.css';

export interface PublicPageLayoutProps {
  title: string;
  /** Omitted for pages with no meaningful revision date (About Us) — the legal documents all set it. */
  lastUpdated?: string;
  children: ReactNode;
}

/**
 * Shared chrome for the standalone public pages: the three legal documents
 * and About Us. Outside `/dashboard`'s auth gate and outside the auth pages'
 * split-screen layout on purpose — these have to be reachable by a
 * signed-out visitor (linked from `SiteFooter`, shown on `/login`/`/signup`),
 * same reasoning the legal pages had before they were briefly modal-only.
 */
export function PublicPageLayout({ title, lastUpdated, children }: PublicPageLayoutProps) {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        {/*
          The same lockup the footer draws, so the two ends of the page do not
          disagree about the mark — or, as they did, about whether the name is
          written "Mocksathi" or "MockSathi".
        */}
        <Link href="/" className={styles.logoRow} aria-label="MockSathi home">
          <BrandLogo size={32} tone="dark" />
        </Link>

        <CloseButton />
      </header>

      <main className={styles.card}>
        <h1 className={styles.title}>{title}</h1>
        {lastUpdated && <p className={styles.lastUpdated}>Last Updated: {lastUpdated}</p>}
        {children}
      </main>

      <div className={styles.footerSlot}>
        <SiteFooter />
      </div>
    </div>
  );
}
