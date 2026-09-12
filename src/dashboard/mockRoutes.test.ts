import { describe, expect, it } from 'vitest';
import { startHrefFor } from './mockRoutes';

/**
 * Where a row takes the candidate, which is the one thing three screens have to
 * agree on — the two mock tables and the Today's Mock screen all render a Start
 * of some kind, and when the destination was inlined at each call site the ones
 * that got missed sent a candidate to the Word editor for an Excel paper.
 */
describe('startHrefFor', () => {
  it('opens the paper a row names, not whichever one /exam resolves to', () => {
    // The whole reason a row carries its slug: every row used to lead to the
    // same paper, which is why none of them led anywhere.
    expect(startHrefFor({ mockType: 'word', testSlug: 'word-practical-sample' })).toBe(
      '/exam?subject=word&test=word-practical-sample',
    );
    expect(startHrefFor({ mockType: 'excel', testSlug: 'excel-practical-sample' })).toBe(
      '/exam?subject=excel&test=excel-practical-sample',
    );
  });

  it('escapes a slug rather than trusting it into the query string', () => {
    expect(startHrefFor({ mockType: 'word', testSlug: 'a b&c=d' })).toBe('/exam?subject=word&test=a%20b%26c%3Dd');
  });

  it('carries the subject alongside the slug, so a stale link still lands on the right skill', () => {
    // `?test=` wins when the slug resolves; `?subject=` is what decides the
    // fallback paper when it no longer does.
    expect(startHrefFor({ mockType: 'excel', testSlug: 'deleted-paper' })).toContain('subject=excel');
  });

  it('sends a row that names no paper to its skill’s default', () => {
    // Both land on the instructions, not straight into an editor: the clock
    // starts when the paper opens, and it must not start while someone is
    // still reading the rules.
    expect(startHrefFor({ mockType: 'word' })).toBe('/exam');
    expect(startHrefFor({ mockType: 'excel' })).toBe('/exam?subject=excel');
  });

  it('sends a mixed revision paper to the screen that offers both', () => {
    expect(startHrefFor({ mockType: 'mixed' })).toBe('/dashboard/today');
  });
});
