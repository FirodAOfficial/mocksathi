import type { MockSummary } from './types';

/**
 * Where starting a mock takes the candidate.
 *
 * One owner for the mapping because two tables render a Start button and the
 * Today's Mock screen renders the same choice again — with the destination
 * inlined at each call site, unlocking the Excel paper meant three places had
 * to agree, and the ones that were missed sent a candidate to the Word editor
 * for an Excel paper.
 *
 * Both skills go to `/exam`, not straight into an editor: the instructions
 * page is where the language is chosen and where the clock has not started yet.
 *
 * A mixed revision paper has no single paper to open, so it goes to the
 * Today's Mock screen, which offers both.
 */
export function startHrefFor(mock: Pick<MockSummary, 'mockType'>): string {
  switch (mock.mockType) {
    case 'word':
      return '/exam';
    case 'excel':
      return '/exam?subject=excel';
    default:
      return '/dashboard/today';
  }
}
