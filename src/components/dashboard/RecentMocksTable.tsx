import Link from 'next/link';
import type { MockSummary } from '@/dashboard/types';
import { formatMinutesSeconds } from '@/dashboard/seedDashboard';
import { DashboardIcon } from './icons/DashboardIcon';
import styles from './RecentMocksTable.module.css';

export interface RecentMocksTableProps {
  todaysMock: MockSummary;
  recentMocks: MockSummary[];
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
        <Link href="/dashboard/today" className={styles.actionPrimary}>
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

function MockRow({ mock, highlight }: { mock: MockSummary; highlight?: boolean }) {
  return (
    <div className={highlight ? styles.rowToday : styles.row}>
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

export function RecentMocksTable({ todaysMock, recentMocks }: RecentMocksTableProps) {
  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <p className={styles.heading}>Recent mocks</p>
        <Link href="/dashboard/mocks" className={styles.viewAll}>
          View all mocks (1–30) →
        </Link>
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

        <MockRow mock={todaysMock} highlight />
        {recentMocks.map((mock) => (
          <MockRow key={mock.mockNumber} mock={mock} />
        ))}
      </div>
    </div>
  );
}
