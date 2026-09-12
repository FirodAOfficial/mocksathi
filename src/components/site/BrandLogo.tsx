import styles from './BrandLogo.module.css';

/**
 * The MockSathi lockup: the rounded-square mark and the wordmark beside it.
 *
 * Drawn rather than loaded. There is no logo file in the repository, and the
 * five places that show the brand today each hand-roll a `<div>` with the
 * letter M in it — so this is the same mark those already draw, in one place
 * and as SVG, which keeps the corner radius and the optical centring of the M
 * from drifting between a 28px footer and a 46px header.
 *
 * Swap the `<svg>` body for a real asset when there is one; nothing outside
 * this file knows how the mark is made.
 */

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
      <svg
        className={styles.mark}
        viewBox="0 0 40 40"
        role="img"
        aria-label="MockSathi"
        focusable="false"
      >
        <rect width="40" height="40" rx="11" className={styles.markPlate} />
        {/*
          An M drawn as a path, not a text node: a font that is missing, still
          loading, or substituted would change the shape of the logo, and the
          mark is the one thing on the page that has to be the same every time.
        */}
        <path
          className={styles.markGlyph}
          d="M10 28.5V11.5h4.2l5.8 8.6 5.8-8.6H30v17h-4.1V18.4l-5.9 8.6-5.9-8.6v10.1z"
        />
      </svg>

      {markOnly ? null : (
        <span className={styles.wordmark}>
          Mock<span className={styles.wordmarkAccent}>Sathi</span>
        </span>
      )}
    </span>
  );
}
