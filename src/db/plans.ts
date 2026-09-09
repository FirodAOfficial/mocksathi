import 'server-only';
import { asc, eq } from 'drizzle-orm';
import { db } from './client';
import { subscriptionPlans, subscriptions, type NewSubscriptionPlan, type Subscription, type SubscriptionPlan } from './schema';

/**
 * Subscription plans (admin-defined) and what a given user is currently on.
 * No payment gateway exists — `subscribeUserToPlan` is the entire "purchase"
 * flow, called directly from a signed-in user's own request
 * (`POST /api/profile/subscription`) or automatically at signup for the
 * default plan. There is no money changing hands to reconcile.
 */

export async function listPlans({ activeOnly = false }: { activeOnly?: boolean } = {}): Promise<SubscriptionPlan[]> {
  const rows = await db.select().from(subscriptionPlans).orderBy(asc(subscriptionPlans.sortOrder), asc(subscriptionPlans.priceInInr));
  return activeOnly ? rows.filter((plan) => plan.isActive) : rows;
}

export async function getPlanById(id: string): Promise<SubscriptionPlan | null> {
  const [plan] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, id)).limit(1);
  return plan ?? null;
}

async function getDefaultPlan(): Promise<SubscriptionPlan | null> {
  const [plan] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.isDefault, true)).limit(1);
  return plan ?? null;
}

export async function createPlan(values: NewSubscriptionPlan): Promise<SubscriptionPlan> {
  const [created] = await db.insert(subscriptionPlans).values(values).returning();
  if (!created) throw new Error('Failed to create plan.');
  if (values.isDefault) await setDefaultPlan(created.id);
  return created;
}

export async function updatePlan(id: string, values: Partial<NewSubscriptionPlan>): Promise<SubscriptionPlan | null> {
  const [updated] = await db
    .update(subscriptionPlans)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(subscriptionPlans.id, id))
    .returning();
  if (updated?.isDefault) await setDefaultPlan(id);
  return updated ?? null;
}

/** Exactly one plan is ever the default — unset the old one first, in the same transaction. */
export async function setDefaultPlan(planId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.update(subscriptionPlans).set({ isDefault: false }).where(eq(subscriptionPlans.isDefault, true));
    await tx.update(subscriptionPlans).set({ isDefault: true }).where(eq(subscriptionPlans.id, planId));
  });
}

export interface CurrentPlan {
  plan: SubscriptionPlan;
  /** Null when the user has no `subscriptions` row — implicitly on the default plan, never having chosen one. */
  subscription: Subscription | null;
  /** False for the default/free plan, or an expired/cancelled one. */
  isSubscribed: boolean;
  /** Whole days left before `subscription.expiresAt`; null if there's no expiry (or no subscription). */
  daysRemaining: number | null;
}

/** Null only if there's no subscription row *and* no default plan has been configured yet (a fresh install, before an admin sets one up). */
export async function currentPlanForUser(userId: string): Promise<CurrentPlan | null> {
  const [row] = await db
    .select({ subscription: subscriptions, plan: subscriptionPlans })
    .from(subscriptions)
    .innerJoin(subscriptionPlans, eq(subscriptions.planId, subscriptionPlans.id))
    .where(eq(subscriptions.userId, userId))
    .limit(1);

  if (row) {
    const isExpired = row.subscription.expiresAt !== null && row.subscription.expiresAt.getTime() <= Date.now();
    const isSubscribed = !row.plan.isDefault && row.subscription.status === 'active' && !isExpired;
    const daysRemaining = row.subscription.expiresAt
      ? Math.max(0, Math.ceil((row.subscription.expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
      : null;
    return { plan: row.plan, subscription: row.subscription, isSubscribed, daysRemaining };
  }

  const defaultPlan = await getDefaultPlan();
  if (!defaultPlan) return null;
  return { plan: defaultPlan, subscription: null, isSubscribed: false, daysRemaining: null };
}

export type SubscribeResult = { ok: true } | { ok: false; code: 'NOT_FOUND' | 'INACTIVE'; detail: string };

/** The entire "purchase" flow — no payment step exists to insert one into. */
export async function subscribeUserToPlan(userId: string, planId: string): Promise<SubscribeResult> {
  const plan = await getPlanById(planId);
  if (!plan) return { ok: false, code: 'NOT_FOUND', detail: 'No such plan.' };
  if (!plan.isActive) return { ok: false, code: 'INACTIVE', detail: 'This plan is no longer available.' };

  const now = new Date();
  const expiresAt = plan.durationDays ? new Date(now.getTime() + plan.durationDays * 24 * 60 * 60 * 1000) : null;

  await db
    .insert(subscriptions)
    .values({ userId, planId, status: 'active', startedAt: now, expiresAt })
    .onConflictDoUpdate({
      target: subscriptions.userId,
      set: { planId, status: 'active', startedAt: now, expiresAt, updatedAt: now },
    });

  return { ok: true };
}

/** Best-effort: called from signup. A signup should never fail because the default plan isn't configured yet. */
export async function subscribeUserToDefaultPlan(userId: string): Promise<void> {
  const defaultPlan = await getDefaultPlan();
  if (!defaultPlan) return;
  await subscribeUserToPlan(userId, defaultPlan.id);
}
