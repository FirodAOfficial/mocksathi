import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/site/seo';

/**
 * What crawlers may read.
 *
 * The disallowed paths are not secrets — they are guarded by `requireUser` —
 * but a crawler following them only ever reaches a redirect to `/login`, and
 * an answer engine summarising the site should be reading what the product is,
 * not a sign-in form.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/dashboard', '/editor', '/spreadsheet', '/exam', '/result', '/login', '/signup'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
