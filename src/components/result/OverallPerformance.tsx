import { marksNeeded, outcomeOf, type ExamResult } from '@/exam/result';
import { HandNote, TargetArt, TrophyArt } from './ResultArt';
import styles from './OverallPerformance.module.css';

/** Radius and circumference of the donut, shared by the track and the arc. */
const RADIUS = 78;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function ScoreDonut({ score, maxScore, qualified }: { score: number; maxScore: number; qualified: boolean }) {
  const fraction = maxScore === 0 ? 0 : Math.min(1, Math.max(0, score / maxScore));

  return (
    <div className={styles.donut}>
      <svg viewBox="0 0 180 180" className={styles.donutSvg} role="img" aria-label={`${score} out of ${maxScore}`}>
        <circle cx="90" cy="90" r={RADIUS} fill="none" stroke="#dfe4e8" strokeWidth="17" />
        <circle
          cx="90"
          cy="90"
          r={RADIUS}
          fill="none"
          stroke={qualified ? '#28a745' : '#e8384f'}
          strokeWidth="17"
          strokeLinecap="round"
          strokeDasharray={`${fraction * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
          // Start the arc at twelve o'clock rather than three.
          transform="rotate(-90 90 90)"
        />
      </svg>

      <span className={styles.donutLabel}>
        <span className={`${styles.donutScore} ${qualified ? styles.scorePass : styles.scoreFail}`}>
          {score.toFixed(1)}
        </span>
        <span className={styles.donutOutOf}>/ {maxScore}</span>
        <span className={styles.donutCaption}>Your Score</span>
      </span>
    </div>
  );
}

/**
 * The headline card: the score, whether it qualified, and the encouragement
 * that goes with each outcome.
 */
export function OverallPerformance({ result }: { result: ExamResult }) {
  const qualified = outcomeOf(result) === 'qualified';
  const shortfall = marksNeeded(result);

  return (
    <section className={`${styles.card} ${qualified ? styles.pass : styles.fail}`} aria-label="Overall performance">
      <header className={styles.heading}>
        <h2 className={styles.title}>Overall Performance</h2>
        <p className={styles.subtitle}>Here&rsquo;s how you performed in this test</p>
      </header>

      <div className={styles.badge}>
        <span className={styles.badgeIcon} aria-hidden="true">
          {qualified ? '✓' : '✕'}
        </span>
        {qualified ? 'Qualified' : 'Not Qualified'}
      </div>

      <div className={styles.body}>
        <ScoreDonut score={result.you.score} maxScore={result.you.maxScore} qualified={qualified} />

        <div className={styles.message}>
          {qualified ? <p className={styles.cheer}>Great Job! 🎉</p> : null}

          <p className={styles.verdict}>
            You scored <strong>{result.you.score.toFixed(1)} marks</strong>, which is{' '}
            {qualified ? 'above' : 'below'} the qualifying marks of{' '}
            <strong>
              {result.qualifyingMarks} out of {result.maximumMarks}
            </strong>
            .
          </p>

          <div className={styles.note}>
            <span className={styles.noteIcon} aria-hidden="true">
              {qualified ? '✓' : '🙁'}
            </span>
            <span>
              <strong className={styles.noteTitle}>
                {qualified ? 'You have Qualified!' : <>You need {shortfall} more marks to qualify.</>}
              </strong>
              <span className={styles.noteBody}>
                {qualified
                  ? 'Keep up the good work. Continue practicing with MockSathi to aim for an even higher score!'
                  : "Don't worry! Keep practicing with MockSathi and come back stronger!"}
              </span>
            </span>
          </div>
        </div>

        <div className={styles.artwork}>
          {qualified ? <TrophyArt /> : <TargetArt />}
          <HandNote className={styles.artNote}>
            {qualified ? 'Well Done!\nKeep Going!' : 'Every Attempt\nMakes You\nStronger!'}
          </HandNote>
        </div>
      </div>
    </section>
  );
}
