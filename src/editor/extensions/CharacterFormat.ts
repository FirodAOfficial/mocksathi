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

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    characterFormat: {
      setTextEffect: (effect: TextEffect | null) => ReturnType;
      /** Percentage of normal width, or null for 100%. */
      setCharacterScale: (scale: number | null) => ReturnType;
      /** Points: positive expands, negative condenses, null is normal. */
      setCharacterSpacing: (points: number | null) => ReturnType;
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
