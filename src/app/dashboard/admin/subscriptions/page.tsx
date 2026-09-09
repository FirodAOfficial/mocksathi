import { requireAdmin } from '@/auth/cookies';
import { SubscriptionsScreen } from '@/components/dashboard/admin/SubscriptionsScreen';
import { paginatedUsersWithSubscription, subscriptionSummary, type SubscriptionFilter } from '@/db/subscriptions';

const PAGE_SIZE = 10;

function isSubscriptionFilter(value: unknown): value is SubscriptionFilter {
  return value === 'all' || value === 'subscribed' || value === 'unsubscribed';
}

export default async function SubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const params = await searchParams;

  const rawFilter = Array.isArray(params.filter) ? params.filter[0] : params.filter;
  const filter = isSubscriptionFilter(rawFilter) ? rawFilter : 'all';

  const rawPage = Array.isArray(params.page) ? params.page[0] : params.page;
  const requestedPage = Number.parseInt(rawPage ?? '1', 10);
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  const [summary, usersPage] = await Promise.all([
    subscriptionSummary(),
    paginatedUsersWithSubscription({ page, pageSize: PAGE_SIZE, filter }),
  ]);

  // A page number past the end (e.g. from a stale link after data changed) clamps
  // to the last real page rather than rendering an empty table with a confusing count.
  const clampedPage = Math.min(page, usersPage.totalPages);
  const finalPage =
    clampedPage === page ? usersPage : await paginatedUsersWithSubscription({ page: clampedPage, pageSize: PAGE_SIZE, filter });

  return (
    <SubscriptionsScreen
      summary={summary}
      rows={finalPage.rows}
      totalCount={finalPage.totalCount}
      totalPages={finalPage.totalPages}
      page={clampedPage}
      filter={filter}
    />
  );
}
