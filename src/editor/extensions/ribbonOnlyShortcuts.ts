import { Extension, type AnyExtension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

/**
 * Enforces the "every action goes through the ribbon" rule.
 *
 * Two layers, because either alone leaks:
 *
 *  1. `withoutShortcuts` removes the keymaps the Tiptap extensions declare.
 *     This is the real fix — Bold genuinely no longer binds Mod-b, so there is
 *     no handler to reach.
 *  2. `RibbonOnlyShortcuts` swallows Mod-<character> at the ProseMirror level.
 *     This catches anything a future extension adds, plus browser defaults such
 *     as Cmd-U (view source) firing inside the editor.
 *
 * Two categories are deliberately left alone, because neither is a formatting
 * or document command:
 *
 *  - Clipboard and select-all (Mod-C/X/V/A) are operating system behaviours,
 *    the ribbon has no way to replace them, and blocking them would break
 *    ordinary text entry.
 *  - Named keys — arrows, Home/End, Backspace, Delete, Enter — are navigation
 *    and text entry, and stay with ProseMirror's base keymap. The guard only
 *    ever inspects single-character keys, so these never reach it.
 */

const CLIPBOARD_KEYS = new Set(['c', 'x', 'v', 'a']);

/**
 * Rebuilds an extension with every implicit trigger removed: keyboard
 * shortcuts, markdown-style input rules (`**bold**`), and paste rules.
 *
 * Input rules matter as much as the keymap here. Word does not turn `**x**`
 * into bold text as you type, and leaving them in would be a second, quieter
 * way to format without touching the ribbon.
 *
 * `keep` retains named bindings that are text entry rather than commands —
 * Shift-Enter inserting a line break is typing, not a formatting shortcut.
 */
export function ribbonOnly<T extends AnyExtension>(extension: T, keep: string[] = []): T {
  return extension.extend({
    addKeyboardShortcuts() {
      const parent = (this as { parent?: () => Record<string, unknown> }).parent;
      const original = parent?.() ?? {};
      const retained: Record<string, unknown> = {};
      for (const key of keep) {
        if (key in original) retained[key] = original[key];
      }
      return retained as never;
    },
    addInputRules() {
      return [];
    },
    addPasteRules() {
      return [];
    },
  }) as T;
}

export const ribbonOnlyShortcutsKey = new PluginKey('ribbonOnlyShortcuts');

export const RibbonOnlyShortcuts = Extension.create({
  name: 'ribbonOnlyShortcuts',

  // Runs ahead of every other extension's keymap so nothing downstream sees the event.
  priority: 1000,

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: ribbonOnlyShortcutsKey,
        props: {
          handleKeyDown(_view, event) {
            if (!event.ctrlKey && !event.metaKey) return false;

            // Named keys (ArrowLeft, Backspace, Home) are navigation and
            // deletion, not commands; leave them to the base keymap.
            if (event.key.length !== 1) return false;

            const key = event.key.toLowerCase();
            if (CLIPBOARD_KEYS.has(key) && !event.altKey && !event.shiftKey) return false;

            event.preventDefault();
            return true;
          },
        },
      }),
    ];
  },
});
