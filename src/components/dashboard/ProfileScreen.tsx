import type { ChallengePlan } from '@/dashboard/types';
import { challengeProgressPct } from '@/dashboard/seedDashboard';
import { ExamEnrollmentsCard, type RegisteredExam, type SelectableExam } from './ExamEnrollmentsCard';
import styles from './ProfileScreen.module.css';

export interface ProfileScreenProps {
  name: string;
  email: string;
  initials: string;
  role: string;
  memberSinceLabel: string;
  enrollments: RegisteredExam[];
  availableExams: SelectableExam[];
  challenge: ChallengePlan;
}

/**
 * Profile & Settings — merged, since a settings page with nothing but
 * account-adjacent preferences didn't earn a separate one (`/dashboard/settings`
 * now redirects here). The database-backed parts: name/email (the `User` row)
 * and exam registrations (`enrollments` table, via `ExamEnrollmentsCard`).
 * Study plan is still fixture, same as the rest of the candidate portal.
 */
export function ProfileScreen({
  name,
  email,
  initials,
  role,
  memberSinceLabel,
  enrollments,
  availableExams,
  challenge,
}: ProfileScreenProps) {
  const pct = challengeProgressPct(challenge);

  return (
    <>
      <div className={styles.header}>
        <h1 className={styles.title}>Profile &amp; Settings</h1>
        <p className={styles.subtitle}>Your account, exam registrations, and study plan.</p>
      </div>

      <div className={styles.grid}>
        <div className={styles.card}>
          <p className={styles.cardTitle}>Account</p>
          <div className={styles.identity}>
            <div className={styles.avatar}>{initials}</div>
            <div>
              <p className={styles.name}>{name}</p>
              <p className={styles.role}>{role}</p>
            </div>
          </div>
          <div className={styles.fields}>
            <div>
              <div className={styles.fieldLabel}>Email</div>
              <div className={styles.fieldValue}>{email}</div>
            </div>
            <div>
              <div className={styles.fieldLabel}>Member since</div>
              <div className={styles.fieldValue}>{memberSinceLabel}</div>
            </div>
          </div>
        </div>

        <div className={styles.card}>
          <p className={styles.cardTitle}>Study plan</p>
          <div className={styles.planRow}>
            <span>{challenge.name}</span>
            <b>
              {challenge.completedDays} / {challenge.totalDays} days
            </b>
          </div>
          <div className={styles.track}>
            <div className={styles.fill} style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      <ExamEnrollmentsCard enrollments={enrollments} availableExams={availableExams} />

      <div className={styles.card}>
        <p className={styles.cardTitle}>Preferences</p>
        <p className={styles.preferencesNote}>
          Language, font, notification and subscription preferences are planned here.
        </p>
      </div>
    </>
  );
}
