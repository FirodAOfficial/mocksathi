import Link from 'next/link';
import type { SubscriptionPlan } from '@/db/schema';
import styles from './PlansListScreen.module.css';

export interface PlansListScreenProps {
  plans: SubscriptionPlan[];
}

function formatPrice(priceInInr: number): string {
  return priceInInr === 0 ? 'Free' : `₹${priceInInr.toLocaleString('en-IN')}`;
}

/** Admin-only: every subscription plan, real data — the terms a candidate sees on `/dashboard/subscription`. */
export function PlansListScreen({ plans }: PlansListScreenProps) {
  return (
    <>
      <div className={styles.header}>
        <div className={styles.headerText}>
          <h1 className={styles.title}>Manage Plans</h1>
          <p className={styles.subtitle}>{plans.length} plan{plans.length === 1 ? '' : 's'} defined.</p>
        </div>
        <Link href="/dashboard/admin/plans/new" className={styles.addButton}>
          + Add plan
        </Link>
      </div>

      <div className={styles.card}>
        {plans.length === 0 ? (
          <p className={styles.empty}>No plans yet — add one (a free/default plan first is usual).</p>
        ) : (
          <div className={styles.table}>
            <div className={styles.headRow}>
              <span>Name</span>
              <span>Price</span>
              <span>Duration</span>
              <span>Mock limit</span>
              <span>Flags</span>
              <span />
            </div>
            {plans.map((plan) => (
              <div className={styles.row} key={plan.id}>
                <span className={styles.name}>{plan.name}</span>
                <span className={styles.mono}>{formatPrice(plan.priceInInr)}</span>
                <span className={styles.muted}>{plan.durationDays ? `${plan.durationDays} days` : 'No expiry'}</span>
                <span className={styles.muted}>{plan.mockLimit ?? 'Unlimited'}</span>
                <span className={styles.badges}>
                  {plan.isDefault && <span className={styles.badgeDefault}>Default</span>}
                  {plan.isPopular && <span className={styles.badgePopular}>Popular</span>}
                  {!plan.isActive && <span className={styles.badgeInactive}>Inactive</span>}
                </span>
                <Link href={`/dashboard/admin/plans/${plan.id}/edit`} className={styles.editLink}>
                  Edit
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
