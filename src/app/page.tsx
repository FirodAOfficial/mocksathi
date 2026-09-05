import Link from 'next/link';
import styles from './page.module.css';

/**
 * Entry point. The editor itself is addressed by URL (`/editor?docUrl=...`),
 * so this page exists to build that address and to offer a blank document.
 */
export default function HomePage() {
  return (
    <main className={styles.screen}>
      <div className={styles.card}>
        <h1 className={styles.title}>Document Editor</h1>
        <p className={styles.subtitle}>
          Open a Word document (.docx) from a public web address, or start with a blank page.
        </p>

        <form action="/editor" method="get">
          <label className={styles.label} htmlFor="docUrl">
            Document address
          </label>
          <div className={styles.row}>
            <input
              id="docUrl"
              name="docUrl"
              type="url"
              className={styles.input}
              placeholder="https://example.com/report.docx"
              required
            />
            <button type="submit" className={styles.primary}>
              Open
            </button>
          </div>
        </form>

        <hr className={styles.divider} />

        <Link href="/editor" className={styles.blank}>
          Start a blank document
        </Link>

        <p className={styles.hint}>
          Documents are fetched server-side, so the address must be reachable from the internet.
          Private and internal addresses are refused.
        </p>
      </div>
    </main>
  );
}
