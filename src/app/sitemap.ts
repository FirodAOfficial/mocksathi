import type { MetadataRoute } from 'next';
import { SITE_LINKS } from '@/site/contact';
import { SITE_URL } from '@/site/seo';

/**
 * The pages a search engine should know about.
 *
 * Built from `SITE_LINKS`, the same list the footer renders, so a page added to
 * one is in the other. Everything else on the site is either behind a login or
 * a doorway to one, and neither belongs in a sitemap.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const updated = new Date();

  return SITE_LINKS.map((link) => ({
    url: `${SITE_URL}${link.href}`,
    lastModified: updated,
    changeFrequency: 'monthly' as const,
    // About and Contact say what the product is; the policies are reference.
    priority: link.href === '/about' || link.href === '/contact' ? 0.8 : 0.5,
  }));
}
