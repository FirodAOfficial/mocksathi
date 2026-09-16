import { requireUser } from '@/auth/cookies';
import { MocksTable } from '@/components/dashboard/MocksTable';
import { TodaysMockCard } from '@/components/dashboard/TodaysMockCard';
import { publishedTestRows } from '@/db/tests';

/**
 * Every paper an admin has published, as data.
 *
 * Real rows from `tests`, not the thirty fixture mocks this list used to show.
 * `publishedTestRows` is given the signed-in candidate's id so each row also
 * carries their own latest score once they have sat it (`test_attempts`,
 * `src/db/attempts.ts`) — that is what turns a row's action from "Start" into
 * "View Submission".
 */
export default async function AllMocksPage() {
  const user = await requireUser();
  const mocks = await publishedTestRows(user.id);

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
