import Link from 'next/link';
import { LANGUAGES } from '@/exam/types';
import styles from './page.module.css';

/**
 * Entry point.
 *
 * Three ways in: sit the sample exam, open a .docx from a URL, or start with a
 * blank document. The exam needs a language before it begins, because the paper
 * is sat in one language — the passages and instructions both follow it, and
 * switching part-way would invalidate anything already written.
 */
export default function HomePage() {
  return (
    <main className={styles.screen}>
      <div className={styles.card}>
        <h1 className={styles.title}>Document Editor</h1>
        <p className={styles.subtitle}>
          Sit the sample word-processing exam, or open a Word document to edit.
        </p>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Sample exam</h2>
          <p className={styles.sectionBody}>
            Fifteen word-processing tasks, ten minutes. Choose the language you want to sit it in.
          </p>

          <form action="/editor" method="get" className={styles.row}>
            <input type="hidden" name="mode" value="exam" />
            <label className={styles.srOnly} htmlFor="lang">
              Exam language
            </label>
            <select id="lang" name="lang" className={styles.select} defaultValue="en">
              {LANGUAGES.map((language) => (
                <option key={language.value} value={language.value}>
                  {language.label}
                </option>
              ))}
            </select>
            <button type="submit" className={styles.primary}>
              Start sample exam
            </button>
          </form>
        </section>

        <hr className={styles.divider} />

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Open a document</h2>
          <form action="/editor" method="get" className={styles.row}>
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
          </form>
          <p className={styles.hint}>
            Documents are fetched server-side, so the address must be reachable from the internet.
            Private and internal addresses are refused.
          </p>
        </section>

        <hr className={styles.divider} />

        <Link href="/editor" className={styles.blank}>
          Start a blank document
        </Link>
      </div>
    </main>
  );
}
