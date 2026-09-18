import { Extension } from '@tiptap/core';
import { DEFAULT_FONT_SIZE_PT, steppedFontSize } from '../fontSizes';

/**
 * Word's keyboard shortcuts.
 *
 * This build used to have none: every extension's keymap was stripped and a
 * guard swallowed Ctrl-anything, so that formatting could only come from the
 * ribbon. That was a deliberate choice and it is now the wrong one — the exam
 * this app stands in for is sat in Word, where a candidate who presses Ctrl+B
 * gets bold, and an editor that does not is testing something the real paper
 * does not test.
 *
 * So the shortcuts are back, but *listed*, not inherited. Each extension's own
 * keymap stays stripped (`ribbonOnly`), along with its input rules — Word does
 * not turn `**x**` into bold as you type — and this file is the single,
 * auditable statement of which keys do something. Anything not here is still
 * swallowed by `RibbonOnlyShortcuts`, which is what keeps Ctrl+S from opening
 * the browser's save dialog in the middle of a paper.
 *
 * `Mod` is Ctrl on Windows and Linux, Cmd on macOS; Tiptap resolves it.
 */

export interface WordShortcutsOptions {
  /** Ctrl+F. Opens the Find dialog, which lives in the shell, not the editor. */
  onFind: (() => void) | null;
  /** Ctrl+H. */
  onReplace: (() => void) | null;
}

export const WordShortcuts = Extension.create<WordShortcutsOptions>({
  name: 'wordShortcuts',

  /*
   * Above `RibbonOnlyShortcuts` (1000), whose plugin swallows Mod-<character>
   * wholesale. Plugins run in priority order, so these bindings see the event
   * first and the guard only gets what they did not handle.
   */
  priority: 1100,

  addOptions() {
    return { onFind: null, onReplace: null };
  },

  addKeyboardShortcuts() {
    const size = (direction: 1 | -1) => (): boolean => {
      const raw: unknown = this.editor.getAttributes('textStyle').fontSize;
      const parsed = typeof raw === 'string' ? Number.parseFloat(raw) : Number.NaN;
      const current = Number.isFinite(parsed) ? parsed : DEFAULT_FONT_SIZE_PT;
      return this.editor.commands.setFontSize(`${steppedFontSize(current, direction)}pt`);
    };

    /** Opens one of the shell's dialogs, if the shell gave us a way to. */
    const open = (handler: (() => void) | null) => (): boolean => {
      if (!handler) return false;
      handler();
      return true;
    };

    return {
      // Character formatting
      'Mod-b': () => this.editor.commands.toggleBold(),
      'Mod-i': () => this.editor.commands.toggleItalic(),
      'Mod-u': () => this.editor.commands.toggleUnderline(),
      // Word's Ctrl+Shift+D is a double underline.
      'Mod-Shift-d': () => this.editor.commands.setUnderlineStyle('double'),
      'Mod-Shift-x': () => this.editor.commands.toggleStrike(),
      'Mod-=': () => this.editor.commands.toggleSubscript(),
      'Mod-Shift-+': () => this.editor.commands.toggleSuperscript(),
      // Word offers both pairs for Grow/Shrink Font.
      'Mod-Shift-.': size(1),
      'Mod-Shift-,': size(-1),
      'Mod-]': size(1),
      'Mod-[': size(-1),
      // Clear character formatting.
      'Mod-Space': () => this.editor.commands.unsetAllMarks(),

      // Paragraph formatting
      'Mod-l': () => this.editor.commands.setTextAlign('left'),
      'Mod-e': () => this.editor.commands.setTextAlign('center'),
      'Mod-r': () => this.editor.commands.setTextAlign('right'),
      'Mod-j': () => this.editor.commands.setTextAlign('justify'),
      'Mod-1': () => this.editor.commands.setLineHeight(1),
      'Mod-2': () => this.editor.commands.setLineHeight(2),
      'Mod-5': () => this.editor.commands.setLineHeight(1.5),
      'Mod-m': () => this.editor.commands.changeIndent(1),
      'Mod-Shift-m': () => this.editor.commands.changeIndent(-1),

      // Styles
      'Mod-Alt-1': () => this.editor.commands.setNode('heading', { level: 1, styleName: null }),
      'Mod-Alt-2': () => this.editor.commands.setNode('heading', { level: 2, styleName: null }),
      'Mod-Alt-3': () => this.editor.commands.setNode('heading', { level: 3, styleName: null }),
      'Mod-Shift-n': () => this.editor.commands.setNode('paragraph', { styleName: null }),

      // Lists
      'Mod-Shift-l': () => this.editor.commands.toggleBulletList(),
      'Mod-Shift-7': () => this.editor.commands.toggleOrderedList(),

      // History. The extension is in the schema with its keymap stripped, so
      // these are the only way to reach it besides the ribbon buttons.
      'Mod-z': () => this.editor.commands.undo(),
      'Mod-y': () => this.editor.commands.redo(),
      'Mod-Shift-z': () => this.editor.commands.redo(),

      // Editing dialogs, which the shell owns.
      'Mod-f': open(this.options.onFind),
      'Mod-h': open(this.options.onReplace),
    };
  },
});
