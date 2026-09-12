import { Inter } from 'next/font/google';
import type { ReactNode } from 'react';
import { SiteFooter } from '@/components/site/SiteFooter';
import styles from './site.module.css';

const inter = Inter({ subsets: ['latin'] });

/**
 * Chrome for the public pages — About, Contact, and the three policies.
 *
 * A route group rather than a path segment, so the URLs stay short: these are
 * the links printed in app stores and handed to a payment gateway, and
 * `/terms` survives a re-org better than `/site/legal/terms`.
 *
 * Signed out by design. `requireUser` guards the portal; a policy page that
 * demanded a login would be unreadable to exactly the person deciding whether
 * to sign up.
 */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`${styles.shell} ${inter.className}`}>
      <div className={styles.content}>{children}</div>
      <SiteFooter />
    </div>
  );
}
