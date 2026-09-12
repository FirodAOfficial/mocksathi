import { LegalNavLink } from '@/components/legal/LegalNavLink';
import { SITE_LINKS } from '@/site/contact';
import styles from './SiteFooter.module.css';

/**
 * Real, standalone pages — not the modal versions shown inline during
 * signup/subscription (`src/components/legal/LegalDocumentLink.tsx`). A
 * footer needs crawlable, shareable, directly-linkable pages; the modals
 * exist for the "read this before you tick the box" moment, not as the only
 * way to reach this content. Both read from the same underlying
 * `*Content.tsx` components, so there's exactly one copy of the actual text.
 */
export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <nav className={styles.links} aria-label="Legal and company">
        {SITE_LINKS.map((link) => (
          <LegalNavLink key={link.href} href={link.href} className={styles.link}>
            {link.label}
          </LegalNavLink>
        ))}
      </nav>
      <p className={styles.copyright}>© {new Date().getFullYear()} Mocksathi. All rights reserved.</p>
    </footer>
  );
}
