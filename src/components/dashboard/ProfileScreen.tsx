import { LegalNavLink } from '@/components/legal/LegalNavLink';
import type { ChallengePlan } from '@/dashboard/types';
import { challengeProgressPct } from '@/dashboard/seedDashboard';
import { AvatarUpload } from './AvatarUpload';
import { ExamEnrollmentsCard, type RegisteredExam, type SelectableExam } from './ExamEnrollmentsCard';
import styles from './ProfileScreen.module.css';

const LEGAL_LINKS = [
  { href: '/about', label: 'About Us' },
  { href: '/legal/terms', label: 'Terms & Conditions' },
  { href: '/legal/privacy', label: 'Privacy Policy' },
  { href: '/legal/refund-policy', label: 'Refund & Cancellation Policy' },
];

export interface ProfileScreenProps {
  name: string;
  email: string;
  initials: string;
  role: string;
  avatarUrl: string | null;
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
  avatarUrl,
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
            <AvatarUpload initials={initials} avatarUrl={avatarUrl} />
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

      <div className={styles.card}>
        <p className={styles.cardTitle}>Legal &amp; Company</p>
        <div className={styles.legalLinks}>
          {LEGAL_LINKS.map((link) => (
            <LegalNavLink key={link.href} href={link.href} className={styles.legalLink}>
              {link.label}
            </LegalNavLink>
          ))}
        </div>
      </div>
    </>
  );
}
