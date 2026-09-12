import Link from 'next/link';
import type { ReactNode } from 'react';
import { startHrefFor } from '@/dashboard/mockRoutes';
import type { MockSummary } from '@/dashboard/types';
import { formatMinutesSeconds } from '@/dashboard/seedDashboard';
import { DashboardIcon } from './icons/DashboardIcon';
import styles from './MocksTable.module.css';

export interface MocksTableProps {
  heading: string;
  mocks: MockSummary[];
  /** e.g. a "View all" link on the dashboard-home preview. Omitted on the full list. */
  headerRight?: ReactNode;
  /** Shown instead of rows when there are none — an empty table reads as a broken one. */
  emptyNote?: string;
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
    case 'available':
      // A paper with no questions cannot be sat — `loadPaper` returns null for
      // one, and `/exam` then falls back to a *different* paper. Offering Start
      // here would quietly open something the candidate did not choose.
      if (mock.testSlug && mock.questionCount === 0) {
        return <span className={styles.actionPending}>No questions yet</span>;
      }
      // A row that names a paper opens that paper; one that does not has
      // nothing of its own to open. See `src/dashboard/mockRoutes.ts`.
      return mock.testSlug ? (
        <Link href={startHrefFor(mock)} className={styles.actionPrimary}>
          Start
        </Link>
      ) : (
        <span className={styles.actionPending}>Not yet open</span>
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

/**
 * A list of `MockSummary` rows — the full "All Mocks" page renders through this.
 *
 * The rows are published `tests` now, not the thirty fixture mocks this used to
 * show. The score, accuracy, rank and time columns come back empty for all of
 * them, which is honest rather than unfinished: there is no `attempts` table,
 * so nothing knows whether a paper has been sat.
 */
export function MocksTable({ heading, mocks, headerRight, emptyNote }: MocksTableProps) {
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

      <div>
        {mocks.length === 0 && emptyNote && <p className={styles.empty}>{emptyNote}</p>}
      </div>
    </div>
  );
}
