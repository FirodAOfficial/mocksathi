import { requireUser } from '@/auth/cookies';
import { MocksTable } from '@/components/dashboard/MocksTable';
import { TodaysMockCard } from '@/components/dashboard/TodaysMockCard';
import { publishedTestRows } from '@/db/tests';

/**
 * Every paper an admin has published, as data.
 *
 * Real rows from `tests`, not the thirty fixture mocks this list used to show.
 * They are deliberately not openable from here: a row has no scheduled sitting
 * behind it yet, so "Start" would mean something different per row that nothing
 * can currently express. `/dashboard/today` is where a paper is opened, and
 * linking a row to its own sitting is the next phase (`sdd/test-authoring.md`).
 */
export default async function AllMocksPage() {
  await requireUser();
  const mocks = await publishedTestRows();

  // The first Word paper is what `/exam` serves as today's, so the card names
  // that one rather than a fixture mock number.
  const todays = mocks.find((mock) => mock.mockType === 'word') ?? mocks[0] ?? null;

  return (
    <>
      <TodaysMockCard mock={todays} />
      <MocksTable
        heading={mocks.length === 0 ? 'All Mocks' : `All Mocks (${mocks.length})`}
        mocks={mocks}
        emptyNote="No papers published yet. An admin writes them in Test Enigma."
      />
    </>
  );
}
