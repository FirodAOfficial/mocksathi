import { Extension } from '@tiptap/core';

/**
 * Word's Font-dialog character formatting: Emboss/Engrave effects, and the
 * Advanced tab's Scale and Spacing.
 *
 * These ride on the shared `textStyle` mark rather than becoming marks of their
 * own, so a run can carry an effect, a scale and a spacing at once and they
 * merge instead of nesting.
 */

export type TextEffect = 'emboss' | 'engrave';

/** Word's Spacing box offers whole and half points; this is its range. */
export const MAX_CHARACTER_SPACING_PT = 20;
export const CHARACTER_SCALE_OPTIONS = [33, 50, 66, 80, 90, 100, 150, 200] as const;

/** The Font dialog's Small caps and All caps. */
export type CapsMode = 'small' | 'all';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    characterFormat: {
      setTextEffect: (effect: TextEffect | null) => ReturnType;
      /** Percentage of normal width, or null for 100%. */
      setCharacterScale: (scale: number | null) => ReturnType;
      /** Points: positive expands, negative condenses, null is normal. */
      setCharacterSpacing: (points: number | null) => ReturnType;
      /** Word's Double strikethrough, which is not the `strike` mark twice. */
      setDoubleStrike: (on: boolean) => ReturnType;
      setCaps: (caps: CapsMode | null) => ReturnType;
      /** Word's Hidden: the text stays in the document but is not shown. */
      setHiddenText: (hidden: boolean) => ReturnType;
    };
  }
}

/*
 * Emboss reads as raised — a light highlight above-left and a dark shadow
 * below-right — and engrave is the same lighting inverted. Word draws these
 * with the theme's face colour; a mid grey is the closest CSS equivalent that
 * stays legible on white.
 */
const EFFECT_CSS: Record<TextEffect, string> = {
  emboss: 'color: #b8b8b8; text-shadow: -1px -1px 0 rgba(255,255,255,0.95), 1px 1px 1px rgba(0,0,0,0.45)',
  engrave: 'color: #b8b8b8; text-shadow: 1px 1px 0 rgba(255,255,255,0.95), -1px -1px 1px rgba(0,0,0,0.45)',
};

function parsePoints(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) && value !== 0 ? value : null;
}

export const CharacterFormat = Extension.create({
  name: 'characterFormat',

  addGlobalAttributes() {
    return [
      {
        types: ['textStyle'],
        attributes: {
          effect: {
            default: null,
            parseHTML: (element) => element.getAttribute('data-effect'),
            renderHTML: (attributes) => {
              const effect = attributes.effect as TextEffect | null;
              if (!effect || !EFFECT_CSS[effect]) return {};
              return { 'data-effect': effect, style: EFFECT_CSS[effect] };
            },
          },

          charScale: {
            default: null,
            parseHTML: (element) => {
              const raw = element.getAttribute('data-char-scale');
              const value = raw === null ? Number.NaN : Number.parseFloat(raw);
              return Number.isFinite(value) ? value : null;
            },
            renderHTML: (attributes) => {
              const scale = attributes.charScale as number | null;
              if (!scale || scale === 100) return {};
              /*
               * Word stretches the glyphs themselves. CSS has no faithful
               * equivalent, so this scales the run horizontally: the width
               * change is visible and the value is recorded exactly, but a
               * scaled run does not reserve its new width and can overlap what
               * follows. Noted in the README rather than papered over.
               */
              return {
                'data-char-scale': String(scale),
                style: `display: inline-block; transform: scaleX(${scale / 100}); transform-origin: left center`,
              };
            },
          },

          charSpacing: {
            default: null,
            parseHTML: (element) => parsePoints(element.style.letterSpacing),
            renderHTML: (attributes) => {
              const points = attributes.charSpacing as number | null;
              if (!points) return {};
              // Expanded and Condensed map exactly onto letter-spacing.
              return { style: `letter-spacing: ${points}pt` };
            },
          },

          /*
           * Double strikethrough is its own property rather than the `strike`
           * mark applied twice: a mark is either there or not, and Word treats
           * single and double as two different answers.
           */
          doubleStrike: {
            default: null,
            parseHTML: (element) => (element.getAttribute('data-double-strike') === 'true' ? true : null),
            renderHTML: (attributes) =>
              attributes.doubleStrike
                ? {
                    'data-double-strike': 'true',
                    style: 'text-decoration-line: line-through; text-decoration-style: double',
                  }
                : {},
          },

          caps: {
            default: null,
            parseHTML: (element) => {
              const named = element.getAttribute('data-caps');
              if (named === 'small' || named === 'all') return named;
              if (element.style.textTransform === 'uppercase') return 'all';
              if (element.style.fontVariant.includes('small-caps')) return 'small';
              return null;
            },
            renderHTML: (attributes) => {
              const caps = attributes.caps as CapsMode | null;
              if (!caps) return {};
              /*
               * Small caps is `font-variant`, which leaves the letters as typed
               * — the same thing Word's Small caps does, and the reason it is
               * formatting rather than a Change Case that rewrites the text.
               */
              return {
                'data-caps': caps,
                style: caps === 'all' ? 'text-transform: uppercase' : 'font-variant: small-caps',
              };
            },
          },

          /*
           * Word hides the text but keeps it in the document, and shows it
           * again when formatting marks are on. The dotted underline is what
           * Word draws under hidden text in that mode; `.marks` in the page's
           * CSS is what reveals it, so a candidate can still find what they hid.
           */
          hidden: {
            default: null,
            parseHTML: (element) => (element.getAttribute('data-hidden') === 'true' ? true : null),
            renderHTML: (attributes) => (attributes.hidden ? { 'data-hidden': 'true' } : {}),
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setTextEffect:
        (effect) =>
        ({ chain }) =>
          chain().setMark('textStyle', { effect }).run(),

      setCharacterScale:
        (scale) =>
        ({ chain }) =>
          chain().setMark('textStyle', { charScale: scale }).run(),

      setCharacterSpacing:
        (points) =>
        ({ chain }) =>
          chain()
            .setMark('textStyle', {
              charSpacing:
                points === null
                  ? null
                  : Math.max(-MAX_CHARACTER_SPACING_PT, Math.min(MAX_CHARACTER_SPACING_PT, points)),
            })
            .run(),
    };
  },
});
