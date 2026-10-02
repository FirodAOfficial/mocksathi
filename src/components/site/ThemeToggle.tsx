'use client';

import { useId, useSyncExternalStore } from 'react';
import {
  applyTheme,
  readStoredTheme,
  storeTheme,
  THEMES,
  THEME_LABELS,
  type Theme,
} from '@/theme/theme';
import styles from './ThemeToggle.module.css';

/*
 * The preference is not React state. It lives in `localStorage` and on the
 * document element, it is written before React exists (`ThemeScript`), and a
 * second tab can change it. That is an external store, so the component
 * subscribes to it rather than holding a copy — which also means there is no
 * effect copying storage into state on mount, and no window where the two
 * disagree.
 */
const THEME_CHANGED = 'mocksathi:themechange';

function subscribe(onChange: () => void) {
  function handle() {
    /*
     * Repaint this tab's document before telling React. A `storage` event is
     * the *other* tab saying the preference changed; nothing else would move
     * this document's attribute, so the two tabs would agree on the value and
     * disagree on the colours. `applyTheme` is idempotent, so the ordinary
     * case writes nothing.
     *
     * It belongs here rather than in `getSnapshot`, which React may call
     * during a render it then throws away — and which must stay pure.
     */
    applyTheme(document.documentElement, readStoredTheme(window.localStorage));
    onChange();
  }

  // `storage` fires only in the OTHER tabs, so this tab needs its own event to
  // notice its own write.
  window.addEventListener('storage', handle);
  window.addEventListener(THEME_CHANGED, handle);
  return () => {
    window.removeEventListener('storage', handle);
    window.removeEventListener(THEME_CHANGED, handle);
  };
}

function getSnapshot(): Theme {
  return readStoredTheme(window.localStorage);
}

/*
 * The server has no storage, and neither does the client's first render — see
 * the hydration note below. Both say `system`.
 */
function getServerSnapshot(): Theme {
  return 'system';
}

/**
 * Light / dark / system, as three radios in a group.
 *
 * Real `<input type="radio">`s rather than buttons with `role="radio"`: the
 * browser then gives arrow-key movement, a single tab stop for the whole
 * group, and the "exactly one of these is chosen" semantics for free.
 *
 * Three options, not two. `tokens.css` paints a dark scheme from
 * `prefers-color-scheme`, so following the system is what the product does
 * today; a plain light/dark switch would remove that, and someone whose
 * laptop turns dark at sunset would be back here twice a day.
 *
 * On the very first client render this reports `system` whatever is stored,
 * because that is what the server rendered and disagreeing with it is a
 * hydration error. The page itself is already painted in the right scheme by
 * then — `ThemeScript` set the attribute before anything rendered — so what
 * corrects a frame later is only which segment looks selected.
 */
export interface ThemeToggleProps {
  /**
   * Which surface it sits on. `page` is the default light/dark page; `onDark`
   * is the navy footer band, which keeps its own palette in both schemes and
   * so needs the control drawn from that palette rather than the page's.
   */
  tone?: 'page' | 'onDark';
  /**
   * Icons only, labels kept for screen readers.
   *
   * For the sign-in and sign-up footnote, which is one slim row by design: the
   * labelled control is 242px wide and wrapped it onto a third line, turning
   * the footnote back into the second card it was written not to be.
   */
  compact?: boolean;
}

export function ThemeToggle({ tone = 'page', compact = false }: ThemeToggleProps) {
  const groupName = useId();
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function choose(next: Theme) {
    applyTheme(document.documentElement, next);
    storeTheme(window.localStorage, next);
    window.dispatchEvent(new Event(THEME_CHANGED));
  }

  return (
    <fieldset
      className={[styles.group, tone === 'onDark' ? styles.onDark : '', compact ? styles.compact : '']
        .filter(Boolean)
        .join(' ')}
    >
      {/* The group needs a name for a screen reader; the three labels on their
          own would be read as three unrelated options. */}
      <legend className={styles.legend}>Colour scheme</legend>

      {THEMES.map((value) => (
        <label key={value} className={styles.option}>
          <input
            type="radio"
            name={groupName}
            value={value}
            checked={theme === value}
            onChange={() => choose(value)}
            className={styles.input}
          />
          {/* `title` for a mouse, the label text for everything else: in the
              compact variant it is clipped, not removed, so it still names the
              radio. */}
          <span className={styles.segment} title={compact ? THEME_LABELS[value] : undefined}>
            <ThemeIcon theme={value} />
            <span className={styles.label}>{THEME_LABELS[value]}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}

/**
 * Three 16px glyphs, local to this control.
 *
 * `aria-hidden`, because the label beside each one already says what it is —
 * and it stays a visible label rather than a tooltip, since a sun and a moon
 * are only obvious once you already know what the control does.
 */
function ThemeIcon({ theme }: { theme: Theme }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    focusable: false,
  };

  if (theme === 'light') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    );
  }

  if (theme === 'dark') {
    return (
      <svg {...common}>
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <rect x="2" y="4" width="20" height="13" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}
