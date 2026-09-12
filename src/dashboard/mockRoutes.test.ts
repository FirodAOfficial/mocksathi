import { describe, expect, it } from 'vitest';
import { startHrefFor } from './mockRoutes';

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
