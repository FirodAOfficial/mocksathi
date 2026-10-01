import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DRAWER_QUERY, ROTATE_QUERY } from '@/hooks/useMediaQuery';
import { RotateGate } from './RotateGate';

/**
 * The gate is the one place a layout decision is a visible request to the
 * candidate rather than a stylesheet, so it is worth a test: it has to appear
 * only on an upright phone, and it has to be possible to get past.
 */

/** Reports `matches: true` for the queries named and false for every other. */
function viewport(...matching: string[]): void {
  window.matchMedia = ((query: string) =>
    ({
      matches: matching.includes(query),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList) as typeof window.matchMedia;
}

const realMatchMedia = window.matchMedia;

afterEach(() => {
  window.matchMedia = realMatchMedia;
  cleanup();
  vi.restoreAllMocks();
});

describe('RotateGate', () => {
  it('asks for the rotation on an upright phone', () => {
    viewport(ROTATE_QUERY, DRAWER_QUERY);
    render(<RotateGate />);

    expect(screen.getByRole('dialog', { name: /turn your phone sideways/i })).toBeTruthy();
  });

  it('stays out of the way once the screen is wide enough for the columns', () => {
    viewport();
    render(<RotateGate />);

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  /*
   * A phone whose orientation is locked at the operating system level cannot
   * rotate, and that candidate must still be able to sit the paper. Without
   * this the gate is a wall.
   */
  it('can be dismissed, leaving the drawer layout underneath', async () => {
    viewport(ROTATE_QUERY, DRAWER_QUERY);
    render(<RotateGate />);

    await userEvent.click(screen.getByRole('button', { name: /continue in portrait/i }));

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  /*
   * `requestFullscreen` and `ScreenOrientation.lock` are both absent in jsdom,
   * and absent on iOS Safari. Neither may surface as an unhandled rejection.
   */
  it('survives a browser that cannot turn the screen', async () => {
    viewport(ROTATE_QUERY, DRAWER_QUERY);
    render(<RotateGate />);

    await userEvent.click(screen.getByRole('button', { name: /rotate to landscape/i }));

    expect(screen.getByRole('dialog')).toBeTruthy();
  });
});
