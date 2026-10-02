import type { CSSProperties, ElementType, ReactNode } from 'react';
import styles from './Surfaces.module.css';

/* ---- Card ------------------------------------------------------------ */

export interface CardProps {
  children: ReactNode;
  /** A card that genuinely floats. Plain cards sit in the page with a border. */
  raised?: boolean;
  /** Removes the padding, for a card whose child owns its own edges (a table). */
  flush?: boolean;
  /** `section` or `article` where the card is a landmark, not just a box. */
  as?: ElementType;
  className?: string;
  'aria-label'?: string;
}

export function Card({ children, raised, flush, as: Tag = 'div', className, ...rest }: CardProps) {
  return (
    <Tag
      className={[styles.card, raised ? styles.cardRaised : '', flush ? styles.cardFlush : '', className ?? '']
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/* ---- Badge ----------------------------------------------------------- */

export type BadgeTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger';

/* The project types CSS-module keys as possibly-undefined, hence the `?? ''`. */
const BADGE_TONE: Record<BadgeTone, string> = {
  neutral: styles.badgeNeutral ?? '',
  brand: styles.badgeBrand ?? '',
  success: styles.badgeSuccess ?? '',
  warning: styles.badgeWarning ?? '',
  danger: styles.badgeDanger ?? '',
};

/**
 * A small status label.
 *
 * Colour alone never carries the meaning — the word inside it does. A red badge
 * reading "Failed" survives being read aloud, printed in greyscale, or seen by
 * someone who cannot tell it from the green one.
 */
export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: ReactNode }) {
  return <span className={`${styles.badge} ${BADGE_TONE[tone]}`}>{children}</span>;
}

/* ---- Skeleton -------------------------------------------------------- */

export interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  circle?: boolean;
  className?: string;
}

/**
 * A placeholder shaped like the thing that is coming.
 *
 * Decorative by itself: it is `aria-hidden`, and the region that holds it
 * should carry the `aria-busy` and the live message. A screen reader hearing
 * "loading, loading, loading" once per skeleton line is worse than silence.
 */
export function Skeleton({ width, height, circle, className }: SkeletonProps) {
  const style: CSSProperties = {};
  if (width !== undefined) style.width = typeof width === 'number' ? `${width}px` : width;
  if (height !== undefined) style.height = typeof height === 'number' ? `${height}px` : height;

  return (
    <span
      aria-hidden="true"
      className={[styles.skeleton, circle ? styles.skeletonCircle : '', className ?? ''].filter(Boolean).join(' ')}
      style={style}
    />
  );
}

/** Several lines of placeholder text, the last one short, as real text is. */
export function SkeletonText({ lines = 3, label = 'Loading…' }: { lines?: number; label?: string }) {
  return (
    <span role="status" aria-busy="true" aria-live="polite" aria-label={label}>
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} className={`${styles.skeleton} ${styles.skeletonText}`} aria-hidden="true" />
      ))}
    </span>
  );
}

/* ---- EmptyState ------------------------------------------------------ */

export interface EmptyStateProps {
  title: string;
  body: string;
  icon?: ReactNode;
  /** What to do about it. An empty state without a way forward is a dead end. */
  action?: ReactNode;
}

export function EmptyState({ title, body, icon, action }: EmptyStateProps) {
  return (
    <div className={styles.empty}>
      {icon ? (
        <span className={styles.emptyIcon} aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <p className={styles.emptyTitle}>{title}</p>
      <p className={styles.emptyBody}>{body}</p>
      {action ? <div className={styles.emptyAction}>{action}</div> : null}
    </div>
  );
}
