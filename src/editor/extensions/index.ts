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
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table';
import { Subscript } from '@tiptap/extension-subscript';
import { Superscript } from '@tiptap/extension-superscript';
import { Text } from '@tiptap/extension-text';
import { TextAlign } from '@tiptap/extension-text-align';
import { Color, FontFamily, FontSize, TextStyle } from '@tiptap/extension-text-style';
import { Underline } from '@tiptap/extension-underline';
import { CharacterCount, Dropcursor, Gapcursor, Placeholder, UndoRedo } from '@tiptap/extensions';
import type { AnyExtension } from '@tiptap/core';
import { BLOCK_FORMAT_TYPES, BlockFormat } from './BlockFormat';
import { CharacterFormat } from './CharacterFormat';
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

    /*
     * Lists keep Enter, which starts the next bullet.
     *
     * That is text entry — how you get to the next line — in the same category
     * as Shift-Enter and the table's Tab, not a formatting command. Without it
     * Enter falls through to the base keymap, which adds a paragraph inside the
     * current bullet, so the next bullet only appeared on a second press.
     *
     * Tab and Shift-Tab stay stripped: nesting a list item is formatting, and
     * formatting comes from the ribbon.
     */
    ribbonOnly(BulletList),
    ribbonOnly(OrderedList),
    ribbonOnly(ListItem, ['Enter']),

    /*
     * Tables keep Tab and Shift-Tab.
     *
     * That is the one place the no-shortcuts rule bends, and deliberately: Tab
     * in a table moves the cursor between cells. It is navigation, in the same
     * category as the arrow keys, not a formatting command — and without it a
     * table cannot be filled in at all.
     */
    ribbonOnly(Table.configure({ resizable: false }), ['Tab', 'Shift-Tab']),
    ribbonOnly(TableRow),
    ribbonOnly(TableHeader),
    ribbonOnly(TableCell),

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

    // Emboss/engrave and character scale and spacing, also on `textStyle`.
    CharacterFormat,

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
