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
import { UnderlineFormat } from './UnderlineFormat';
import { RibbonOnlyShortcuts, ribbonOnly } from './ribbonOnlyShortcuts';
import { SearchHighlight } from './SearchHighlight';
import { WordShortcuts, type WordShortcutsOptions } from './WordShortcuts';

/**
 * The editor's schema and behaviour, assembled by hand.
 *
 * `StarterKit` is deliberately not used: it bundles its own keymaps and input
 * rules, and the point of this build is that every trigger is *explicit*.
 * Listing the extensions individually is what makes that auditable — you can
 * see exactly which extensions are in the schema and what each was allowed to
 * keep.
 *
 * Each extension arrives through `ribbonOnly`, which strips its keymap and its
 * input rules. The input rules stay gone for good: Word does not turn `**x**`
 * into bold as you type, and a second, quieter way to format would be a way to
 * format without meaning to. The keymap is then put back deliberately, in
 * `WordShortcuts` — one file listing every key that does something, rather than
 * whatever each extension happened to bind.
 */
export function buildEditorExtensions(shortcuts: Partial<WordShortcutsOptions> = {}): AnyExtension[] {
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
     * Tab and Shift-Tab stay stripped: in Word, Tab in a list indents only at
     * the start of an item, and a candidate tabbing mid-sentence expects a tab.
     * Changing the list level has its own buttons, and its own shortcut.
     */
    ribbonOnly(BulletList),
    ribbonOnly(OrderedList),
    ribbonOnly(ListItem, ['Enter']),

    /*
     * Tables keep Tab and Shift-Tab.
     *
     * Tab in a table moves the cursor between cells: navigation, in the same
     * category as the arrow keys, and without it a table cannot be filled in at
     * all. It stays with the extension rather than being restated in
     * `WordShortcuts`, because it is not a command — it is how you move.
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

    // Emboss/engrave, small caps, hidden text, and character scale and
    // spacing, all on `textStyle`.
    CharacterFormat,

    // The underline drop-down's style and colour, on the underline mark.
    UnderlineFormat,

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

    // Find's current match, drawn while the keyboard is in the dialog.
    SearchHighlight,

    /*
     * Word's keyboard shortcuts, listed one by one, ahead of the guard that
     * swallows everything else. The extensions' own keymaps stay stripped, so
     * this file plus `WordShortcuts` is the whole list of what a key does.
     */
    WordShortcuts.configure({ onFind: shortcuts.onFind ?? null, onReplace: shortcuts.onReplace ?? null }),
    RibbonOnlyShortcuts,
  ];
}
