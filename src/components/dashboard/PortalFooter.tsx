import { LegalNavLink } from '@/components/legal/LegalNavLink';
import { SITE_LINKS } from '@/site/contact';
import styles from './PortalFooter.module.css';

/**
 * The dashboard portal's own footer — a thin closing line, not the public
 * site's full dark footer (`SiteFooter`).
 *
 * The policy links still belong under the portal (a signed-in candidate
 * looking for the refund terms should not have to sign out to find them),
 * but a marketing-page footer — brand blurb, social icons, a navy band —
 * read as a stray chunk of the landing page bolted onto the bottom of a
 * dense, light, small-type table screen. This is sized to match everything
 * else here instead.
 */
export function PortalFooter() {
  return (
    <footer className={styles.footer}>
      <p className={styles.copyright}>&copy; {new Date().getFullYear()} MockSathi</p>
      <nav className={styles.links} aria-label="Company and policies">
        {SITE_LINKS.map((link) => (
          <LegalNavLink key={link.href} href={link.href} className={styles.link}>
            {link.label}
          </LegalNavLink>
        ))}
      </nav>
    </footer>
  );
}
