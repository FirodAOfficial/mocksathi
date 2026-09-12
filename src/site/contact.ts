/**
 * How to reach MockSathi.
 *
 * One definition because these appear in five places — the footer, the Contact
 * page, and the three policy pages, each of which ends with a "Contact us"
 * section. A support address that is right on one page and stale on another is
 * worse than no address at all, and the policy pages are the ones a payment
 * gateway reads.
 */

export const CONTACT = {
  email: 'mocksathi@gmail.com',
  /** Display form. `whatsappNumber` below is the same number, dial-ready. */
  phone: '+91 7690990908',
  whatsappNumber: '917690990908',
  instagram: 'https://www.instagram.com/mocksathi',
  youtube: 'https://www.youtube.com/@mocksathi',
} as const;

export const WHATSAPP_URL = `https://wa.me/${CONTACT.whatsappNumber}`;
export const MAIL_URL = `mailto:${CONTACT.email}`;

/** The date the policies were last revised, shown on each of them. */
export const POLICIES_UPDATED = '10 September 2026';

export interface SiteLink {
  href: string;
  label: string;
}

/**
 * The five pages the footer links to.
 *
 * Ordered as a reader needs them rather than alphabetically: what the company
 * is, how to reach it, then the three documents that bind the purchase.
 */
export const SITE_LINKS: SiteLink[] = [
  { href: '/about', label: 'About Us' },
  { href: '/contact', label: 'Contact Us' },
  { href: '/terms', label: 'Terms & Conditions' },
  { href: '/refund-policy', label: 'Refund & Cancellation' },
  { href: '/privacy', label: 'Privacy Policy' },
];
