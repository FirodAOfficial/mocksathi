import Link from 'next/link';
import headerStyles from '@/components/dashboard/AnalysisScreen.module.css';
import type { SubscriptionFilter, SubscriptionRow, SubscriptionSummary } from '@/db/subscriptions';
import styles from './SubscriptionsScreen.module.css';

export interface SubscriptionsScreenProps {
  summary: SubscriptionSummary;
  rows: SubscriptionRow[];
  totalCount: number;
  totalPages: number;
  page: number;
  filter: SubscriptionFilter;
}

const FILTERS: { value: SubscriptionFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'subscribed', label: 'Subscribed' },
  { value: 'unsubscribed', label: 'Not subscribed' },
];

function formatDate(value: Date | null): string {
  if (!value) return '—';
  return value.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function hrefFor(filter: SubscriptionFilter, page: number): string {
  return `/dashboard/admin/subscriptions?filter=${filter}&page=${page}`;
}

/** Admin-only, read-only report: how many users are subscribed, and who they are. No write path — see `src/db/schema.ts`'s `subscriptions` table comment. */
export function SubscriptionsScreen({ summary, rows, totalCount, totalPages, page, filter }: SubscriptionsScreenProps) {
  return (
    <>
      <div className={headerStyles.header}>
        <h1 className={headerStyles.title}>Subscriptions</h1>
        <p className={headerStyles.subtitle}>Active subscriptions and every registered user.</p>
      </div>

      <div className={styles.statsRow}>
        <div className={styles.statTile}>
          <div className={styles.statLabel}>Total users</div>
          <div className={styles.statValue}>{summary.totalUsers.toLocaleString('en-IN')}</div>
        </div>
        <div className={styles.statTile}>
          <div className={styles.statLabel}>Active subscriptions</div>
          <div className={styles.statValueAccent}>{summary.activeSubscriptions.toLocaleString('en-IN')}</div>
        </div>
        <div className={styles.statTile}>
          <div className={styles.statLabel}>Not subscribed</div>
          <div className={styles.statValue}>{summary.notSubscribed.toLocaleString('en-IN')}</div>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <p className={styles.cardTitle}>
            Users <span className={styles.muted}>({totalCount.toLocaleString('en-IN')})</span>
          </p>
          <div className={styles.filterPills}>
            {FILTERS.map((option) => (
              <Link
                key={option.value}
                href={hrefFor(option.value, 1)}
                className={option.value === filter ? styles.filterPillActive : styles.filterPill}
              >
                {option.label}
              </Link>
            ))}
          </div>
        </div>

        {rows.length === 0 ? (
          <p className={styles.empty}>No users match this filter.</p>
        ) : (
          <div className={styles.table}>
            <div className={styles.headRow}>
              <span>Name</span>
              <span>Email</span>
              <span>Role</span>
              <span>Plan</span>
              <span>Status</span>
              <span>Expires</span>
            </div>
            {rows.map((row) => (
              <div className={styles.row} key={row.id}>
                <span className={styles.name}>{row.name}</span>
                <span className={styles.muted}>{row.email}</span>
                <span>
                  <span className={styles.roleBadge}>{row.role}</span>
                </span>
                <span>{row.plan ?? '—'}</span>
                <span>
                  <span className={row.isActive ? styles.statusActive : styles.statusInactive}>
                    {row.isActive ? 'Subscribed' : (row.status ?? 'Not subscribed')}
                  </span>
                </span>
                <span className={styles.muted}>{formatDate(row.expiresAt)}</span>
              </div>
            ))}
          </div>
        )}

        <div className={styles.pagination}>
          <span>
            Page {page} of {totalPages}
          </span>
          <div className={styles.pageLinks}>
            <Link
              href={hrefFor(filter, Math.max(1, page - 1))}
              className={page <= 1 ? styles.pageLinkDisabled : styles.pageLink}
            >
              ← Previous
            </Link>
            <Link
              href={hrefFor(filter, Math.min(totalPages, page + 1))}
              className={page >= totalPages ? styles.pageLinkDisabled : styles.pageLink}
            >
              Next →
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
