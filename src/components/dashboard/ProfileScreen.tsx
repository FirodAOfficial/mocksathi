import type { ChallengePlan, ExamEnrollment } from '@/dashboard/types';
import { challengeProgressPct } from '@/dashboard/seedDashboard';
import styles from './ProfileScreen.module.css';

export interface ProfileScreenProps {
  name: string;
  email: string;
  initials: string;
  role: string;
  memberSinceLabel: string;
  enrollments: ExamEnrollment[];
  challenge: ChallengePlan;
}

/**
 * Profile — the one dashboard screen backed by the real database today: name
 * and email come from the signed-in `User` row, not `SEED_DASHBOARD`.
 * Enrollments and study plan are still fixture data, same as the rest of the
 * candidate portal.
 */
export function ProfileScreen({
  name,
  email,
  initials,
  role,
  memberSinceLabel,
  enrollments,
  challenge,
}: ProfileScreenProps) {
  const pct = challengeProgressPct(challenge);

  return (
    <>
      <div className={styles.header}>
        <h1 className={styles.title}>Profile</h1>
        <p className={styles.subtitle}>Your account, exam enrolments, and study plan.</p>
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
          <p className={styles.cardTitle}>Exam enrolments</p>
          <div className={styles.list}>
            {enrollments.map((enrollment) => (
              <div key={enrollment.examId} className={styles.enrollmentRow}>
                {enrollment.examName}
                {enrollment.isPrimary && <span className={styles.primaryBadge}>Primary</span>}
              </div>
            ))}
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
    </>
  );
}
