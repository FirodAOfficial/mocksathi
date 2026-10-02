import { describe, expect, it } from 'vitest';
import {
  THEME_ATTRIBUTE,
  THEME_STORAGE_KEY,
  applyTheme,
  isTheme,
  readStoredTheme,
  storeTheme,
  themeBootScript,
} from './theme';

function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    has: (k: string) => map.has(k),
  };
}

/** Storage that throws on every access, as a private window can. */
const hostileStorage = {
  getItem() {
    throw new DOMException('denied', 'SecurityError');
  },
  setItem() {
    throw new DOMException('denied', 'SecurityError');
  },
  removeItem() {
    throw new DOMException('denied', 'SecurityError');
  },
};

describe('isTheme', () => {
  it('accepts only the three values', () => {
    expect(isTheme('system')).toBe(true);
    expect(isTheme('light')).toBe(true);
    expect(isTheme('dark')).toBe(true);
    expect(isTheme('Dark')).toBe(false);
    expect(isTheme('')).toBe(false);
    expect(isTheme(null)).toBe(false);
  });
});

describe('applyTheme', () => {
  it('sets the attribute for an explicit choice', () => {
    const root = document.createElement('html');
    applyTheme(root, 'dark');
    expect(root.getAttribute(THEME_ATTRIBUTE)).toBe('dark');
    applyTheme(root, 'light');
    expect(root.getAttribute(THEME_ATTRIBUTE)).toBe('light');
  });

  it('removes the attribute for system, rather than setting a third value', () => {
    // The stylesheet keys on `:root:not([data-theme='light'])`; a
    // `data-theme="system"` is a value no rule matches.
    const root = document.createElement('html');
    applyTheme(root, 'dark');
    applyTheme(root, 'system');
    expect(root.hasAttribute(THEME_ATTRIBUTE)).toBe(false);
  });

  it('is idempotent, so re-applying on a storage event writes nothing new', () => {
    const root = document.createElement('html');
    applyTheme(root, 'dark');
    applyTheme(root, 'dark');
    expect(root.getAttribute(THEME_ATTRIBUTE)).toBe('dark');
  });
});

describe('readStoredTheme', () => {
  it('reads a stored choice', () => {
    expect(readStoredTheme(fakeStorage({ [THEME_STORAGE_KEY]: 'dark' }))).toBe('dark');
  });

  it('falls back to system for nothing stored, rubbish, or no storage at all', () => {
    expect(readStoredTheme(fakeStorage())).toBe('system');
    expect(readStoredTheme(fakeStorage({ [THEME_STORAGE_KEY]: 'neon' }))).toBe('system');
    expect(readStoredTheme(null)).toBe('system');
  });

  it('falls back to system when reading throws', () => {
    expect(readStoredTheme(hostileStorage)).toBe('system');
  });
});

describe('storeTheme', () => {
  it('writes an explicit choice', () => {
    const storage = fakeStorage();
    storeTheme(storage, 'light');
    expect(readStoredTheme(storage)).toBe('light');
  });

  it('stores system as the absence of a preference', () => {
    const storage = fakeStorage({ [THEME_STORAGE_KEY]: 'dark' });
    storeTheme(storage, 'system');
    expect(storage.has(THEME_STORAGE_KEY)).toBe(false);
  });

  it('does not throw when storage does', () => {
    expect(() => storeTheme(hostileStorage, 'dark')).not.toThrow();
  });
});

describe('themeBootScript', () => {
  it('applies a stored dark choice to a document element', () => {
    const root = document.createElement('html');
    const calls: string[] = [];
    const sandbox = {
      localStorage: { getItem: (k: string) => (calls.push(k), 'dark') },
      document: { documentElement: root },
    };
    new Function('localStorage', 'document', themeBootScript())(
      sandbox.localStorage,
      sandbox.document,
    );
    expect(calls).toEqual([THEME_STORAGE_KEY]);
    expect(root.getAttribute(THEME_ATTRIBUTE)).toBe('dark');
  });

  it('leaves the attribute alone for system, so prefers-color-scheme still wins', () => {
    const root = document.createElement('html');
    new Function('localStorage', 'document', themeBootScript())(
      { getItem: () => null },
      { documentElement: root },
    );
    expect(root.hasAttribute(THEME_ATTRIBUTE)).toBe(false);
  });

  it('ignores a value that is not one of ours', () => {
    const root = document.createElement('html');
    new Function('localStorage', 'document', themeBootScript())(
      { getItem: () => 'system' },
      { documentElement: root },
    );
    expect(root.hasAttribute(THEME_ATTRIBUTE)).toBe(false);
  });

  it('survives storage that throws, rather than breaking the page it runs in', () => {
    const root = document.createElement('html');
    expect(() =>
      new Function('localStorage', 'document', themeBootScript())(
        {
          getItem() {
            throw new Error('blocked');
          },
        },
        { documentElement: root },
      ),
    ).not.toThrow();
    expect(root.hasAttribute(THEME_ATTRIBUTE)).toBe(false);
  });
});
