import type { ReactNode } from 'react';
import styles from './RibbonGroup.module.css';

export interface RibbonGroupProps {
  label: string;
  children: ReactNode;
  /** Renders Word's launcher arrow, which opens the group's dialog. */
  onLaunch?: () => void;
  launchLabel?: string;
}

/**
 * One labelled cluster of controls, separated by a hairline rule.
 *
 * The group name is the accessible name of the region, so a screen reader user
 * hears "Font group" before its controls — the same structure sighted users get
 * from the caption underneath.
 */
export function RibbonGroup({ label, children, onLaunch, launchLabel }: RibbonGroupProps) {
  return (
    <section className={styles.group} aria-label={`${label} group`}>
      <div className={styles.body}>{children}</div>
      <div className={styles.label}>
        {label}
        {onLaunch ? (
          <button
            type="button"
            className={styles.launcher}
            title={launchLabel ?? `${label} settings`}
            aria-label={launchLabel ?? `${label} settings`}
            onMouseDown={(event) => event.preventDefault()}
            onClick={onLaunch}
          >
            <svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true">
              <path d="M1 1v8h8" fill="none" stroke="currentColor" strokeWidth="1" />
              <path d="M4 8.5h4.5V4" fill="none" stroke="currentColor" strokeWidth="1" />
            </svg>
          </button>
        ) : null}
      </div>
    </section>
  );
}

export function RibbonRow({ children }: { children: ReactNode }) {
  return <div className={styles.row}>{children}</div>;
}

export function RibbonColumn({ children }: { children: ReactNode }) {
  return <div className={styles.column}>{children}</div>;
}
