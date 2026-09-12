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
 * A row that names a `tests` row opens **that** paper, by slug. Every other
 * row falls back to whichever paper `/exam` resolves to for its skill, which is
 * all a fixture mock can do — it stands for nothing in particular.
 *
 * **Any signed-in candidate may open any published paper.** There is no
 * entitlement check here, and deliberately none anywhere else either: who may
 * sit what is a product rule nobody has written yet, and a guess at one would
 * be a rule to unpick rather than a head start. `requireUser()` on the exam
 * routes is the whole of the access control today.
 */
export function startHrefFor(mock: Pick<MockSummary, 'mockType' | 'testSlug'>): string {
  if (mock.testSlug) {
    // The subject rides along so a stale slug still lands on the right skill's
    // fallback paper rather than the Word one by default.
    const subject = mock.mockType === 'excel' ? 'excel' : 'word';
    return `/exam?subject=${subject}&test=${encodeURIComponent(mock.testSlug)}`;
  }

  switch (mock.mockType) {
    case 'word':
      return '/exam';
    case 'excel':
      return '/exam?subject=excel';
    default:
      return '/dashboard/today';
  }
}
