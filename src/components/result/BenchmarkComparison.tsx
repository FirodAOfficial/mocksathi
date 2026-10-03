import { formatClock, type ExamResult, type ScoreLine } from '@/exam/result';
import styles from './BenchmarkComparison.module.css';

/**
 * The candidate against the paper's best sitting and its average.
 *
 * One row per measure, each a bullet chart on its own scale: the candidate's
 * bar, the average as a tick, the best as a marker — so "where am I between
 * the two" is read off one line rather than by cross-reading three tables.
 * The row's chip says which side of the average they landed and by how much,
 * in words as well as colour.
 */

interface Measure {
  key: string;
  label: string;
  you: number;
  average: number;
  best: number;
  /** The right end of the track. */
  scale: number;
  higherIsBetter: boolean;
  format: (value: number) => string;
  /** How a difference reads: "4.5 marks", "12 sec". */
  formatDelta: (value: number) => string;
}

/** `28` -> "28", `22.5` -> "22.5", `7.43` -> "7.4". */
function trim(value: number, places = 1): string {
  return String(Math.round(value * 10 ** places) / 10 ** places);
}

function measuresFor(result: ExamResult, best: ScoreLine, average: ScoreLine): Measure[] {
  const { you, maximumMarks, totalQuestions } = result;
  const paperSeconds = result.totalTimeMinutes * 60;
  return [
    {
      key: 'score',
      label: 'Score',
      you: you.score,
      average: average.score,
      best: best.score,
      scale: maximumMarks,
      higherIsBetter: true,
      format: (v) => `${trim(v, 2)} / ${maximumMarks}`,
      formatDelta: (v) => `${trim(v, 2)} marks`,
    },
    {
      key: 'accuracy',
      label: 'Accuracy',
      you: you.accuracy,
      average: average.accuracy,
      best: best.accuracy,
      scale: 100,
      higherIsBetter: true,
      format: (v) => `${trim(v)}%`,
      formatDelta: (v) => `${trim(v)} pts`,
    },
    {
      key: 'correct',
      label: 'Correct',
      you: you.correct,
      average: average.correct,
      best: best.correct,
      scale: totalQuestions,
      higherIsBetter: true,
      format: (v) => trim(v),
      formatDelta: (v) => `${trim(v)} Qs`,
    },
    {
      key: 'wrong',
      label: 'Wrong',
      you: you.wrong,
      average: average.wrong,
      best: best.wrong,
      scale: totalQuestions,
      higherIsBetter: false,
      format: (v) => trim(v),
      formatDelta: (v) => `${trim(v)} Qs`,
    },
    {
      key: 'time',
      label: 'Time taken',
      you: you.timeSeconds,
      average: average.timeSeconds,
      best: best.timeSeconds,
      scale: Math.max(paperSeconds, you.timeSeconds, average.timeSeconds, best.timeSeconds),
      higherIsBetter: false,
      format: (v) => formatClock(v),
      formatDelta: (v) => `${formatDuration(v)}`,
    },
  ];
}

/** `95` -> "1m 35s", `40` -> "40s". */
function formatDuration(seconds: number): string {
  const s = Math.round(Math.abs(seconds));
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
}

function pct(value: number, scale: number): string {
  if (scale <= 0) return '0%';
  return `${Math.min(100, Math.max(0, (value / scale) * 100))}%`;
}

type Standing = 'better' | 'worse' | 'level';

function standing(measure: Measure): Standing {
  const diff = measure.you - measure.average;
  // Within a rounding hair of the average counts as level.
  if (Math.abs(diff) < (measure.key === 'time' ? 1 : 0.05)) return 'level';
  return diff > 0 === measure.higherIsBetter ? 'better' : 'worse';
}

function deltaText(measure: Measure): string {
  const s = standing(measure);
  if (s === 'level') return 'Level with average';
  const amount = measure.formatDelta(Math.abs(measure.you - measure.average));
  if (measure.key === 'time') return `${amount} ${measure.you < measure.average ? 'faster' : 'slower'}`;
  return `${amount} ${measure.you > measure.average ? 'above' : 'below'} avg`;
}

const STANDING_MARK: Record<Standing, string> = { better: '▲', worse: '▼', level: '=' };

function formatComputedAt(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

export function BenchmarkComparison({ result }: { result: ExamResult }) {
  const { topper: best, average, benchmark } = result;

  if (!best || !average) {
    return (
      <section className={styles.section} aria-label="How you compare">
        <header className={styles.head}>
          <h2 className={styles.title}>
            <span aria-hidden="true">📊</span> How You Compare
          </h2>
        </header>
        <p className={styles.pending}>
          {benchmark ? (
            <>
              The best and average scores for this paper appear once at least{' '}
              <strong>{benchmark.minCohortSize}</strong> candidate{benchmark.minCohortSize === 1 ? ' has' : 's have'} sat it
              — <strong>{benchmark.cohortSize}</strong> so far. They&apos;re refreshed on a schedule, so a sitting
              just submitted (yours included) joins them on the next update.
            </>
          ) : (
            <>There&apos;s no one to compare with on the sample paper — sit a published mock to see the best and average scores.</>
          )}
        </p>
      </section>
    );
  }

  const measures = measuresFor(result, best, average);
  const score = measures[0]!;
  const vsAverage = result.you.score - average.score;
  const vsBest = best.score - result.you.score;
  const updated = formatComputedAt(benchmark?.computedAt);

  return (
    <section className={styles.section} aria-label="How you compare">
      <header className={styles.head}>
        <div>
          <h2 className={styles.title}>
            <span aria-hidden="true">📊</span> How You Compare
          </h2>
          {benchmark && (
            <p className={styles.subtitle}>
              Against {benchmark.cohortSize.toLocaleString('en-IN')} candidate{benchmark.cohortSize === 1 ? '' : 's'}
              {updated ? ` · updated ${updated}` : ''}
            </p>
          )}
        </div>

        <ul className={styles.legend} aria-label="Legend">
          <li>
            <span className={styles.legendYou} aria-hidden="true" /> You
          </li>
          <li>
            <span className={styles.legendAverage} aria-hidden="true" /> Average
          </li>
          <li>
            <span className={styles.legendBest} aria-hidden="true" /> Best
          </li>
        </ul>
      </header>

      <div className={styles.verdicts}>
        <div className={`${styles.verdict} ${styles[standing(score)] ?? ''}`}>
          <span className={styles.verdictMark} aria-hidden="true">
            {STANDING_MARK[standing(score)]}
          </span>
          <span>
            <strong className={styles.verdictValue}>
              {standing(score) === 'level' ? 'On par' : `${trim(Math.abs(vsAverage), 2)} marks`}
            </strong>
            <span className={styles.verdictLabel}>
              {standing(score) === 'level' ? 'with the average' : vsAverage > 0 ? 'above the average' : 'below the average'}
            </span>
          </span>
        </div>

        <div className={`${styles.verdict} ${vsBest <= 0 ? styles.better : styles.neutral}`}>
          <span className={styles.verdictMark} aria-hidden="true">
            {vsBest <= 0 ? '★' : '◆'}
          </span>
          <span>
            <strong className={styles.verdictValue}>{vsBest <= 0 ? 'Top score' : `${trim(vsBest, 2)} marks`}</strong>
            <span className={styles.verdictLabel}>{vsBest <= 0 ? 'you hold the best on this paper' : 'to reach the best'}</span>
          </span>
        </div>
      </div>

      <div className={styles.rows} role="list">
        {measures.map((measure) => {
          const s = standing(measure);
          return (
            <div
              key={measure.key}
              className={styles.row}
              role="listitem"
              aria-label={`${measure.label}: you ${measure.format(measure.you)}, average ${measure.format(
                measure.average,
              )}, best ${measure.format(measure.best)}. ${deltaText(measure)}.`}
            >
              <span className={styles.rowLabel}>{measure.label}</span>

              <div className={styles.track} aria-hidden="true">
                <span className={styles.bar} style={{ width: pct(measure.you, measure.scale) }} />
                <span
                  className={styles.averageTick}
                  style={{ left: pct(measure.average, measure.scale) }}
                  title={`Average: ${measure.format(measure.average)}`}
                />
                <span
                  className={styles.bestMarker}
                  style={{ left: pct(measure.best, measure.scale) }}
                  title={`Best: ${measure.format(measure.best)}`}
                />
              </div>

              <dl className={styles.values} aria-hidden="true">
                <div>
                  <dt>You</dt>
                  <dd className={styles.youValue}>{measure.format(measure.you)}</dd>
                </div>
                <div>
                  <dt>Avg</dt>
                  <dd>{measure.format(measure.average)}</dd>
                </div>
                <div>
                  <dt>Best</dt>
                  <dd>{measure.format(measure.best)}</dd>
                </div>
              </dl>

              <span className={`${styles.chip} ${styles[s] ?? ''}`} aria-hidden="true">
                <span className={styles.chipMark}>{STANDING_MARK[s]}</span>
                {deltaText(measure)}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
