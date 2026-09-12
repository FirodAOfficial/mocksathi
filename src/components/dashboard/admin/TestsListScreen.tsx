import Link from 'next/link';
import type { TestListRow } from '@/db/tests';
import styles from './TestsListScreen.module.css';

export interface TestsListScreenProps {
  tests: TestListRow[];
}

const SUBJECT_LABEL = { word: 'Word', excel: 'Excel' } as const;

/** Admin-only: every paper in the `tests` table, real data, no fixture. */
export function TestsListScreen({ tests }: TestsListScreenProps) {
  return (
    <>
      <div className={styles.header}>
        <div className={styles.headerText}>
          <h1 className={styles.title}>Test Enigma</h1>
          <p className={styles.subtitle}>
            {tests.length === 0
              ? 'Write the papers candidates sit — a passage or a sheet, and what to do with it.'
              : `${tests.length} test${tests.length === 1 ? '' : 's'} written.`}
          </p>
        </div>
        <Link href="/dashboard/admin/tests/new" className={styles.addButton}>
          + New test
        </Link>
      </div>

      <div className={styles.card}>
        {tests.length === 0 ? (
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>No tests yet.</p>
            <p className={styles.emptyBody}>
              A test belongs to an exam and is all Word or all Excel. Add one, then write its questions.
            </p>
          </div>
        ) : (
          <div className={styles.table}>
            <div className={styles.headRow}>
              <span>Test</span>
              <span>Exam</span>
              <span>Type</span>
              <span>Questions</span>
              <span>Marks</span>
              <span>Time</span>
              <span>Status</span>
              <span />
            </div>
            {tests.map(({ test, examName, questionCount, totalMarks }) => (
              <div className={styles.row} key={test.id}>
                <Link href={`/dashboard/admin/tests/${test.id}`} className={styles.name}>
                  {test.name}
                </Link>
                <span className={styles.muted}>{examName}</span>
                <span className={styles[test.subject] ?? styles.badge}>{SUBJECT_LABEL[test.subject]}</span>
                <span className={styles.mono}>{questionCount}</span>
                {/* A paper with no questions is marked out of nothing — say so rather than showing a confident 0. */}
                <span className={styles.mono}>{questionCount === 0 ? '—' : totalMarks}</span>
                <span className={styles.mono}>{test.durationMinutes} min</span>
                <span className={styles[test.status] ?? styles.badge}>{test.status}</span>
                <Link href={`/dashboard/admin/tests/${test.id}`} className={styles.editLink}>
                  Open
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
