import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { THEME_ATTRIBUTE, THEME_STORAGE_KEY } from '@/theme/theme';
import { ThemeToggle } from './ThemeToggle';

afterEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute(THEME_ATTRIBUTE);
});

describe('ThemeToggle', () => {
  it('is one radio group of three, so a screen reader hears them as alternatives', () => {
    render(<ThemeToggle />);
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(3);
    expect(screen.getByRole('group', { name: 'Colour scheme' })).toBeInTheDocument();
  });

  it('starts on System when nothing is stored', () => {
    render(<ThemeToggle />);
    expect(screen.getByRole('radio', { name: /system/i })).toBeChecked();
  });

  it('writes the attribute and the preference when dark is chosen', async () => {
    render(<ThemeToggle />);
    await userEvent.click(screen.getByRole('radio', { name: /dark/i }));

    expect(document.documentElement.getAttribute(THEME_ATTRIBUTE)).toBe('dark');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(screen.getByRole('radio', { name: /dark/i })).toBeChecked();
  });

  it('clears both when System is chosen again, handing the page back to the OS', async () => {
    render(<ThemeToggle />);
    await userEvent.click(screen.getByRole('radio', { name: /dark/i }));
    await userEvent.click(screen.getByRole('radio', { name: /system/i }));

    expect(document.documentElement.hasAttribute(THEME_ATTRIBUTE)).toBe(false);
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });

  it('follows a change made in another tab', async () => {
    render(<ThemeToggle />);
    window.localStorage.setItem(THEME_STORAGE_KEY, 'light');
    // What the browser dispatches in the OTHER tabs after a write.
    window.dispatchEvent(new StorageEvent('storage', { key: THEME_STORAGE_KEY, newValue: 'light' }));

    expect(await screen.findByRole('radio', { name: /light/i })).toBeChecked();
    expect(document.documentElement.getAttribute(THEME_ATTRIBUTE)).toBe('light');
  });

  it('reaches every option from the keyboard as one tab stop', async () => {
    render(<ThemeToggle />);
    await userEvent.tab();

    // Focus lands on the group's checked radio, and the arrows move within it.
    expect(screen.getByRole('radio', { name: /system/i })).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: /light/i })).toBeChecked();
  });
});
