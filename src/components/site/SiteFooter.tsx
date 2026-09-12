import { LegalNavLink } from '@/components/legal/LegalNavLink';
import { CONTACT, MAIL_URL, SITE_LINKS, WHATSAPP_URL } from '@/site/contact';
import { BrandLogo } from './BrandLogo';
import { SocialIcon } from './SocialIcon';
import styles from './SiteFooter.module.css';

/**
 * The site footer, on the public pages and under the candidate portal.
 *
 * Links to the real, standalone pages rather than the modal versions shown
 * inline during signup (`src/components/legal/LegalDocumentLink.tsx`): a footer
 * needs crawlable, shareable, directly-linkable URLs, while the modals exist
 * for the "read this before you tick the box" moment. Both render the same
 * `*Content.tsx` components, so there is one copy of each document's text.
 *
 * `LegalNavLink`, not a plain `Link` — it tracks how the legal cluster was
 * entered so the close button knows where to return to.
 */
export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <BrandLogo size={36} />
          <p className={styles.blurb}>
            Expert-designed Word and Excel efficiency mock tests for state government recruitment
            exams.
          </p>
        </div>

        <nav className={styles.column} aria-label="Company and policies">
          <h2 className={styles.columnTitle}>Company</h2>
          {SITE_LINKS.map((link) => (
            <LegalNavLink key={link.href} href={link.href} className={styles.link}>
              {link.label}
            </LegalNavLink>
          ))}
        </nav>

        <div className={styles.column}>
          <h2 className={styles.columnTitle}>Get in touch</h2>

          <a className={styles.link} href={MAIL_URL}>
            <SocialIcon name="mail" size={16} />
            {CONTACT.email}
          </a>
          <a className={styles.link} href={WHATSAPP_URL} target="_blank" rel="noreferrer">
            <SocialIcon name="whatsapp" size={16} />
            {CONTACT.phone}
          </a>

          <div className={styles.socials}>
            <a
              className={styles.socialButton}
              href={CONTACT.instagram}
              target="_blank"
              rel="noreferrer"
              aria-label="MockSathi on Instagram"
            >
              <SocialIcon name="instagram" size={18} />
            </a>
            <a
              className={styles.socialButton}
              href={CONTACT.youtube}
              target="_blank"
              rel="noreferrer"
              aria-label="MockSathi on YouTube"
            >
              <SocialIcon name="youtube" size={18} />
            </a>
          </div>
        </div>
      </div>

      <div className={styles.baseline}>
        <p className={styles.copyright}>
          &copy; {new Date().getFullYear()} MockSathi. All rights reserved.
        </p>
        <p className={styles.madeFor}>Made for exam aspirants in India.</p>
      </div>
    </footer>
  );
}

/**
 * The same links as a compact card, for the sign-in and sign-up screens.
 *
 * Those pages are a full-height split with the form centred in one half; the
 * full footer's three columns would push the sign-in card off a laptop screen.
 *
 * It carries its own opaque background rather than inheriting whatever is
 * behind it: this renders on both the plain-white desktop background and the
 * dark-gradient mobile one (`LoginScreen.module.css`), and one text colour
 * could not read on both.
 */
export function SiteFooterCompact() {
  return (
    <footer className={styles.compact}>
      <div className={styles.compactTop}>
        <BrandLogo size={26} tone="dark" />
        <a className={styles.compactMail} href={MAIL_URL}>
          {CONTACT.email}
        </a>
      </div>

      <nav className={styles.compactLinks} aria-label="Company and policies">
        {SITE_LINKS.map((link) => (
          <LegalNavLink key={link.href} href={link.href} className={styles.compactLink}>
            {link.label}
          </LegalNavLink>
        ))}
      </nav>

      <p className={styles.compactCopyright}>
        &copy; {new Date().getFullYear()} MockSathi. All rights reserved.
      </p>
    </footer>
  );
}
