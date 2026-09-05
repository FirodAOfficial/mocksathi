import type { ReactNode } from 'react';
import styles from './ResultArt.module.css';

/**
 * The illustrative parts of the result screens.
 *
 * Everything here is inline SVG rather than image files: the marks are simple,
 * they need to inherit colour from their surroundings, and keeping them inline
 * means the screen has no image requests to wait on before it reads correctly.
 */

export function MockSathiLogo({ compact = false }: { compact?: boolean }) {
  return (
    <span className={styles.logo}>
      <svg viewBox="0 0 34 26" width={compact ? 26 : 32} height={compact ? 20 : 25} aria-hidden="true">
        <rect x="0" y="15" width="6" height="11" rx="2" fill="#f26b3a" />
        <rect x="8" y="10" width="6" height="16" rx="2" fill="#2f8fd0" />
        <rect x="16" y="5" width="6" height="21" rx="2" fill="#3f9c4a" />
        <rect x="24" y="0" width="6" height="26" rx="2" fill="#7b4fa8" />
      </svg>
      <span className={styles.logoText}>
        <span className={styles.logoName}>
          Mock<span className={styles.logoNameAccent}>Sathi</span>
        </span>
        <span className={styles.logoTagline}>PRACTICE TODAY. SUCCEED TOMORROW.</span>
      </span>
    </span>
  );
}

/** The rotated handwritten asides that sit in the margins of the design. */
export function HandNote({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={`${styles.handNote} ${className ?? ''}`} aria-hidden="true">
      {children}
    </span>
  );
}

export function TrophyArt() {
  return (
    <svg viewBox="0 0 200 170" className={styles.art} role="img" aria-label="Trophy">
      <g fill="none">
        {/* Confetti */}
        <rect x="12" y="30" width="13" height="13" rx="2" fill="#3f9c4a" transform="rotate(35 18 36)" />
        <rect x="170" y="22" width="12" height="12" rx="2" fill="#e8b53a" transform="rotate(20 176 28)" />
        <rect x="152" y="66" width="11" height="11" rx="2" fill="#e05a5a" transform="rotate(40 157 71)" />
        <rect x="24" y="96" width="11" height="11" rx="2" fill="#2f8fd0" transform="rotate(25 29 101)" />
        <rect x="6" y="66" width="10" height="10" rx="2" fill="#e8b53a" transform="rotate(15 11 71)" />
        <rect x="176" y="104" width="10" height="10" rx="2" fill="#3f9c4a" transform="rotate(30 181 109)" />
        <circle cx="44" cy="18" r="5" fill="#e05a5a" />
        <circle cx="150" cy="120" r="5" fill="#7b4fa8" />
      </g>

      {/* Cup */}
      <path d="M62 30h76v34a38 38 0 0 1-76 0z" fill="#f0b429" />
      <path d="M100 30h38v34a38 38 0 0 1-38 38z" fill="#d99a15" />
      {/* Handles */}
      <path d="M62 40H46a16 16 0 0 0 0 32h6" stroke="#e0a91d" strokeWidth="9" fill="none" strokeLinecap="round" />
      <path d="M138 40h16a16 16 0 0 1 0 32h-6" stroke="#e0a91d" strokeWidth="9" fill="none" strokeLinecap="round" />
      {/* Star */}
      <path
        d="m100 46 5.6 11.4 12.6 1.8-9.1 8.9 2.1 12.5L100 74.7 88.8 80.6l2.1-12.5-9.1-8.9 12.6-1.8z"
        fill="#fff3cd"
      />
      {/* Stem and base */}
      <rect x="92" y="102" width="16" height="20" fill="#d99a15" />
      <rect x="74" y="122" width="52" height="12" rx="3" fill="#e0a91d" />
      <rect x="64" y="134" width="72" height="14" rx="4" fill="#c98a10" />
    </svg>
  );
}

export function TargetArt() {
  return (
    <svg viewBox="0 0 200 170" className={styles.art} role="img" aria-label="Target">
      <circle cx="100" cy="85" r="66" fill="#fbe3e3" />
      <circle cx="100" cy="85" r="48" fill="#fff" />
      <circle cx="100" cy="85" r="48" fill="none" stroke="#f2b8b8" strokeWidth="2" />
      <circle cx="100" cy="85" r="32" fill="#fbd5d5" />
      <circle cx="100" cy="85" r="16" fill="#fff" />
      <circle cx="100" cy="85" r="16" fill="none" stroke="#f2b8b8" strokeWidth="2" />
      <circle cx="100" cy="85" r="6" fill="#e05a5a" />

      {/* Arrow, striking just off centre */}
      <path d="M104 81 168 26" stroke="#c94a4a" strokeWidth="6" strokeLinecap="round" />
      <path d="M150 22h22v22" stroke="#c94a4a" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export type MetaIcon = 'clock' | 'paper' | 'star' | 'target';

const META_PATHS: Record<MetaIcon, ReactNode> = {
  clock: (
    <>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" fill="none" />
      <path d="M12 7v5.5l3.5 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none" />
    </>
  ),
  paper: (
    <>
      <path d="M7 3h7l4 4v14H7z" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinejoin="round" />
      <path d="M14 3v4h4M10 12h6M10 16h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none" />
    </>
  ),
  star: (
    <path
      d="m12 4 2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 17.3 6.8 20l1-5.8-4.2-4.1 5.8-.8z"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
      fill="none"
    />
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" fill="none" />
      <path d="m8 12 3 3 5-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </>
  ),
};

export function MetaIconMark({ name }: { name: MetaIcon }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      {META_PATHS[name]}
    </svg>
  );
}
