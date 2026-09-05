import { formatClock, type ExamResult, type QuestionOutcome } from '@/exam/result';
import styles from './TimeAnalysis.module.css';

/* Chart geometry, in the SVG's own user units. */
const WIDTH = 980;
const HEIGHT = 310;
const PAD = { top: 12, right: 10, bottom: 58, left: 48 };
const PLOT_WIDTH = WIDTH - PAD.left - PAD.right;
const PLOT_HEIGHT = HEIGHT - PAD.top - PAD.bottom;

const BAR_WIDTH = 11;
const BAR_GAP = 2;

const SERIES = [
  { key: 'yourTimeSeconds', label: 'Your Time (sec)', colour: '#2f7fe0' },
  { key: 'averageTimeSeconds', label: 'Average Time (sec)', colour: '#8b6ede' },
  { key: 'topperTimeSeconds', label: 'Topper Time (sec)', colour: '#f0982b' },
] as const;

const OUTCOME_COLOUR: Record<QuestionOutcome, string> = {
  correct: '#28a745',
  incorrect: '#e8384f',
  unattempted: '#9aa5b1',
};

/** Axis top: the next multiple of 30 above the data, never below 120. */
function axisMaximum(values: number[]): number {
  const peak = Math.max(120, ...values);
  return Math.ceil(peak / 30) * 30;
}

/**
 * Per-question timings against the cohort.
 *
 * Drawn as inline SVG rather than with a charting library: it is fifteen groups
 * of three bars with no interaction, and a dependency would cost more than the
 * forty lines of geometry it saves.
 */
export function TimeAnalysis({ result }: { result: ExamResult }) {
  const questions = result.questions;

  const maximum = axisMaximum(
    questions.flatMap((q) => [q.yourTimeSeconds, q.averageTimeSeconds, q.topperTimeSeconds]),
  );
  const ticks = Array.from({ length: maximum / 30 + 1 }, (_, index) => index * 30);

  /*
   * The totals below the chart describe the chart, so they are summed from the
   * same rows rather than read off the comparison table. The topper's table
   * time covers their whole paper; this is only the questions plotted here.
   */
  const totals = questions.reduce(
    (acc, q) => ({
      you: acc.you + q.yourTimeSeconds,
      average: acc.average + q.averageTimeSeconds,
      topper: acc.topper + q.topperTimeSeconds,
    }),
    { you: 0, average: 0, topper: 0 },
  );

  const groupWidth = questions.length === 0 ? PLOT_WIDTH : PLOT_WIDTH / questions.length;
  const clusterWidth = SERIES.length * BAR_WIDTH + (SERIES.length - 1) * BAR_GAP;

  const yOf = (value: number): number => PAD.top + PLOT_HEIGHT - (value / maximum) * PLOT_HEIGHT;

  return (
    <section className={styles.section} aria-label="Question-wise performance and time analysis">
      <header className={styles.head}>
        <h2 className={styles.title}>
          <span className={styles.titleIcon} aria-hidden="true">
            🕐
          </span>
          Question-wise Performance &amp; Time Analysis
        </h2>

        <ul className={styles.legend}>
          {SERIES.map((series) => (
            <li key={series.key} className={styles.legendItem}>
              <span className={styles.swatch} style={{ background: series.colour }} />
              {series.label}
            </li>
          ))}
          <li className={styles.legendItem}>
            <span className={styles.swatch} style={{ background: OUTCOME_COLOUR.correct }} />
            <span className={styles.swatch} style={{ background: OUTCOME_COLOUR.incorrect }} />
            Correct / Incorrect / Unattempted
          </li>
        </ul>
      </header>

      <div className={styles.chartScroll}>
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className={styles.chart} role="img" aria-label="Time per question, compared with the average and the topper">
          {/* Gridlines and y-axis labels */}
          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={PAD.left} x2={WIDTH - PAD.right} y1={yOf(tick)} y2={yOf(tick)} stroke="#e8edf2" />
              <text x={PAD.left - 10} y={yOf(tick) + 4} textAnchor="end" className={styles.axisText}>
                {tick}
              </text>
            </g>
          ))}

          <text
            className={styles.axisTitle}
            transform={`rotate(-90 14 ${PAD.top + PLOT_HEIGHT / 2}) translate(14 ${PAD.top + PLOT_HEIGHT / 2})`}
            textAnchor="middle"
          >
            Time (Seconds)
          </text>

          {questions.map((question, index) => {
            const groupLeft = PAD.left + index * groupWidth;
            const clusterLeft = groupLeft + (groupWidth - clusterWidth) / 2;
            const centre = groupLeft + groupWidth / 2;

            return (
              <g key={question.number}>
                {SERIES.map((series, seriesIndex) => {
                  const value = question[series.key];
                  const top = yOf(value);
                  return (
                    <rect
                      key={series.key}
                      x={clusterLeft + seriesIndex * (BAR_WIDTH + BAR_GAP)}
                      y={top}
                      width={BAR_WIDTH}
                      height={Math.max(0, PAD.top + PLOT_HEIGHT - top)}
                      rx="2"
                      fill={series.colour}
                    />
                  );
                })}

                {/* Outcome dot and question number, beneath the axis. */}
                <circle cx={centre} cy={PAD.top + PLOT_HEIGHT + 16} r="5" fill={OUTCOME_COLOUR[question.outcome]} />
                <text x={centre} y={PAD.top + PLOT_HEIGHT + 36} textAnchor="middle" className={styles.axisText}>
                  {question.number}
                </text>
              </g>
            );
          })}

          <line
            x1={PAD.left}
            x2={WIDTH - PAD.right}
            y1={PAD.top + PLOT_HEIGHT}
            y2={PAD.top + PLOT_HEIGHT}
            stroke="#cfd8e0"
          />
          <text x={PAD.left + PLOT_WIDTH / 2} y={HEIGHT - 6} textAnchor="middle" className={styles.axisTitle}>
            Question Number
          </text>
        </svg>
      </div>

      <div className={styles.totals}>
        <div className={styles.total}>
          <span className={styles.totalIcon} aria-hidden="true">
            ⏱️
          </span>
          <span>
            <strong className={styles.totalValue}>{formatClock(totals.you)}</strong>
            <span className={styles.totalLabel}>Your Total Time</span>
          </span>
        </div>
        <div className={styles.total}>
          <span className={styles.totalIcon} aria-hidden="true">
            👥
          </span>
          <span>
            <strong className={styles.totalValue}>{formatClock(totals.average)}</strong>
            <span className={styles.totalLabel}>Average Time</span>
          </span>
        </div>
        <div className={styles.total}>
          <span className={styles.totalIcon} aria-hidden="true">
            🏆
          </span>
          <span>
            <strong className={styles.totalValue}>{formatClock(totals.topper)}</strong>
            <span className={styles.totalLabel}>Topper Time</span>
          </span>
        </div>

        <div className={styles.tip}>
          <span className={styles.tipIcon} aria-hidden="true">
            💡
          </span>
          <span>
            <strong className={styles.tipTitle}>Pro Tip:</strong>
            <span className={styles.tipBody}>
              Try to improve your time per question and focus on accuracy. Consistent practice leads to
              higher scores!
            </span>
          </span>
        </div>
      </div>
    </section>
  );
}
