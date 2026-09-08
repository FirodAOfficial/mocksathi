import Link from 'next/link';
import type { Exam } from '@/db/schema';
import styles from './ExamsListScreen.module.css';

export interface ExamsListScreenProps {
  exams: Exam[];
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Admin-only: every exam in the `exams` table, real data, no fixture. */
export function ExamsListScreen({ exams }: ExamsListScreenProps) {
  return (
    <>
      <div className={styles.header}>
        <div className={styles.headerText}>
          <h1 className={styles.title}>Manage Exams</h1>
          <p className={styles.subtitle}>{exams.length} exam{exams.length === 1 ? '' : 's'} listed.</p>
        </div>
        <Link href="/dashboard/admin/exams/new" className={styles.addButton}>
          + Add exam
        </Link>
      </div>

      <div className={styles.card}>
        {exams.length === 0 ? (
          <p className={styles.empty}>No exams yet — add the first one.</p>
        ) : (
          <div className={styles.table}>
            <div className={styles.headRow}>
              <span>Name</span>
              <span>Category</span>
              <span>Organiser</span>
              <span>Exam date</span>
              <span>Reg. last date</span>
              <span>Status</span>
              <span />
            </div>
            {exams.map((exam) => (
              <div className={styles.row} key={exam.id}>
                <span className={styles.name}>{exam.name}</span>
                <span className={styles.muted}>{exam.category ?? '—'}</span>
                <span>{exam.organiserName}</span>
                <span className={styles.mono}>{formatDate(exam.examDate)}</span>
                <span className={styles.mono}>{formatDate(exam.registrationLastDate)}</span>
                <span className={styles[exam.status] ?? styles.badge}>{exam.status}</span>
                <Link href={`/dashboard/admin/exams/${exam.id}/edit`} className={styles.editLink}>
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
