/**
 * The colour-scheme preference.
 *
 * Three values, not two. `tokens.css` already paints a dark scheme from
 * `prefers-color-scheme`, so "follow the system" is the behaviour the product
 * has today — a two-state light/dark switch would take it away, and a user who
 * has their laptop set to go dark at sunset would have to come back here twice
 * a day. `system` is therefore the default and a first-class choice, and the
 * attribute is only written when the user has actually overridden it.
 *
 * Nothing here touches the DOM or the clock beyond what it is handed, so it is
 * all reachable from a test.
 */
export const THEME_ATTRIBUTE = 'data-theme';
export const THEME_STORAGE_KEY = 'mocksathi:theme';

export const THEMES = ['system', 'light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];

export function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && (THEMES as readonly string[]).includes(value);
}

/**
 * Write the choice onto the document element.
 *
 * `system` *removes* the attribute rather than setting a third value, because
 * that is what the stylesheet's `@media (prefers-color-scheme: dark)` block
 * keys on: it applies to `:root:not([data-theme='light'])`. Leaving a
 * `data-theme="system"` behind would be a value no rule matches.
 */
export function applyTheme(root: Element, theme: Theme): void {
  if (theme === 'system') root.removeAttribute(THEME_ATTRIBUTE);
  else root.setAttribute(THEME_ATTRIBUTE, theme);
}

/**
 * Storage access that cannot throw.
 *
 * `localStorage` is not merely empty in a private window or with site data
 * blocked — reading the property itself throws a SecurityError in some
 * browsers. An unreadable preference is not an error worth surfacing; it just
 * means the system default applies.
 */
export function readStoredTheme(storage: Pick<Storage, 'getItem'> | null | undefined): Theme {
  try {
    const stored = storage?.getItem(THEME_STORAGE_KEY);
    return isTheme(stored) ? stored : 'system';
  } catch {
    return 'system';
  }
}

export function storeTheme(storage: Pick<Storage, 'setItem' | 'removeItem'> | null | undefined, theme: Theme): void {
  try {
    // `system` is the default, so it is stored as the absence of a preference.
    // That way a user who picks it back is not pinned to today's default if the
    // product's default ever changes.
    if (theme === 'system') storage?.removeItem(THEME_STORAGE_KEY);
    else storage?.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Same reasoning as the read: the choice still applies to this page, it
    // just will not outlive it.
  }
}

export const THEME_LABELS: Record<Theme, string> = {
  system: 'System',
  light: 'Light',
  dark: 'Dark',
};

/**
 * The script that runs before the page paints.
 *
 * Built from the same constants the rest of this module uses, so the key and
 * the attribute cannot drift apart. It is deliberately tiny and synchronous:
 * anything asynchronous here means the page paints in the wrong scheme first
 * and corrects itself, which is the flash this exists to prevent.
 */
export function themeBootScript(): string {
  return (
    `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});` +
    `if(t==="light"||t==="dark"){document.documentElement.setAttribute(${JSON.stringify(THEME_ATTRIBUTE)},t)}}catch(e){}})()`
  );
}
