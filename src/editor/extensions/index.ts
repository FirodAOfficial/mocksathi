import { Blockquote } from '@tiptap/extension-blockquote';
import { Bold } from '@tiptap/extension-bold';
import { Document } from '@tiptap/extension-document';
import { HardBreak } from '@tiptap/extension-hard-break';
import { Heading } from '@tiptap/extension-heading';
import { Highlight } from '@tiptap/extension-highlight';
import { Italic } from '@tiptap/extension-italic';
import { BulletList, ListItem, OrderedList } from '@tiptap/extension-list';
import { Paragraph } from '@tiptap/extension-paragraph';
import { Strike } from '@tiptap/extension-strike';
import { Subscript } from '@tiptap/extension-subscript';
import { Superscript } from '@tiptap/extension-superscript';
import { Text } from '@tiptap/extension-text';
import { TextAlign } from '@tiptap/extension-text-align';
import { Color, FontFamily, FontSize, TextStyle } from '@tiptap/extension-text-style';
import { Underline } from '@tiptap/extension-underline';
import { CharacterCount, Dropcursor, Gapcursor, Placeholder, UndoRedo } from '@tiptap/extensions';
import type { AnyExtension } from '@tiptap/core';
import { BLOCK_FORMAT_TYPES, BlockFormat } from './BlockFormat';
import { RibbonOnlyShortcuts, ribbonOnly } from './ribbonOnlyShortcuts';

/**
 * The editor's schema and behaviour, assembled by hand.
 *
 * `StarterKit` is deliberately not used: it bundles its own keymaps and input
 * rules, and the point of this build is that every formatting trigger is
 * explicit. Listing the extensions individually is also what makes the
 * shortcut-stripping in `ribbonOnly` auditable — you can see exactly which
 * extensions are in the schema and what each was allowed to keep.
 */
export function buildEditorExtensions(): AnyExtension[] {
  return [
    // Structure
    Document,
    Text,
    ribbonOnly(Paragraph),
    ribbonOnly(Heading.configure({ levels: [1, 2, 3] })),
    ribbonOnly(Blockquote),
    // Shift-Enter is text entry, so it is the one binding kept anywhere.
    ribbonOnly(HardBreak, ['Shift-Enter']),

    // Lists. ListKeymap is omitted entirely: Tab/Shift-Tab nesting is a
    // keyboard action, and nesting is driven from the ribbon's list controls.
    ribbonOnly(BulletList),
    ribbonOnly(OrderedList),
    ribbonOnly(ListItem),

    // Character formatting
    ribbonOnly(Bold),
    ribbonOnly(Italic),
    ribbonOnly(Underline),
    ribbonOnly(Strike),
    ribbonOnly(Subscript),
    ribbonOnly(Superscript),
    ribbonOnly(Highlight.configure({ multicolor: true })),

    // Font family, size and colour all ride on the shared `textStyle` mark.
    TextStyle,
    FontFamily,
    FontSize,
    Color,

    // Paragraph formatting
    TextAlign.configure({ types: [...BLOCK_FORMAT_TYPES] }),
    BlockFormat,

    // History is kept, but only reachable through the Undo/Redo ribbon buttons.
    ribbonOnly(UndoRedo),

    // Editing affordances
    Dropcursor,
    Gapcursor,
    CharacterCount,
    Placeholder.configure({ placeholder: 'Type here to begin your document.' }),

    RibbonOnlyShortcuts,
  ];
}
