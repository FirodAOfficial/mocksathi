'use client';

import { useState } from 'react';
import { formatClock, type ExamResult, type QuestionOutcome, type QuestionResult } from '@/exam/result';
import styles from './TimeAnalysis.module.css';

/* Chart geometry, in the SVG's own user units. */
const HEIGHT = 300;
const PAD = { top: 16, right: 12, bottom: 50, left: 50 };
const PLOT_HEIGHT = HEIGHT - PAD.top - PAD.bottom;
/** Each question gets at least this much width; past ~25 questions the chart scrolls rather than squeezing. */
const MIN_GROUP_WIDTH = 34;
const MIN_WIDTH = 980;

const OUTCOME: Record<QuestionOutcome, { glyph: string; label: string }> = {
  correct: { glyph: '✓', label: 'Correct' },
  incorrect: { glyph: '✕', label: 'Incorrect' },
  unattempted: { glyph: '–', label: 'Unattempted' },
};

type View = 'time' | 'gap';

/** A round step giving about five gridlines up to `peak`. */
function niceStep(peak: number): number {
  const raw = Math.max(peak, 1) / 5;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((candidate) => candidate >= raw);
  return step ?? 10 * magnitude;
}

function signed(seconds: number): string {
  const rounded = Math.round(seconds);
  return `${rounded > 0 ? '+' : rounded < 0 ? '−' : '±'}${Math.abs(rounded)}s`;
}

/** You minus average, or null when there's no average for the question. */
function gapOf(question: QuestionResult): number | null {
  return question.averageTimeSeconds === null ? null : question.yourTimeSeconds - question.averageTimeSeconds;
}

/**
 * Per-question timings against the paper's average and best sitting.
 *
 * One bar per question — yours — with the average as a tick and the best as a
 * dot on the same column, so each question answers "was I slow here?" by
 * itself. The "gap" view plots that answer directly: seconds over or under the
 * average, above or below a zero line. Inline SVG rather than a charting
 * library, same as before: the geometry is short, and the interaction is a
 * hover and a toggle.
 */
export function TimeAnalysis({ result }: { result: ExamResult }) {
  const questions = result.questions;
  const hasAverage = questions.some((q) => q.averageTimeSeconds !== null);
  const hasBest = questions.some((q) => q.topperTimeSeconds !== null);

  const [view, setView] = useState<View>('time');
  const [active, setActive] = useState<number | null>(null);
  const shownView: View = hasAverage ? view : 'time';

  const width = Math.max(MIN_WIDTH, PAD.left + PAD.right + questions.length * MIN_GROUP_WIDTH);
  const plotWidth = width - PAD.left - PAD.right;
  const groupWidth = questions.length === 0 ? plotWidth : plotWidth / questions.length;
  const barWidth = Math.min(26, Math.max(10, groupWidth * 0.5));

  // Scale. The time view runs 0 -> peak; the gap view is symmetric about zero
  // so "slower" and "faster" bars of the same size look the same size.
  const gaps = questions.map(gapOf);
  let minValue = 0;
  let maxValue: number;
  if (shownView === 'time') {
    maxValue = Math.max(
      1,
      ...questions.flatMap((q) => [q.yourTimeSeconds, q.averageTimeSeconds ?? 0, q.topperTimeSeconds ?? 0]),
    );
  } else {
    const reach = Math.max(1, ...gaps.map((gap) => Math.abs(gap ?? 0)));
    maxValue = reach;
    minValue = -reach;
  }
  const step = niceStep(Math.max(maxValue, -minValue));
  const top = Math.ceil(maxValue / step) * step;
  const bottom = Math.floor(minValue / step) * step;
  const ticks: number[] = [];
  for (let tick = bottom; tick <= top + 1e-9; tick += step) ticks.push(Math.round(tick * 100) / 100);

  const yOf = (value: number): number => PAD.top + PLOT_HEIGHT - ((value - bottom) / (top - bottom)) * PLOT_HEIGHT;
  const centreOf = (index: number): number => PAD.left + index * groupWidth + groupWidth / 2;

  /*
   * The totals describe the chart, so they are summed from the same rows
   * rather than read off the comparison: only questions with a figure count.
   */
  const totals = {
    you: questions.reduce((sum, q) => sum + q.yourTimeSeconds, 0),
    average: hasAverage ? questions.reduce((sum, q) => sum + (q.averageTimeSeconds ?? 0), 0) : null,
    best: hasBest ? questions.reduce((sum, q) => sum + (q.topperTimeSeconds ?? 0), 0) : null,
  };

  // Insight: how often faster than average, and where the time went.
  const compared = questions.filter((q) => q.averageTimeSeconds !== null && q.yourTimeSeconds > 0);
  const fasterCount = compared.filter((q) => q.yourTimeSeconds <= (q.averageTimeSeconds ?? 0)).length;
  const sinks = questions
    .map((q) => ({ number: q.number, gap: gapOf(q) }))
    .filter((entry): entry is { number: number; gap: number } => entry.gap !== null && entry.gap >= 3)
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 3);

  const activeQuestion = active === null ? null : questions[active];

  return (
    <section className={styles.section} aria-label="Question-wise performance and time analysis">
      <header className={styles.head}>
        <h2 className={styles.title}>
          <span className={styles.titleIcon} aria-hidden="true">
            🕐
          </span>
          Question-wise Time Analysis
        </h2>

        {hasAverage && (
          <div className={styles.toggle} role="group" aria-label="Chart view">
            <button
              type="button"
              className={shownView === 'time' ? styles.toggleActive : styles.toggleButton}
              aria-pressed={shownView === 'time'}
              onClick={() => setView('time')}
            >
              Time per question
            </button>
            <button
              type="button"
              className={shownView === 'gap' ? styles.toggleActive : styles.toggleButton}
              aria-pressed={shownView === 'gap'}
              onClick={() => setView('gap')}
            >
              Gap vs average
            </button>
          </div>
        )}
      </header>

      {hasAverage ? (
        <p className={styles.insight}>
          Faster than average on{' '}
          <strong>
            {fasterCount} of {compared.length}
          </strong>{' '}
          question{compared.length === 1 ? '' : 's'}
          {sinks.length > 0 && (
            <>
              {' '}· Most time lost on{' '}
              {sinks.map((sink, index) => (
                <span key={sink.number}>
                  {index > 0 && ', '}
                  <strong>Q{sink.number}</strong> ({signed(sink.gap)})
                </span>
              ))}
            </>
          )}
        </p>
      ) : (
        <p className={styles.insight}>
          Average and best times per question appear once enough candidates have sat this paper.
        </p>
      )}

      <ul className={styles.legend}>
        {shownView === 'time' ? (
          <>
            <li className={styles.legendItem}>
              <span className={styles.swatchYou} /> Your time
            </li>
            {hasAverage && (
              <li className={styles.legendItem}>
                <span className={styles.swatchAverage} /> Average
              </li>
            )}
            {hasBest && (
              <li className={styles.legendItem}>
                <span className={styles.swatchBest} /> Best
              </li>
            )}
          </>
        ) : (
          <>
            <li className={styles.legendItem}>
              <span className={styles.swatchSlower} /> ▲ Slower than average
            </li>
            <li className={styles.legendItem}>
              <span className={styles.swatchFaster} /> ▼ Faster than average
            </li>
          </>
        )}
        <li className={styles.legendItem}>✓ Correct · ✕ Incorrect · – Unattempted</li>
      </ul>

      <div className={styles.chartWrap}>
        <div className={styles.chartScroll}>
          <div className={styles.chartInner} style={{ minWidth: width > MIN_WIDTH ? width : 640 }}>
            <svg
              viewBox={`0 0 ${width} ${HEIGHT}`}
              className={styles.chart}
              role="img"
              aria-label={
                shownView === 'time'
                  ? 'Time per question, with the average and best times marked'
                  : 'Seconds over or under the average time, per question'
              }
              onMouseLeave={() => setActive(null)}
            >
              {ticks.map((tick) => (
                <g key={tick}>
                  <line
                    x1={PAD.left}
                    x2={width - PAD.right}
                    y1={yOf(tick)}
                    y2={yOf(tick)}
                    className={tick === 0 ? styles.zeroLine : styles.gridLine}
                  />
                  <text x={PAD.left - 10} y={yOf(tick) + 4} textAnchor="end" className={styles.axisText}>
                    {shownView === 'gap' && tick > 0 ? `+${tick}` : tick}
                  </text>
                </g>
              ))}

              <text
                className={styles.axisTitle}
                transform={`translate(14 ${PAD.top + PLOT_HEIGHT / 2}) rotate(-90)`}
                textAnchor="middle"
              >
                {shownView === 'time' ? 'Seconds' : 'Seconds vs average'}
              </text>

              {questions.map((question, index) => {
                const centre = centreOf(index);
                const isActive = active === index;
                const gap = gaps[index] ?? null;

                return (
                  <g
                    key={question.number}
                    tabIndex={0}
                    role="img"
                    aria-label={describe(question)}
                    className={styles.column}
                    onMouseEnter={() => setActive(index)}
                    onFocus={() => setActive(index)}
                    onBlur={() => setActive(null)}
                  >
                    {/* Hit area and hover band — the whole column, not just the bar. */}
                    <rect
                      x={centre - groupWidth / 2}
                      y={PAD.top}
                      width={groupWidth}
                      height={PLOT_HEIGHT}
                      className={isActive ? styles.bandActive : styles.band}
                    />

                    {shownView === 'time' ? (
                      <>
                        <rect
                          x={centre - barWidth / 2}
                          y={yOf(question.yourTimeSeconds)}
                          width={barWidth}
                          height={Math.max(0, yOf(0) - yOf(question.yourTimeSeconds))}
                          rx={Math.min(4, barWidth / 3)}
                          className={styles.barYou}
                        />
                        {question.averageTimeSeconds !== null && (
                          <line
                            x1={centre - barWidth / 2 - 5}
                            x2={centre + barWidth / 2 + 5}
                            y1={yOf(question.averageTimeSeconds)}
                            y2={yOf(question.averageTimeSeconds)}
                            className={styles.averageTick}
                          />
                        )}
                        {question.topperTimeSeconds !== null && (
                          <circle cx={centre} cy={yOf(question.topperTimeSeconds)} r={5} className={styles.bestDot} />
                        )}
                      </>
                    ) : (
                      gap !== null && (
                        <rect
                          x={centre - barWidth / 2}
                          y={gap >= 0 ? yOf(gap) : yOf(0)}
                          width={barWidth}
                          height={Math.max(gap === 0 ? 1 : 0, Math.abs(yOf(gap) - yOf(0)))}
                          rx={Math.min(3, barWidth / 3)}
                          className={gap > 0 ? styles.barSlower : styles.barFaster}
                        />
                      )
                    )}

                    <text x={centre} y={PAD.top + PLOT_HEIGHT + 18} textAnchor="middle" className={styles.questionText}>
                      {question.number}
                    </text>
                    <text
                      x={centre}
                      y={PAD.top + PLOT_HEIGHT + 34}
                      textAnchor="middle"
                      className={`${styles.outcomeText} ${styles[question.outcome] ?? ''}`}
                    >
                      {OUTCOME[question.outcome].glyph}
                    </text>
                  </g>
                );
              })}

              <line x1={PAD.left} x2={width - PAD.right} y1={yOf(bottom)} y2={yOf(bottom)} className={styles.axisLine} />
            </svg>

            {activeQuestion && active !== null && (
              <div
                className={styles.tooltip}
                style={{
                  left: `${(centreOf(active) / width) * 100}%`,
                  transform: `translateX(${active > questions.length / 2 ? '-100%' : '0'})`,
                }}
                role="presentation"
              >
                <Tooltip question={activeQuestion} />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={styles.totals}>
        <Total icon="⏱️" label="Your total time" value={formatClock(totals.you)} />
        <Total
          icon="👥"
          label="Average total"
          value={totals.average === null ? '—' : formatClock(totals.average)}
          note={totals.average === null ? undefined : compareNote(totals.you, totals.average)}
        />
        <Total
          icon="🏆"
          label="Best sitting's total"
          value={totals.best === null ? '—' : formatClock(totals.best)}
          note={totals.best === null ? undefined : compareNote(totals.you, totals.best)}
        />
      </div>
    </section>
  );
}

function describe(question: QuestionResult): string {
  const parts = [`Question ${question.number}, ${OUTCOME[question.outcome].label.toLowerCase()}`, `you ${question.yourTimeSeconds} seconds`];
  if (question.averageTimeSeconds !== null) parts.push(`average ${question.averageTimeSeconds} seconds`);
  if (question.topperTimeSeconds !== null) parts.push(`best ${question.topperTimeSeconds} seconds`);
  return parts.join(', ');
}

function Tooltip({ question }: { question: QuestionResult }) {
  const gap = gapOf(question);
  return (
    <>
      <p className={styles.tooltipHead}>
        Q{question.number}{' '}
        <span className={`${styles.tooltipOutcome} ${styles[question.outcome] ?? ''}`}>
          {OUTCOME[question.outcome].glyph} {OUTCOME[question.outcome].label}
        </span>
      </p>
      <dl className={styles.tooltipRows}>
        <div>
          <dt>
            <span className={styles.swatchYou} /> You
          </dt>
          <dd>{question.yourTimeSeconds}s</dd>
        </div>
        {question.averageTimeSeconds !== null && (
          <div>
            <dt>
              <span className={styles.swatchAverage} /> Average
            </dt>
            <dd>
              {question.averageTimeSeconds}s
              {gap !== null && Math.round(gap) !== 0 && (
                <span className={gap > 0 ? styles.slowerText : styles.fasterText}>
                  {' '}
                  ({signed(gap)} {gap > 0 ? 'slower' : 'faster'})
                </span>
              )}
            </dd>
          </div>
        )}
        {question.topperTimeSeconds !== null && (
          <div>
            <dt>
              <span className={styles.swatchBest} /> Best
            </dt>
            <dd>{question.topperTimeSeconds}s</dd>
          </div>
        )}
      </dl>
    </>
  );
}

function compareNote(you: number, other: number): string {
  const diff = Math.round(you - other);
  if (Math.abs(diff) < 1) return 'same as you';
  const amount = formatClock(Math.abs(diff)).replace(/^00:/, '');
  return diff > 0 ? `you were ${amount} slower` : `you were ${amount} faster`;
}

function Total({ icon, label, value, note }: { icon: string; label: string; value: string; note?: string }) {
  return (
    <div className={styles.total}>
      <span className={styles.totalIcon} aria-hidden="true">
        {icon}
      </span>
      <span>
        <strong className={styles.totalValue}>{value}</strong>
        <span className={styles.totalLabel}>{label}</span>
        {note && <span className={styles.totalNote}>{note}</span>}
      </span>
    </div>
  );
}
