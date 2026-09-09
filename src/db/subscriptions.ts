import 'server-only';
import { count, desc, eq, sql } from 'drizzle-orm';
import { db } from './client';
import { subscriptionPlans, subscriptions, users, type SubscriptionStatus, type UserRole } from './schema';

/**
 * Admin subscriptions report (`/dashboard/admin/subscriptions`) — read-only.
 * The only writes to `subscriptions` go through `src/db/plans.ts`
 * (`subscribeUserToPlan`), called from the user's own signed-in request —
 * there's nothing here to gate beyond the report page itself reading it.
 */

export type SubscriptionFilter = 'all' | 'subscribed' | 'unsubscribed';

/**
 * "Currently subscribed": on a non-default plan, `active`, and not expired.
 * `COALESCE` matters here — a user with no `subscriptions` row at all makes
 * the raw comparison `NULL`, which a bare `WHERE` would silently exclude
 * from *both* the subscribed and unsubscribed filters instead of correctly
 * landing them in "unsubscribed".
 */
const IS_ACTIVE = sql<boolean>`coalesce(
  ${subscriptionPlans.isDefault} = false
  and ${subscriptions.status} = 'active'
  and (${subscriptions.expiresAt} is null or ${subscriptions.expiresAt} > now()),
  false
)`;

export interface SubscriptionSummary {
  totalUsers: number;
  activeSubscriptions: number;
  notSubscribed: number;
}

export async function subscriptionSummary(): Promise<SubscriptionSummary> {
  const [totals] = await db
    .select({
      totalUsers: count(),
      activeSubscriptions: sql<number>`count(*) filter (where ${IS_ACTIVE})`,
    })
    .from(users)
    .leftJoin(subscriptions, eq(subscriptions.userId, users.id))
    .leftJoin(subscriptionPlans, eq(subscriptions.planId, subscriptionPlans.id));

  const totalUsers = totals?.totalUsers ?? 0;
  const activeSubscriptions = Number(totals?.activeSubscriptions ?? 0);
  return { totalUsers, activeSubscriptions, notSubscribed: totalUsers - activeSubscriptions };
}

export interface SubscriptionRow {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  memberSince: Date;
  plan: string | null;
  status: SubscriptionStatus | null;
  expiresAt: Date | null;
  isActive: boolean;
}

export interface SubscriptionsPage {
  rows: SubscriptionRow[];
  totalCount: number;
  totalPages: number;
}

export interface PaginatedUsersQuery {
  page: number;
  pageSize: number;
  filter: SubscriptionFilter;
}

export async function paginatedUsersWithSubscription({
  page,
  pageSize,
  filter,
}: PaginatedUsersQuery): Promise<SubscriptionsPage> {
  const whereClause = filter === 'subscribed' ? IS_ACTIVE : filter === 'unsubscribed' ? sql`not (${IS_ACTIVE})` : undefined;

  const [rows, [totalRow]] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        memberSince: users.createdAt,
        plan: subscriptionPlans.name,
        status: subscriptions.status,
        expiresAt: subscriptions.expiresAt,
        isActive: IS_ACTIVE,
      })
      .from(users)
      .leftJoin(subscriptions, eq(subscriptions.userId, users.id))
      .leftJoin(subscriptionPlans, eq(subscriptions.planId, subscriptionPlans.id))
      .where(whereClause)
      .orderBy(desc(users.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ total: count() })
      .from(users)
      .leftJoin(subscriptions, eq(subscriptions.userId, users.id))
      .leftJoin(subscriptionPlans, eq(subscriptions.planId, subscriptionPlans.id))
      .where(whereClause),
  ]);

  const totalCount = totalRow?.total ?? 0;
  return { rows, totalCount, totalPages: Math.max(1, Math.ceil(totalCount / pageSize)) };
}
