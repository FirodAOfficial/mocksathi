import Link from 'next/link';
import { startHrefFor } from '@/dashboard/mockRoutes';
import type { ReactNode } from 'react';
import type { MockSummary } from '@/dashboard/types';
import { formatMinutesSeconds } from '@/dashboard/seedDashboard';
import { DashboardIcon } from './icons/DashboardIcon';
import styles from './MocksTable.module.css';

export interface MocksTableProps {
  heading: string;
  mocks: MockSummary[];
  /** e.g. a "View all" link on the dashboard-home preview. Omitted on the full list. */
  headerRight?: ReactNode;
}

function ScoreCells({ mock }: { mock: MockSummary }) {
  if (mock.score === undefined) {
    return (
      <>
        <span className={styles.muted}>—</span>
        <span className={styles.muted}>—</span>
        <span className={styles.muted}>—</span>
      </>
    );
  }

  return (
    <>
      <span className={mock.isBestScore ? styles.monoBest : styles.monoStrong}>{mock.score.toFixed(1)}</span>
      <span className={styles.mono}>{mock.accuracyPct}%</span>
      <span className={styles.mono}>#{mock.rank?.toLocaleString('en-IN')}</span>
    </>
  );
}

function ActionCell({ mock }: { mock: MockSummary }) {
  switch (mock.state) {
    case 'today':
      return (
        <Link href={startHrefFor(mock)} className={styles.actionPrimary}>
          Start
        </Link>
      );
    case 'locked':
      return (
        <span className={styles.actionLocked}>
          <DashboardIcon name="lock" size={12} />
          Locked
        </span>
      );
    case 'missed':
      return <span className={styles.actionLocked}>Missed</span>;
    default:
      return (
        <Link href={`/dashboard/mocks/${mock.mockNumber}/solutions`} className={styles.actionSecondary}>
          Solutions
        </Link>
      );
  }
}

function MockRow({ mock }: { mock: MockSummary }) {
  return (
    <div className={mock.state === 'today' ? styles.rowToday : styles.row}>
      <b className={styles.mockNumber}>Mock {mock.mockNumber}</b>
      <span className={styles.paper}>
        {mock.paperName}
        {mock.state === 'today' && <span className={styles.chipToday}>Today</span>}
        {mock.isBestScore && <span className={styles.chipBest}>Best score</span>}
        {mock.unlockNote && <span className={styles.paperNote}>{mock.unlockNote}</span>}
      </span>
      <ScoreCells mock={mock} />
      <span className={styles.muted}>
        {mock.timeSpentSeconds !== undefined ? formatMinutesSeconds(mock.timeSpentSeconds) : '—'}
      </span>
      <span className={styles.dateCell}>{mock.dateLabel}</span>
      <span className={styles.actionCell}>
        <ActionCell mock={mock} />
      </span>
    </div>
  );
}

/** A list of `MockSummary` rows — the dashboard-home "Recent mocks" preview and the full "All Mocks" page both render through this. */
export function MocksTable({ heading, mocks, headerRight }: MocksTableProps) {
  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <p className={styles.heading}>{heading}</p>
        {headerRight}
      </div>

      <div className={styles.table}>
        <div className={styles.headRow}>
          <span>Mock</span>
          <span>Paper</span>
          <span className={styles.right}>Score</span>
          <span className={styles.right}>Accuracy</span>
          <span className={styles.right}>Rank</span>
          <span className={styles.right}>Time</span>
          <span className={styles.right}>Date</span>
          <span className={styles.right}>Action</span>
        </div>

        {mocks.map((mock) => (
          <MockRow key={mock.mockNumber} mock={mock} />
        ))}
      </div>
    </div>
  );
}
