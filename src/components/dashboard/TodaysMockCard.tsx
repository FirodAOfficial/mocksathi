import Link from 'next/link';
import type { MockSummary } from '@/dashboard/types';
import { DashboardIcon } from './icons/DashboardIcon';
import styles from './TodaysMockCard.module.css';

export interface TodaysMockCardProps {
  mock: MockSummary;
}

/**
 * A standalone way to open today's mock from the All Mocks page — optional,
 * not a required sidebar destination (that nav item, with its "1" badge,
 * read as a mandatory task; removed in favour of this).
 */
export function TodaysMockCard({ mock }: TodaysMockCardProps) {
  return (
    <div className={styles.card}>
      <div className={styles.info}>
        <div className={styles.iconRing}>
          <DashboardIcon name="file-check-2" size={20} />
        </div>
        <div>
          <p className={styles.label}>Today&apos;s mock</p>
          <p className={styles.name}>
            Mock {mock.mockNumber} · {mock.paperName}
          </p>
        </div>
      </div>
      <Link href="/dashboard/today" className={styles.cta}>
        Start Mock {mock.mockNumber}
        <DashboardIcon name="arrow-right" size={15} />
      </Link>
    </div>
  );
}
