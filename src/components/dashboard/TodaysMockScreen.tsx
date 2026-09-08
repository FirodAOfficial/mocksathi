import Link from 'next/link';
import type { MockSummary } from '@/dashboard/types';
import styles from './TodaysMockScreen.module.css';

export interface TodaysMockScreenProps {
  todaysMock: MockSummary;
}

/**
 * Today's Mock — how a candidate actually starts something.
 *
 * This was the app's original `/` entry point (sit the sample exam, open a
 * `.docx`, or start blank) before the dashboard became the default landing
 * page — moved here rather than duplicated, since "start today's mock" and
 * "start something new" are the same action from the candidate's side.
 * Restyled to the dashboard's card system; the three options themselves are
 * unchanged.
 */
export function TodaysMockScreen({ todaysMock }: TodaysMockScreenProps) {
  return (
    <>
      <div className={styles.header}>
        <h1 className={styles.title}>Today&apos;s Mock</h1>
        <p className={styles.subtitle}>
          Mock {todaysMock.mockNumber} · {todaysMock.paperName}
        </p>
      </div>

      <div className={styles.grid}>
        <div className={styles.card}>
          <p className={styles.cardTitle}>Sit the mock</p>
          <p className={styles.cardBody}>
            Fifteen word-processing tasks, ten minutes. The instructions page covers the rules and
            is where the language is chosen.
          </p>
          <Link href="/exam" className={styles.primary}>
            Read the instructions
          </Link>
        </div>

        <div className={styles.card}>
          <p className={styles.cardTitle}>Open a document</p>
          <p className={styles.cardBody}>Practise on a real document instead, fetched from a URL.</p>
          <form action="/editor" method="get" className={styles.form}>
            <div className={styles.inputRow}>
              <label className={styles.srOnly} htmlFor="docUrl">
                Document address
              </label>
              <input
                id="docUrl"
                name="docUrl"
                type="url"
                className={styles.input}
                placeholder="https://example.com/report.docx"
                required
              />
              <button type="submit" className={styles.secondary}>
                Open
              </button>
            </div>
            <p className={styles.hint}>
              Fetched server-side, so the address must be reachable from the internet. Private and
              internal addresses are refused.
            </p>
          </form>
        </div>

        <div className={styles.card}>
          <p className={styles.cardTitle}>Start blank</p>
          <p className={styles.cardBody}>Skip straight to an empty document in the editor.</p>
          <Link href="/editor" className={styles.blankLink}>
            Start a blank document →
          </Link>
        </div>
      </div>
    </>
  );
}
