import Link from 'next/link';
import { outcomeOf, type ExamResult } from '@/exam/result';
import { OverallPerformance } from './OverallPerformance';
import { PerformanceBreakdown } from './PerformanceBreakdown';
import { HandNote, MetaIconMark, MockSathiLogo, type MetaIcon } from './ResultArt';
import { TimeAnalysis } from './TimeAnalysis';
import { TopperComparison } from './TopperComparison';
import styles from './ResultScreen.module.css';

export interface ResultScreenProps {
  result: ExamResult;
  /**
   * Opens the worked solutions. Omitted where there is no paper behind the
   * result to draw them from, and the button then says so rather than lying.
   */
  onViewSolutions?: () => void;
  /**
   * Where "Back to Tests" goes. The result screen has no opinion about what
   * came before it, so the destination is supplied by whoever renders it.
   */
  backHref?: string;
}

/**
 * The full-page result, in place of the dialog that used to appear on submit.
 *
 * Pure presentation over one `ExamResult`. It never reads the exam store, which
 * is what lets the preview route render the approved design figures and the
 * live app render a real submission through the same components.
 */
export function ResultScreen({ result, onViewSolutions, backHref = '/' }: ResultScreenProps) {
  const qualified = outcomeOf(result) === 'qualified';

  const meta: { icon: MetaIcon; tone: string; value: string; label: string }[] = [
    { icon: 'clock', tone: styles.toneViolet ?? '', value: `${result.totalTimeMinutes} Minutes`, label: 'Total Time' },
    { icon: 'paper', tone: styles.toneBlue ?? '', value: `${result.totalQuestions} Questions`, label: 'Total Questions' },
    { icon: 'star', tone: styles.toneAmber ?? '', value: `${result.maximumMarks} Marks`, label: 'Maximum Marks' },
    { icon: 'target', tone: styles.toneGreen ?? '', value: `${result.qualifyingMarks} Marks`, label: 'Qualifying Marks' },
  ];

  return (
    <div className={styles.page}>
      <header className={styles.topBar}>
        <MockSathiLogo />

        <div className={styles.testName}>
          <span className={styles.testIcon} aria-hidden="true">
            <MetaIconMark name="paper" />
          </span>
          <span>
            <strong className={styles.testTitle}>{result.testName}</strong>
            <span className={styles.testTagline}>{result.tagline}</span>
          </span>
        </div>

        <div className={styles.topActions}>
          <Link href={backHref} className={styles.ghostButton}>
            <span aria-hidden="true">←</span> Back to Tests
          </Link>
          <ViewSolutionsButton onClick={onViewSolutions} />
        </div>
      </header>

      <div className={styles.metaRow}>
        {meta.map((item) => (
          <div key={item.label} className={styles.metaCard}>
            <span className={`${styles.metaIcon} ${item.tone}`}>
              <MetaIconMark name={item.icon} />
            </span>
            <span>
              <strong className={styles.metaValue}>{item.value}</strong>
              <span className={styles.metaLabel}>{item.label}</span>
            </span>
          </div>
        ))}
        <HandNote className={styles.metaNote}>{'Practice\nAnalyse\nSucceed'}</HandNote>
      </div>

      <OverallPerformance result={result} />
      <PerformanceBreakdown result={result} />
      <TopperComparison result={result} />
      <TimeAnalysis result={result} />

      <section className={styles.solutions}>
        <span className={styles.solutionsIcon} aria-hidden="true">
          <MetaIconMark name="paper" />
        </span>
        <span className={styles.solutionsText}>
          <strong className={styles.solutionsTitle}>Solutions</strong>
          <span className={styles.solutionsBody}>
            Review detailed solutions, answer explanations and topic-wise analysis.
          </span>
        </span>
        <ViewSolutionsButton variant="outline" onClick={onViewSolutions} />
      </section>

      <footer className={styles.footer}>
        <MockSathiLogo compact />
        <ul className={styles.footerPoints}>
          <li>
            <span aria-hidden="true">🎯</span> Real Exam Experience
          </li>
          <li>
            <span aria-hidden="true">📊</span> Detailed Analysis
          </li>
          <li>
            <span aria-hidden="true">👑</span> Higher Rank
          </li>
        </ul>
        <HandNote className={styles.footerNote}>
          {qualified ? 'Small Steps\nBig Success' : 'You Can\nDo It!'}
        </HandNote>
      </footer>
    </div>
  );
}

/** Disabled without a handler, rather than pretending to lead somewhere. */
function ViewSolutionsButton({
  variant = 'solid',
  onClick,
}: {
  variant?: 'solid' | 'outline';
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className={variant === 'solid' ? styles.primaryButton : styles.outlineButton}
      disabled={!onClick}
      onClick={onClick}
      title={onClick ? 'View Solutions' : 'View Solutions — not available for this result'}
    >
      <MetaIconMark name="paper" />
      View Solutions
    </button>
  );
}
