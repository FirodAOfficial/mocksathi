import styles from './BrandLogo.module.css';

/**
 * The MockSathi mark and lockup.
 *
 * The mark is the pencil: three rounded barrel strokes that read as an "m",
 * split by two cut-outs, over a graphite tip. Drawn as geometry rather than
 * loaded as a file so it stays crisp from the 24px footer to the 46px sign-in
 * panel, inherits nothing from a font that might be missing or substituted,
 * and costs the page no image request before it reads correctly.
 *
 * The cut-outs are real holes — `fill-rule: evenodd`, not white paint — so the
 * mark sits on the navy footer and the white dashboard alike without carrying
 * a background of its own.
 *
 * This is the only definition of the mark. `src/app/icon.tsx` draws the same
 * geometry for the favicon, because `ImageResponse` cannot import a component;
 * change the two together.
 */

/** The barrel's three lobes, with the two cut-outs between them. */
const BARREL =
  'M0 61V9a9 9 0 0 1 18 0 9 9 0 0 1 18 0 9 9 0 0 1 18 0v52q-9 6-18-.5-9 6.5-18 0Q9 67 0 61Z' +
  'M16.7 13.3a1.3 1.3 0 0 1 2.6 0v47.4a1.3 1.3 0 0 1-2.6 0z' +
  'M34.7 13.3a1.3 1.3 0 0 1 2.6 0v47.4a1.3 1.3 0 0 1-2.6 0z';

/** The graphite tip, scalloped to the barrel's underside and cut to match. */
const TIP =
  'M0 63q9 6 18-.5 9 6.5 18 0Q45 69 54 63L29.6 90a3.4 3.4 0 0 1-5.2 0Z' +
  'M16.7 64.6a1.3 1.3 0 0 1 2.6 0v3.6a1.3 1.3 0 0 1-2.6 0z' +
  'M34.7 64.6a1.3 1.3 0 0 1 2.6 0v3.6a1.3 1.3 0 0 1-2.6 0z';

export interface BrandMarkProps {
  /** Height of the mark in pixels. The width follows from its proportions. */
  size?: number;
  /** `light` for dark backgrounds, `dark` for light ones. */
  tone?: 'light' | 'dark';
  className?: string;
}

/** The mark on its own, for the places that set their own wordmark. */
export function BrandMark({ size = 34, tone = 'dark', className }: BrandMarkProps) {
  return (
    <svg
      className={`${styles.mark} ${tone === 'light' ? styles.light : styles.dark} ${className ?? ''}`}
      style={{ '--mark-size': `${size}px` } as React.CSSProperties}
      viewBox="0 0 54 92"
      role="img"
      aria-label="MockSathi"
      focusable="false"
    >
      <path className={styles.markBarrel} fillRule="evenodd" d={BARREL} />
      <path className={styles.markTip} fillRule="evenodd" d={TIP} />
    </svg>
  );
}

export interface BrandLogoProps {
  /** Height of the mark in pixels; the wordmark scales with it. */
  size?: number;
  /** `light` for dark backgrounds, `dark` for light ones. */
  tone?: 'light' | 'dark';
  /** Hides the wordmark, leaving the mark alone. */
  markOnly?: boolean;
}

export function BrandLogo({ size = 34, tone = 'light', markOnly = false }: BrandLogoProps) {
  return (
    <span
      className={`${styles.lockup} ${tone === 'light' ? styles.light : styles.dark}`}
      style={{ '--mark-size': `${size}px` } as React.CSSProperties}
    >
      <BrandMark size={size} tone={tone} />

      {markOnly ? null : (
        <span className={styles.wordmark}>
          Mock<span className={styles.wordmarkAccent}>Sathi</span>
        </span>
      )}
    </span>
  );
}
