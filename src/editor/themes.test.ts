import { describe, expect, it } from 'vitest';
import { DEFAULT_HEADING_STYLE, STYLE_SETS, THEMES, THEME_COLOURS, headingStyleVars } from './themes';

/**
 * The Design tab is presentation, and the one thing worth pinning about it is
 * that the gallery previews and the page cannot disagree: both are built from
 * `headingStyleVars`, so a preview can never show something applying it would
 * not do.
 */

describe('headingStyleVars', () => {
  it('names every property the stylesheet reads', () => {
    expect(headingStyleVars(DEFAULT_HEADING_STYLE)).toEqual({
      '--doc-heading-font': 'Cambria, Georgia, serif',
      '--doc-heading-colour': '#365f91',
      '--doc-heading-weight': '400',
      '--doc-heading-caps': 'none',
    });
  });

  it('turns capitals into the value `text-transform` wants', () => {
    expect(headingStyleVars({ ...DEFAULT_HEADING_STYLE, caps: true })['--doc-heading-caps']).toBe('uppercase');
  });
});

describe('the catalogues', () => {
  it('gives every entry a distinct id', () => {
    for (const list of [THEMES, THEME_COLOURS, STYLE_SETS]) {
      const ids = list.map((entry) => entry.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  /*
   * The gallery marks the current set by comparing colour and font, so two
   * sets that agreed on both would light up together and neither would be
   * wrong — the candidate could not tell which one they had picked.
   */
  it('gives every style set a distinct colour-and-font pair', () => {
    const pairs = STYLE_SETS.map((set) => `${set.heading.colour}|${set.heading.font}`);
    expect(new Set(pairs).size).toBe(pairs.length);
  });

  it('starts from Word\'s own default', () => {
    expect(THEMES[0]?.heading).toEqual(DEFAULT_HEADING_STYLE);
    expect(STYLE_SETS[0]?.heading).toEqual(DEFAULT_HEADING_STYLE);
  });
});
