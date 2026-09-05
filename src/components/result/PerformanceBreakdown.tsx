import Link from 'next/link';
import { outcomeOf, percent, type ExamResult, type QuestionOutcome } from '@/exam/result';
import styles from './PerformanceBreakdown.module.css';

const OUTCOME_CLASS: Record<QuestionOutcome, string | undefined> = {
  correct: styles.correct,
  incorrect: styles.incorrect,
  unattempted: styles.unattempted,
};

const OUTCOME_LABEL: Record<QuestionOutcome, string> = {
  correct: 'correct',
  incorrect: 'incorrect',
  unattempted: 'unattempted',
};

/** The four counters, the encouragement card, and the per-question strip. */
export function PerformanceBreakdown({ result }: { result: ExamResult }) {
  const { you, totalQuestions } = result;
  const qualified = outcomeOf(result) === 'qualified';

  const tiles = [
    { key: 'correct', mark: '✓', value: you.correct, label: 'Correct', share: percent(you.correct, totalQuestions) },
    { key: 'incorrect', mark: '✕', value: you.wrong, label: 'Incorrect', share: percent(you.wrong, totalQuestions) },
    {
      key: 'unattempted',
      mark: '–',
      value: you.unattempted,
      label: 'Unattempted',
      share: percent(you.unattempted, totalQuestions),
    },
  ] as const;

  return (
    <>
      <section className={styles.tiles} aria-label="Score breakdown">
        {tiles.map((tile) => (
          <div key={tile.key} className={`${styles.tile} ${styles[tile.key] ?? ''}`}>
            <span className={styles.tileMark} aria-hidden="true">
              {tile.mark}
            </span>
            <span className={styles.tileValue}>{tile.value}</span>
            <span className={styles.tileLabel}>{tile.label}</span>
            <span className={styles.tileShare}>({tile.share.toFixed(2)}%)</span>
          </div>
        ))}

        <div className={`${styles.tile} ${styles.accuracy}`}>
          <span className={styles.tileMark} aria-hidden="true">
            %
          </span>
          <span className={styles.tileValue}>{you.accuracy.toFixed(2)}%</span>
          <span className={styles.tileLabel}>Accuracy</span>
        </div>

        <div className={styles.cta}>
          <div className={styles.ctaBody}>
            <span className={styles.ctaIcon} aria-hidden="true">
              🏆
            </span>
            <div>
              <p className={styles.ctaTitle}>{qualified ? 'Keep Pushing!' : 'Keep Going!'}</p>
              <p className={styles.ctaText}>
                {qualified
                  ? "You're on the right track. Practice more tests to improve your rank and speed."
                  : 'Learn from your mistakes, practice daily and improve your score.'}
              </p>
            </div>
          </div>
          <Link href="/" className={styles.ctaButton}>
            Attempt Another Test <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>

      <section className={styles.summary} aria-label="Question-wise summary">
        <header className={styles.summaryHead}>
          <h2 className={styles.summaryTitle}>
            <span className={styles.summaryIcon} aria-hidden="true">
              📊
            </span>
            Question-wise Summary
          </h2>
          <ul className={styles.legend}>
            {(['correct', 'incorrect', 'unattempted'] as QuestionOutcome[]).map((outcome) => (
              <li key={outcome} className={styles.legendItem}>
                <span className={`${styles.legendDot} ${OUTCOME_CLASS[outcome] ?? ''}`} />
                {OUTCOME_LABEL[outcome].replace(/^./, (c) => c.toUpperCase())}
              </li>
            ))}
          </ul>
        </header>

        <ol className={styles.chips}>
          {result.questions.map((question) => (
            <li
              key={question.number}
              className={`${styles.chip} ${OUTCOME_CLASS[question.outcome] ?? ''}`}
              // The colour alone would not survive a greyscale print, so each
              // chip names its outcome for assistive technology.
              aria-label={`Question ${question.number}, ${OUTCOME_LABEL[question.outcome]}`}
            >
              {question.number}
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
