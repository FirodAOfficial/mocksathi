import type { ChallengePlan } from '@/dashboard/types';
import { challengeProgressPct, formatMarks } from '@/dashboard/seedDashboard';
import styles from './ChallengeProgressCard.module.css';

export interface ChallengeProgressCardProps {
  challenge: ChallengePlan;
}

export function ChallengeProgressCard({ challenge }: ChallengeProgressCardProps) {
  const pct = challengeProgressPct(challenge);

  return (
    <div className={styles.card}>
      <p className={styles.heading}>Challenge progress</p>
      <div className={styles.progressLabel}>
        <span>
          {challenge.completedDays} of {challenge.totalDays} mocks completed
        </span>
        <b>{pct}%</b>
      </div>
      <div className={styles.track}>
        <div className={styles.fill} style={{ width: `${pct}%` }} />
      </div>
      <div className={styles.stats}>
        <div>
          <div className={styles.statLabel}>Total marks</div>
          <div className={styles.statValue}>
            {formatMarks(challenge.totalMarks)} / {formatMarks(challenge.maxMarks)}
          </div>
        </div>
        <div>
          <div className={styles.statLabel}>Missed days</div>
          <div className={styles.statValueWarn}>{challenge.missedDays}</div>
        </div>
      </div>
    </div>
  );
}
