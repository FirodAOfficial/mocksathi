import type { MockSummary } from './types';

/**
 * Where starting a mock takes the candidate.
 *
 * One owner for the mapping because the Today's Mock screen offers the choice
 * twice — with the destination inlined at each call site, unlocking the Excel
 * paper meant several places had to agree, and the ones that were missed sent
 * a candidate to the Word editor for an Excel paper.
 *
 * Both skills go to `/exam`, not straight into an editor: the instructions
 * page is where the language is chosen and where the clock has not started yet.
 *
 * A mixed revision paper has no single paper to open, so it goes to the
 * Today's Mock screen, which offers both.
 *
 * **Only Today's Mock uses this now.** The mock *tables* list real published
 * papers (`publishedTestRows`) but deliberately offer no way to open them: a
 * row has no scheduled sitting behind it, so every Start button would open
 * whatever `/exam` resolves to — the same paper for every row. Buttons that
 * all do one thing are worse than none. Giving each row its own sitting is the
 * next phase; see `sdd/test-authoring.md`.
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
