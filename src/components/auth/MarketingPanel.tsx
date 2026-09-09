import type { ReactNode } from 'react';
import styles from './MarketingPanel.module.css';

const STROKE = {
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function MockIcon({ path }: { path: ReactNode }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {path}
    </svg>
  );
}

const STATS = [
  {
    label: 'Exam-oriented mock tasks',
    icon: (
      <g {...STROKE}>
        <path d="M6 2.5h8L19 7.5v14H6z" />
        <path d="M14 2.5v5h5" />
        <path d="m9 14 2.2 2.2L15.5 12" />
      </g>
    ),
  },
  {
    label: 'Detailed performance analysis',
    icon: (
      <g {...STROKE}>
        <path d="M3 3v18h18" />
        <path d="M8 17V11M13 17V7M18 17v-5" />
      </g>
    ),
  },
  {
    label: 'Track your improvement',
    icon: (
      <g {...STROKE}>
        <path d="m3 15 6-6 4 4 8-8" />
        <path d="M15 5h6v6" />
      </g>
    ),
  },
];

/**
 * The left panel of `/login` — adapted from a reference mockup that claimed
 * "365 Mocks Available", an exclusive Rajasthan-government affiliation, and
 * showed the Rajasthan Staff Selection Board / High Court emblems. None of
 * that is true of this app, and reproducing official government insignia is
 * legally restricted in India, so this keeps the layout and tone but not
 * those specific claims: the headline names the real target exams (RSSB LDC,
 * High Court) as what the content is aimed at — not an affiliation claim, no
 * emblems, nothing implying an official partnership with either body — and
 * the badges are generic Word/Excel-coloured squares rather than real Office
 * icons (also trademarked).
 */
export function MarketingPanel() {
  return (
    <div className={styles.panel}>
      <div className={styles.logoRow}>
        <div className={styles.logoMark}>MS</div>
        <div>
          <div className={styles.logoName}>Mocksathi</div>
          <div className={styles.logoTagline}>PRACTICE · ANALYSE · SUCCEED</div>
        </div>
      </div>

      <div className={styles.main}>
        <h1 className={styles.headline}>
          Master Efficiency Tests for Rajasthan&rsquo;s{' '}
          <span className={styles.headlineAccent}>RSSB LDC and High Court Exams</span>
        </h1>
        <p className={styles.subtitle}>
          Practice real exam-style Word and Excel tasks, review your solutions, and track how you
          improve mock over mock.
        </p>

        <div className={styles.badges}>
          <div className={styles.badge}>
            <div className={`${styles.badgeIcon} ${styles.badgeIconWord}`}>W</div>
            <span className={styles.badgeLabel}>Word Efficiency</span>
          </div>
          <div className={styles.badge}>
            <div className={`${styles.badgeIcon} ${styles.badgeIconExcel}`}>X</div>
            <span className={styles.badgeLabel}>Excel Efficiency</span>
          </div>
        </div>

        <div className={styles.featureStrip}>
          <span>Real exam tasks</span>
          <span>Practice</span>
          <span>Improve</span>
          <span>Score higher</span>
        </div>
      </div>

      <div>
        <div className={styles.statsRow}>
          {STATS.map((stat) => (
            <div className={styles.stat} key={stat.label}>
              <div className={styles.statIcon}>
                <MockIcon path={stat.icon} />
              </div>
              <span className={styles.statLabel}>{stat.label}</span>
            </div>
          ))}
        </div>
        <p className={styles.footerTagline}>PRACTICE TODAY. A BRIGHTER TOMORROW.</p>
      </div>
    </div>
  );
}
