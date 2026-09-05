import type { ReactNode } from 'react';
import styles from './RibbonGroup.module.css';

export interface RibbonGroupProps {
  label: string;
  children: ReactNode;
}

/**
 * One labelled cluster of controls, separated by a hairline rule.
 *
 * The group name is the accessible name of the region, so a screen reader user
 * hears "Font group" before its controls — the same structure sighted users get
 * from the caption underneath.
 */
export function RibbonGroup({ label, children }: RibbonGroupProps) {
  return (
    <section className={styles.group} aria-label={`${label} group`}>
      <div className={styles.body}>{children}</div>
      <div className={styles.label}>{label}</div>
    </section>
  );
}

export function RibbonRow({ children }: { children: ReactNode }) {
  return <div className={styles.row}>{children}</div>;
}

export function RibbonColumn({ children }: { children: ReactNode }) {
  return <div className={styles.column}>{children}</div>;
}
