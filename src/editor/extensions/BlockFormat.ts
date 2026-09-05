import { Extension } from '@tiptap/core';
import type { ParagraphBorders } from '@/services/document/types';

/**
 * Paragraph-level formatting that Word owns but ProseMirror does not model:
 * indentation, line spacing, space before/after, and paragraph borders.
 *
 * These are global attributes rather than a node type so they apply uniformly
 * to paragraphs, headings and quotes, and survive a node type change — turning
 * a paragraph into Heading 1 must not silently reset its indentation.
 */

/** One press of Increase Indent, matching Word's default 0.5" tab. */
export const INDENT_STEP_PX = 48;
export const MAX_INDENT_PX = INDENT_STEP_PX * 10;

export interface BlockFormatAttributes {
  lineHeight: number | null;
  indentLeft: number | null;
  indentRight: number | null;
  indentFirstLine: number | null;
  spaceBefore: number | null;
  spaceAfter: number | null;
  borders: ParagraphBorders | null;
}

export const BLOCK_FORMAT_TYPES = ['paragraph', 'heading', 'blockquote'] as const;

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    blockFormat: {
      setLineHeight: (lineHeight: number | null) => ReturnType;
      setParagraphSpacing: (spacing: { before?: number | null; after?: number | null }) => ReturnType;
      setParagraphBorders: (borders: ParagraphBorders | null) => ReturnType;
      changeIndent: (direction: 1 | -1) => ReturnType;
      clearBlockFormat: () => ReturnType;
    };
  }
}

function px(value: unknown): string | null {
  return typeof value === 'number' && Number.isFinite(value) ? `${value}px` : null;
}

function parsePx(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? value : null;
}

function borderCss(borders: ParagraphBorders | null): Record<string, string> {
  if (!borders) return {};
  const edge = '1px solid #000000';
  const styles: Record<string, string> = {};
  if (borders.top) styles['border-top'] = edge;
  if (borders.bottom) styles['border-bottom'] = edge;
  if (borders.left) styles['border-left'] = edge;
  if (borders.right) styles['border-right'] = edge;
  // Without padding the rule sits flush against the glyphs, which Word never does.
  if (Object.keys(styles).length > 0) styles['padding'] = '2px 4px';
  return styles;
}

export const BlockFormat = Extension.create({
  name: 'blockFormat',

  addGlobalAttributes() {
    return [
      {
        types: [...BLOCK_FORMAT_TYPES],
        attributes: {
          /**
           * The gallery style applied to the block. Headings and quotes are
           * real node types, but Title, Subtitle and No Spacing are paragraphs
           * that differ only in appearance, so they are carried as a named
           * style and rendered from CSS.
           */
          styleName: {
            default: null,
            parseHTML: (element) => element.getAttribute('data-style'),
            renderHTML: (attributes) =>
              attributes.styleName
                ? { 'data-style': String(attributes.styleName), class: `doc-style-${String(attributes.styleName)}` }
                : {},
          },
          lineHeight: {
            default: null,
            parseHTML: (element) => {
              const raw = element.style.lineHeight;
              const value = Number.parseFloat(raw);
              return Number.isFinite(value) ? value : null;
            },
            renderHTML: (attributes) =>
              attributes.lineHeight ? { style: `line-height: ${String(attributes.lineHeight)}` } : {},
          },
          indentLeft: {
            default: null,
            parseHTML: (element) => parsePx(element.style.marginLeft),
            renderHTML: (attributes) => {
              const value = px(attributes.indentLeft);
              return value ? { style: `margin-left: ${value}` } : {};
            },
          },
          indentRight: {
            default: null,
            parseHTML: (element) => parsePx(element.style.marginRight),
            renderHTML: (attributes) => {
              const value = px(attributes.indentRight);
              return value ? { style: `margin-right: ${value}` } : {};
            },
          },
          indentFirstLine: {
            default: null,
            parseHTML: (element) => parsePx(element.style.textIndent),
            renderHTML: (attributes) => {
              const value = px(attributes.indentFirstLine);
              return value ? { style: `text-indent: ${value}` } : {};
            },
          },
          spaceBefore: {
            default: null,
            parseHTML: (element) => parsePx(element.style.marginTop),
            renderHTML: (attributes) => {
              const value = px(attributes.spaceBefore);
              return value ? { style: `margin-top: ${value}` } : {};
            },
          },
          spaceAfter: {
            default: null,
            parseHTML: (element) => parsePx(element.style.marginBottom),
            renderHTML: (attributes) => {
              const value = px(attributes.spaceAfter);
              return value ? { style: `margin-bottom: ${value}` } : {};
            },
          },
          borders: {
            default: null,
            parseHTML: (element) => {
              const borders: ParagraphBorders = {
                top: element.style.borderTopStyle === 'solid',
                bottom: element.style.borderBottomStyle === 'solid',
                left: element.style.borderLeftStyle === 'solid',
                right: element.style.borderRightStyle === 'solid',
              };
              return Object.values(borders).some(Boolean) ? borders : null;
            },
            renderHTML: (attributes) => {
              const styles = borderCss(attributes.borders as ParagraphBorders | null);
              const entries = Object.entries(styles);
              if (entries.length === 0) return {};
              return { style: entries.map(([key, value]) => `${key}: ${value}`).join('; ') };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    /** Applies an attribute to every block type in the selection that accepts it. */
    const applyToBlocks =
      (attributes: Record<string, unknown>) =>
      ({ commands }: { commands: Record<string, (...args: never[]) => boolean> }): boolean =>
        BLOCK_FORMAT_TYPES.map((type) =>
          (commands.updateAttributes as unknown as (t: string, a: Record<string, unknown>) => boolean)(
            type,
            attributes,
          ),
        ).some(Boolean);

    return {
      setLineHeight:
        (lineHeight) =>
        ({ commands }) =>
          applyToBlocks({ lineHeight })({ commands: commands as never }),

      setParagraphSpacing:
        (spacing) =>
        ({ commands }) => {
          const attributes: Record<string, unknown> = {};
          if ('before' in spacing) attributes.spaceBefore = spacing.before;
          if ('after' in spacing) attributes.spaceAfter = spacing.after;
          return applyToBlocks(attributes)({ commands: commands as never });
        },

      setParagraphBorders:
        (borders) =>
        ({ commands }) =>
          applyToBlocks({ borders })({ commands: commands as never }),

      changeIndent:
        (direction) =>
        ({ state, commands }) => {
          // Read from the first block in the selection so repeated presses step
          // rather than restarting. `$from.parent` is not enough: with the whole
          // document selected the anchor's parent is the doc node, whose attrs
          // never carry an indent, and every press would compute the same value.
          let current = 0;
          let found = false;
          state.doc.nodesBetween(state.selection.from, state.selection.to, (node) => {
            if (found) return false;
            if (node.isTextblock) {
              const value = Number(node.attrs.indentLeft ?? 0);
              current = Number.isFinite(value) ? value : 0;
              found = true;
              return false;
            }
            return true;
          });
          const next = Math.min(MAX_INDENT_PX, Math.max(0, current + direction * INDENT_STEP_PX));
          return applyToBlocks({ indentLeft: next === 0 ? null : next })({ commands: commands as never });
        },

      clearBlockFormat:
        () =>
        ({ commands }) =>
          applyToBlocks({
            lineHeight: null,
            indentLeft: null,
            indentRight: null,
            indentFirstLine: null,
            spaceBefore: null,
            spaceAfter: null,
            borders: null,
          })({ commands: commands as never }),
    };
  },
});
