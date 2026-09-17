'use client';

import Link from 'next/link';
import { startHrefFor } from '@/dashboard/mockRoutes';
import { useMemo, useState } from 'react';
import type { MockSummary, MockType } from '@/dashboard/types';
import { DashboardIcon } from './icons/DashboardIcon';
import styles from './DashboardMocksTable.module.css';
import { StartMockAction } from './StartMockAction';

export interface DashboardMocksTableProps {
  mocks: MockSummary[];
  /** True once an unsubscribed candidate has used every mock their plan allows — gates "Start Mock" below. */
  limitReached: boolean;
}

type Filter = 'all' | Extract<MockType, 'word' | 'excel'>;

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'word', label: 'Word Efficiency' },
  { value: 'excel', label: 'Excel Efficiency' },
];

const TYPE_META: Record<MockType, { letter: string; label: string; className: string }> = {
  word: { letter: 'W', label: 'Word Efficiency', className: styles.typeWord ?? '' },
  excel: { letter: 'X', label: 'Excel Efficiency', className: styles.typeExcel ?? '' },
  mixed: { letter: 'M', label: 'Mixed (Word + Excel)', className: styles.typeMixed ?? '' },
};

function StatusPill({ mock }: { mock: MockSummary }) {
  switch (mock.state) {
    case 'done':
      return <span className={styles.statusDone}>Completed</span>;
    case 'today':
    case 'available':
      return <span className={styles.statusOpen}>Not Attempted</span>;
    case 'missed':
      return <span className={styles.statusOpen}>Missed</span>;
    default:
      return <span className={styles.statusLocked}>Locked</span>;
  }
}

function ActionCell({ mock, limitReached }: { mock: MockSummary; limitReached: boolean }) {
  switch (mock.state) {
    case 'done':
      // Rows here are `publishedTestRows` output, which only marks one 'done'
      // once a `test_attempts` row exists for it — that row always carries a
      // `testId`. Addressed by id, not slug, so the link survives a rename
      // (see `MockSummary.testId`). Retake reuses the same href a fresh
      // "Start Mock" would — `recordAttempt` (`src/db/attempts.ts`) overwrites
      // the stored score on resubmission, so sitting it again always leaves
      // the latest attempt as "the score".
      return mock.testId ? (
        <>
          <Link href={`/dashboard/mocks/test/${mock.testId}/submission`} className={styles.actionOutline}>
            View Result
          </Link>
          <Link href={startHrefFor(mock)} className={styles.actionGhost}>
            Retake
          </Link>
        </>
      ) : null;
    case 'today':
    case 'available':
      // A paper with no questions cannot be sat — `loadPaper` returns null for
      // one, and `/exam` then falls back to a *different* paper. Offering Start
      // here would quietly open something the candidate did not choose.
      if (mock.testSlug && mock.questionCount === 0) {
        return <span className={styles.actionPending}>No questions yet</span>;
      }
      // Same rule as the All Mocks table — see `src/dashboard/mockRoutes.ts`.
      return mock.testSlug ? (
        <StartMockAction
          href={startHrefFor(mock)}
          label="Start Mock"
          className={styles.actionFilled ?? ''}
          limitReached={limitReached}
        />
      ) : (
        <span className={styles.actionPending}>Not yet open</span>
      );
    default:
      return (
        <span className={styles.actionLocked}>
          <DashboardIcon name="lock" size={12} />
          Locked
        </span>
      );
  }
}

/**
 * The dashboard-home mocks list — a plainer set of columns than the full
 * `MocksTable` used on `/dashboard/mocks` (no rank/accuracy/time), matching
 * the reference redesign: type filter pills, and a status/action pair that
 * reads at a glance instead of a dense stats row per mock.
 */
export function DashboardMocksTable({ mocks, limitReached }: DashboardMocksTableProps) {
  const [filter, setFilter] = useState<Filter>('all');

  const visible = useMemo(
    () => (filter === 'all' ? mocks : mocks.filter((mock) => mock.mockType === filter)),
    [mocks, filter],
  );

  return (
    <div className={styles.card} data-tour="dashboard-mocks">
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>All Mocks</h2>
          <p className={styles.subtitle}>Practice Word and Excel Efficiency with real exam based mocks</p>
        </div>
        <div className={styles.pills}>
          {FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={filter === option.value ? styles.pillActive : styles.pill}
              onClick={() => setFilter(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.table}>
        <div className={styles.headRow}>
          <span>#</span>
          <span>Mock Name</span>
          <span>Type</span>
          <span className={styles.right}>Questions</span>
          <span className={styles.right}>Total Marks</span>
          <span className={styles.right}>Your Marks</span>
          <span>Status</span>
          <span className={styles.right}>Action</span>
        </div>

        {visible.length === 0 && (
          <p className={styles.empty}>
            {mocks.length === 0
              ? 'No papers published yet.'
              : 'No papers of that type yet.'}
          </p>
        )}

        {visible.map((mock) => {
          const type = TYPE_META[mock.mockType];
          return (
            <div key={mock.mockNumber} className={styles.row}>
              <span className={styles.mockNumber}>{mock.mockNumber}</span>
              <span className={styles.paper}>{mock.paperName}</span>
              <span className={styles.type}>
                <span className={`${styles.typeBadge} ${type.className}`}>{type.letter}</span>
                {type.label}
              </span>
              <span className={styles.right}>{mock.questionCount}</span>
              <span className={styles.right}>{mock.maxScore ?? '—'}</span>
              <span className={styles.right}>
                {mock.score !== undefined ? (
                  <b className={styles.marks}>
                    {mock.score.toFixed(0)} / {mock.maxScore}
                  </b>
                ) : (
                  <span className={styles.muted}>—</span>
                )}
              </span>
              <span>
                <StatusPill mock={mock} />
              </span>
              <span className={styles.actionCell}>
                <ActionCell mock={mock} limitReached={limitReached} />
              </span>
            </div>
          );
        })}

        {visible.length === 0 && <p className={styles.empty}>No mocks of this type yet.</p>}
      </div>
    </div>
  );
}
