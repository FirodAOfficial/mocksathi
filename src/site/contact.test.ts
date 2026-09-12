import { readFileSync } from 'node:fs';
import type { Metadata } from 'next';
import { describe, expect, it } from 'vitest';
import { CONTACT, MAIL_URL, SITE_LINKS, WHATSAPP_URL } from './contact';
import { SITE_URL } from './seo';

/**
 * The footer links and the contact details are the two things on these pages a
 * payment gateway actually checks, and both rot silently: a page can be deleted
 * or renamed and the footer will keep linking to a 404.
 */

describe('site links', () => {
  it('points at a page that exists for every footer link', () => {
    // A 404 behind "Refund Policy" is worse than no link, and nothing else in
    // the app would notice the page had gone.
    for (const link of SITE_LINKS) {
      const path = `src/app/(site)${link.href}/page.tsx`;
      expect(() => readFileSync(path, 'utf8'), `${link.href} has no page`).not.toThrow();
    }
  });

  it('lists all five pages', () => {
    expect(SITE_LINKS.map((link) => link.href)).toEqual([
      '/about',
      '/contact',
      '/terms',
      '/refund-policy',
      '/privacy',
    ]);
  });
});

describe('contact details', () => {
  it('builds a dialable WhatsApp link from the displayed number', () => {
    // The two are written separately — one for reading, one for dialling — so
    // this pins that they are the same number.
    expect(WHATSAPP_URL).toBe('https://wa.me/917690990908');
    expect(CONTACT.phone.replace(/\D/g, '')).toBe(CONTACT.whatsappNumber);
  });

  it('builds a mailto from the displayed address', () => {
    expect(MAIL_URL).toBe(`mailto:${CONTACT.email}`);
  });

  it('uses one support address across every policy page', () => {
    // The source documents carried an older address. A policy page quoting a
    // mailbox nobody reads is how a refund request goes missing.
    for (const page of ['terms', 'privacy', 'refund-policy']) {
      const source = readFileSync(`src/app/(site)/${page}/page.tsx`, 'utf8');

      expect(source, `${page} hardcodes an address`).not.toMatch(/@typingsathi\.com/);
      expect(source, `${page} does not import the shared contact details`).toContain(
        "from '@/site/contact'",
      );
    }
  });

  it('leaves no unfilled placeholders on a published policy page', () => {
    // The drafts shipped with "[City, State]" and "[7–14] working days" in
    // square brackets. Either is embarrassing on a live page and the second is
    // a commitment a gateway will hold us to.
    for (const page of ['terms', 'privacy', 'refund-policy']) {
      const source = readFileSync(`src/app/(site)/${page}/page.tsx`, 'utf8');
      const placeholders = source.match(/\[[A-Z0-9][^\]]{3,40}\]/g) ?? [];

      expect(placeholders, `${page} still has a placeholder`).toEqual([]);
    }
  });
});

describe('page metadata', () => {
  it('gives every public page a title and a description', async () => {
    // A missing description leaves a search engine to invent a snippet from
    // whatever text it finds first — on a policy page, that is the legalese.
    for (const link of SITE_LINKS) {
      const page = (await import(`../app/(site)${link.href}/page`)) as { metadata?: Metadata };
      const metadata = page.metadata;

      expect(metadata?.title, `${link.href} has no title`).toBeTruthy();
      expect(String(metadata?.description ?? '').length, `${link.href} has a thin description`).toBeGreaterThan(80);
    }
  });

  it('gives every public page a canonical URL matching its path', async () => {
    // The same page is reachable with a trailing slash and with tracking
    // parameters; without a canonical those are competing URLs.
    for (const link of SITE_LINKS) {
      const page = (await import(`../app/(site)${link.href}/page`)) as { metadata?: Metadata };

      expect(String(page.metadata?.alternates?.canonical), link.href).toBe(`${SITE_URL}${link.href}`);
    }
  });

  it('keeps the sign-in and sign-up doorways out of the index', () => {
    // Read rather than imported: these pages pull in `next/font`, which needs
    // the Next build pipeline. The assertion is about the source either way.
    for (const route of ['login', 'signup']) {
      const source = readFileSync(`src/app/${route}/page.tsx`, 'utf8');

      expect(source, `${route} is indexable`).toContain('index: false');
    }
  });

  it('lists every footer page in the sitemap', async () => {
    const { default: sitemap } = await import('../app/sitemap');
    const urls = sitemap().map((entry) => entry.url);

    expect(urls).toEqual(SITE_LINKS.map((link) => `${SITE_URL}${link.href}`));
  });
});
