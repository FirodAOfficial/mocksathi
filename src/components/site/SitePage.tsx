import Link from 'next/link';
import type { ReactNode } from 'react';
import styles from './SitePage.module.css';

/**
 * The frame every public page shares: a masthead that leads back into the app,
 * a titled content column, and the footer supplied by the route group layout.
 *
 * `lastUpdated` is what separates a policy page from an ordinary one. A payment
 * gateway reviewing the refund terms, and a user disputing them, both need to
 * know which version they are reading.
 */
export interface SitePageProps {
  title: string;
  intro?: ReactNode;
  lastUpdated?: string;
  children: ReactNode;
}

export function SitePage({ title, intro, lastUpdated, children }: SitePageProps) {
  return (
    <>
      <header className={styles.masthead}>
        <Link href="/login" className={styles.brand}>
          <span className={styles.logoMark} aria-hidden="true">
            MS
          </span>
          <span className={styles.logoName}>MockSathi</span>
        </Link>

        <Link href="/login" className={styles.signIn}>
          Sign in
        </Link>
      </header>

      <main className={styles.page}>
        <div className={styles.header}>
          <h1 className={styles.title}>{title}</h1>
          {lastUpdated ? <p className={styles.updated}>Last updated: {lastUpdated}</p> : null}
          {intro ? <div className={styles.intro}>{intro}</div> : null}
        </div>

        <div className={styles.body}>{children}</div>
      </main>
    </>
  );
}

/** One numbered section of a policy. */
export function Section({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>{heading}</h2>
      {children}
    </section>
  );
}

export function SubHeading({ children }: { children: ReactNode }) {
  return <h3 className={styles.subHeading}>{children}</h3>;
}

export function Bullets({ children }: { children: ReactNode }) {
  return <ul className={styles.bullets}>{children}</ul>;
}

export function Steps({ children }: { children: ReactNode }) {
  return <ol className={styles.steps}>{children}</ol>;
}

/**
 * A two-column table of situations and outcomes.
 *
 * Kept as a real table rather than a list: the refund page is read to find
 * one row, and a reader scanning for their own situation needs the pairing to
 * hold on a narrow screen too, which is why it scrolls rather than reflows.
 */
export function Table({ columns, rows }: { columns: [string, string]; rows: Array<[ReactNode, ReactNode]> }) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">{columns[0]}</th>
            <th scope="col">{columns[1]}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              <td>{row[0]}</td>
              <td>{row[1]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
