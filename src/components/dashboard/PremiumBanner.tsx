import Link from 'next/link';
import { DashboardIcon } from './icons/DashboardIcon';
import styles from './PremiumBanner.module.css';

export interface PremiumBannerProps {
  mocksUsed: number;
  /** Null means unlimited on the free tier — the banner isn't shown at all in that case (see `DashboardScreen`). */
  mockLimit: number | null;
}

/**
 * The free-tier upsell strip at the bottom of the dashboard home. Only
 * rendered for a signed-in user who isn't subscribed (`DashboardScreen`
 * decides that) — the reference mockup's "Unlock 365 Mocks" headline isn't
 * used here since this app only has 30 fixture mocks today, not 365; the copy
 * below stays honest about actual free-tier usage instead (same principle as
 * the login redesign dropping unverifiable claims, `sdd/auth.md`).
 */
export function PremiumBanner({ mocksUsed, mockLimit }: PremiumBannerProps) {
  return (
    <div className={styles.banner}>
      <div className={styles.iconBadge}>
        <DashboardIcon name="star" size={20} />
      </div>
      <div className={styles.text}>
        <p className={styles.title}>Unlock Full Access with Mocksathi Premium</p>
        <p className={styles.detail}>
          {mockLimit !== null
            ? `You've used ${mocksUsed} of ${mockLimit} free mocks. `
            : ''}
          Upgrade now for unlimited mocks, detailed analysis, and more.
        </p>
      </div>
      <Link href="/dashboard/subscription" className={styles.cta}>
        Upgrade Now
        <DashboardIcon name="arrow-right" size={14} />
      </Link>
    </div>
  );
}
