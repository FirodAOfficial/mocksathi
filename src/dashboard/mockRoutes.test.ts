import { describe, expect, it } from 'vitest';
import { startHrefFor } from './mockRoutes';

/**
 * `startHrefFor` is now used only by the Today's Mock screen — the mock tables
 * show their rows as data with no way to open them, because a fixture mock has
 * no `tests` row behind it (`src/dashboard/mockRoutes.ts`). What it maps is
 * unchanged, so this still holds it to the mapping.
 */
describe('startHrefFor', () => {
  it('sends each skill to its own paper', () => {
    // Both land on the instructions, not straight into an editor: the clock
    // starts when the paper opens, and it must not start while someone is
    // still reading the rules.
    expect(startHrefFor({ mockType: 'word' })).toBe('/exam');
    expect(startHrefFor({ mockType: 'excel' })).toBe('/exam?subject=excel');
  });

  it('sends a mixed revision paper to the screen that offers both', () => {
    expect(startHrefFor({ mockType: 'mixed' })).toBe('/dashboard/today');
  });
});
