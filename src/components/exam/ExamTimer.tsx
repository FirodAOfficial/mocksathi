'use client';

import { useEffect, useRef, useState } from 'react';
import { formatDuration } from '@/exam/types';
import styles from './ExamTimer.module.css';

export interface ExamTimerProps {
  /** Total time allowed, in seconds. */
  durationSeconds: number;
  /** Below this many seconds remaining, the timer shows its warning state. */
  warnAtSeconds?: number;
  /** Called once, when the countdown reaches zero. */
  onExpire?: () => void;
}

/** Recomputed often enough that the displayed second never visibly sticks. */
const TICK_MS = 250;

/**
 * A countdown for the remaining exam time.
 *
 * The remaining time is derived from a fixed deadline rather than by
 * decrementing a counter each tick. Browsers throttle timers in background
 * tabs, so a decrementing counter silently runs slow — the clock would be
 * wrong by however long the candidate looked at another tab.
 */
export function ExamTimer({ durationSeconds, warnAtSeconds = 60, onExpire }: ExamTimerProps) {
  const [remaining, setRemaining] = useState(durationSeconds);

  // Held in a ref so a changing callback identity does not restart the clock.
  const onExpireRef = useRef(onExpire);
  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    // The deadline is fixed when the countdown starts and lives in the effect's
    // closure. Reading the clock during render would make the component impure.
    const deadline = Date.now() + durationSeconds * 1000;

    let notified = false;
    const tick = (): void => {
      const secondsLeft = Math.max(0, (deadline - Date.now()) / 1000);
      setRemaining(secondsLeft);

      if (secondsLeft <= 0) {
        clearInterval(interval);
        // Guarded so the paper is closed exactly once, however the ticks land.
        if (!notified) {
          notified = true;
          onExpireRef.current?.();
        }
      }
    };

    const interval = setInterval(tick, TICK_MS);
    return () => clearInterval(interval);
  }, [durationSeconds]);

  const expired = remaining <= 0;
  const warning = !expired && remaining <= warnAtSeconds;
  const elapsedFraction = 1 - remaining / durationSeconds;

  return (
    <section
      className={[styles.timer, warning ? styles.warning : '', expired ? styles.expired : '']
        .filter(Boolean)
        .join(' ')}
      aria-label="Time remaining"
    >
      <div className={styles.header}>Time Remaining</div>

      {/*
        `role="timer"` without a live region: announcing every second would make
        the page unusable with a screen reader. The value is read on demand, and
        the expiry message below is what gets announced.
      */}
      <div className={styles.value} role="timer">
        {formatDuration(remaining)}
      </div>

      <div
        className={styles.track}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={durationSeconds}
        aria-valuenow={Math.ceil(remaining)}
        aria-valuetext={`${formatDuration(remaining)} remaining`}
      >
        <div className={styles.fill} style={{ width: `${Math.min(100, elapsedFraction * 100)}%` }} />
      </div>

      <p className={styles.note} role="status">
        {expired ? "Time's up" : warning ? 'Less than a minute left' : ''}
      </p>
    </section>
  );
}
