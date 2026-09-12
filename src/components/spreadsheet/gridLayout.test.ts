import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * A guard for a bug jsdom cannot see.
 *
 * The grid virtualizes against `clientHeight`. A bare `1fr` track is
 * `minmax(auto, 1fr)`, whose `auto` minimum refuses to shrink below its
 * content — so the scroller grew to the height of the whole sheet,
 * `clientHeight` reported the full extent, and every row in it rendered.
 * Virtualization was still running; it was simply being told the viewport was
 * the size of the document.
 *
 * jsdom computes no layout, so no component test can catch this: it was found
 * in a real browser. Asserting on the stylesheet is the cheapest thing that
 * fails if someone writes `1fr` again.
 */

const FILES = [
  '../../components/spreadsheet/grid/SpreadsheetGrid.module.css',
  '../../components/spreadsheet/SpreadsheetShell.module.css',
];

describe('spreadsheet layout', () => {
  it.each(FILES)('sizes every flexible grid track with a zero minimum in %s', (relative) => {
    const css = readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

    const tracks = [...css.matchAll(/grid-template-(?:rows|columns):([^;]+);/g)].map(
      (match) => match[1]!.trim(),
    );

    expect(tracks.length).toBeGreaterThan(0);
    for (const track of tracks) {
      // `minmax(0, 1fr)` is the fix, so its own `1fr` is removed before looking
      // for a bare one.
      const bare = track.replace(/minmax\([^)]*\)/g, 'minmax');

      expect(bare, `"${track}" uses a bare 1fr, which keeps an auto minimum`).not.toMatch(/1fr/);
    }
  });
});
