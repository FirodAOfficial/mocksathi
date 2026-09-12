import Link from 'next/link';
import type { MockSummary } from '@/dashboard/types';
import { DashboardIcon } from './icons/DashboardIcon';
import styles from './TodaysMockCard.module.css';

export interface TodaysMockCardProps {
  /**
   * The paper `/exam` would open — the oldest published test of its type.
   *
   * Null when nothing has been published, and the card then renders nothing
   * rather than naming a paper that does not exist. It used to show a fixture
   * mock number, which sat above a list of real papers claiming to be a
   * nineteenth one.
   */
  mock: MockSummary | null;
}

/**
 * A standalone way to open today's mock from the All Mocks page — optional,
 * not a required sidebar destination (that nav item, with its "1" badge,
 * read as a mandatory task; removed in favour of this).
 */
export function TodaysMockCard({ mock }: TodaysMockCardProps) {
  if (!mock) return null;

  return (
    <div className={styles.card}>
      <div className={styles.info}>
        <div className={styles.iconRing}>
          <DashboardIcon name="file-check-2" size={20} />
        </div>
        <div>
          <p className={styles.label}>Today&apos;s mock</p>
          <p className={styles.name}>{mock.paperName}</p>
        </div>
      </div>
      <Link href="/dashboard/today" className={styles.cta}>
        Read the instructions
        <DashboardIcon name="arrow-right" size={15} />
      </Link>
    </div>
  );
}
