import { Extension } from '@tiptap/core';
import { isUnderlineStyle, underlineCss, type UnderlineStyle } from '../functions/underline';

/**
 * Word's underline drop-down: the line's style and its colour.
 *
 * These are attributes of the existing `underline` mark rather than marks of
 * their own, which is what Word's model says too — a run is underlined once, in
 * one style, in one colour. A separate "double underline" mark would let a run
 * carry both, and a question asking for a double underline could then be
 * satisfied by text that is also underlined once.
 */

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    underlineFormat: {
      /**
       * Underlines the selection in the given style and colour.
       *
       * `color` is `null` for Word's Automatic, which follows the text colour.
       */
      setUnderlineStyle: (style: UnderlineStyle, color?: string | null) => ReturnType;
      /** The underline colour, leaving the style as it is. */
      setUnderlineColor: (color: string | null) => ReturnType;
    };
  }
}

export const UnderlineFormat = Extension.create({
  name: 'underlineFormat',

  addGlobalAttributes() {
    return [
      {
        types: ['underline'],
        attributes: {
          style: {
            default: null,
            parseHTML: (element) => {
              const named = element.getAttribute('data-underline');
              if (isUnderlineStyle(named)) return named;
              // A pasted document says `double` or `wavy` in CSS instead.
              const style = element.style.textDecorationStyle;
              return style === 'double' || style === 'dotted' || style === 'dashed' || style === 'wavy'
                ? style
                : null;
            },
            renderHTML: (attributes) => {
              const style = attributes.style as UnderlineStyle | null;
              if (!style || style === 'single') return {};
              return {
                'data-underline': style,
                style: underlineCss(style, (attributes.color as string | null) ?? null),
              };
            },
          },

          color: {
            default: null,
            parseHTML: (element) => element.getAttribute('data-underline-color'),
            renderHTML: (attributes) => {
              const color = attributes.color as string | null;
              if (!color) return {};
              const style = (attributes.style as UnderlineStyle | null) ?? 'single';
              // The colour is rendered with the style, so both end up in one
              // declaration rather than two that fight over `text-decoration`.
              return { 'data-underline-color': color, style: underlineCss(style, color) };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setUnderlineStyle:
        (style, color) =>
        ({ chain }) =>
          chain()
            .setMark('underline', { style, ...(color === undefined ? {} : { color }) })
            .run(),

      setUnderlineColor:
        (color) =>
        ({ chain, editor }) =>
          chain()
            .setMark('underline', {
              // Setting a colour on text that is not underlined underlines it,
              // exactly as Word's Underline Colour menu does.
              style: (editor.getAttributes('underline').style as UnderlineStyle | null) ?? 'single',
              color,
            })
            .run(),
    };
  },
});
