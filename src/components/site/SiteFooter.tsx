import Link from 'next/link';
import { CONTACT, MAIL_URL, SITE_LINKS, WHATSAPP_URL } from '@/site/contact';
import { SocialIcon } from './SocialIcon';
import styles from './SiteFooter.module.css';

/**
 * The site footer, shown on every public page and under the candidate portal.
 *
 * The five policy and company links belong on every page a payment gateway or
 * an app store might look at, not only on a marketing home page — which is why
 * this is rendered by the portal shell and the sign-in screen as well as by the
 * site pages themselves.
 */
/**
 * The same links as a single compact row.
 *
 * For the sign-in and sign-up screens, which are a full-height split panel — a
 * footer with a brand column and contact details there would push the sign-in
 * card off a laptop screen. The links still have to be reachable from the page
 * a visitor lands on, so they appear as one line instead of being dropped.
 */
export function SiteLinksBar() {
  return (
    <nav className={styles.linksBar} aria-label="Company and policies">
      {SITE_LINKS.map((link) => (
        <Link key={link.href} href={link.href} className={styles.barLink}>
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brandColumn}>
          <div className={styles.logoRow}>
            <span className={styles.logoMark} aria-hidden="true">
              MS
            </span>
            <span className={styles.logoName}>MockSathi</span>
          </div>
          <p className={styles.blurb}>
            Expert-designed Word and Excel efficiency mocks for state government recruitment exams.
          </p>
        </div>

        <nav className={styles.links} aria-label="Company and policies">
          {SITE_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className={styles.link}>
              {link.label}
            </Link>
          ))}
        </nav>

        <div className={styles.contactColumn}>
          <a className={styles.contactRow} href={MAIL_URL}>
            <SocialIcon name="mail" size={18} />
            {CONTACT.email}
          </a>
          <a className={styles.contactRow} href={WHATSAPP_URL} target="_blank" rel="noreferrer">
            <SocialIcon name="whatsapp" size={18} />
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
              <SocialIcon name="instagram" />
            </a>
            <a
              className={styles.socialButton}
              href={CONTACT.youtube}
              target="_blank"
              rel="noreferrer"
              aria-label="MockSathi on YouTube"
            >
              <SocialIcon name="youtube" />
            </a>
          </div>
        </div>
      </div>

      <div className={styles.baseline}>
        <span>&copy; {new Date().getFullYear()} MockSathi. All rights reserved.</span>
        <span>Made for exam aspirants in India.</span>
      </div>
    </footer>
  );
}
