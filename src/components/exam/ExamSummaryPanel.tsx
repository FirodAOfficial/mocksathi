'use client';

import { useMemo, useState } from 'react';
import { allQuestions, statusOf, summarise, STATUS_LABEL, type QuestionStatus } from '@/exam/types';
import { answeredSet, useExamStore } from '@/state/examStore';
import { Popover } from '../controls/Popover';
import { ExamTimer } from './ExamTimer';
import { QuestionActions } from './QuestionActions';
import { QuestionPalette } from './QuestionPalette';
import styles from './ExamSummaryPanel.module.css';

/** `null` shows every question; `'bookmarked'` cuts across the statuses. */
type PaletteFilter = QuestionStatus | 'bookmarked' | null;

const FILTERS: { value: PaletteFilter; label: string }[] = [
  { value: null, label: 'All questions' },
  { value: 'attempted', label: 'Attempted' },
  { value: 'unattempted', label: 'Not attempted' },
  { value: 'bookmarked', label: 'Marked for review' },
];

export interface ExamSummaryPanelProps {
  /** Restores the open question's document to its starting text. */
  onClearAnswer: () => void;
  /** Stores what is currently typed. */
  onSaveAnswer: () => void;
}

/**
 * The candidate panel on the right: who is sitting the paper, how far through
 * they are, how much time is left, and a palette for moving between questions.
 */
export function ExamSummaryPanel({ onClearAnswer, onSaveAnswer }: ExamSummaryPanelProps) {
  const attempt = useExamStore((state) => state.attempt);
  const answers = useExamStore((state) => state.answers);
  const selectedNumber = useExamStore((state) => state.selectedNumber);
  const selectQuestion = useExamStore((state) => state.selectQuestion);
  const submit = useExamStore((state) => state.submit);

  const [filter, setFilter] = useState<PaletteFilter>(null);

  // `answers` is a stable reference; the derived set is rebuilt only when it
  // actually changes.
  const answered = useMemo(() => answeredSet(answers), [answers]);
  const counts = useMemo(() => summarise(attempt, answered), [attempt, answered]);

  const activeFilter = FILTERS.find((option) => option.value === filter) ?? FILTERS[0];

  const matches = (question: { number: number; bookmarked: boolean }): boolean => {
    if (filter === null) return true;
    if (filter === 'bookmarked') return question.bookmarked;
    return statusOf(question as never, answered) === filter;
  };

  /**
   * Time is up: whatever is in the editor is stored, then the paper closes.
   * Saving first is what makes it an auto-submit rather than a discard.
   */
  const handleExpiry = (): void => {
    onSaveAnswer();
    submit('timeout');
  };

  return (
    <aside className={styles.panel} aria-label="Candidate summary">
      <header className={styles.header}>
        <span className={styles.avatar} aria-hidden="true">
          <svg viewBox="0 0 32 32" width="26" height="26">
            <circle cx="16" cy="16" r="16" fill="#2f8fd0" />
            <circle cx="16" cy="12" r="5.5" fill="#ffffff" />
            <path d="M5 29a11 11 0 0 1 22 0z" fill="#ffffff" />
          </svg>
        </span>
        <h2 className={styles.name}>{attempt.candidateName}</h2>

        <Popover
          align="end"
          trigger={({ open, toggle, id, controls }) => (
            <button
              id={id}
              type="button"
              data-popover-trigger
              className={`${styles.filterButton} ${open ? styles.filterButtonOpen : ''}`}
              aria-haspopup="menu"
              aria-expanded={open}
              aria-controls={open ? controls : undefined}
              onClick={toggle}
            >
              <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
                <path
                  d="M1.5 2.5h13l-5 5.5v5l-3 1.5v-6.5z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  strokeLinejoin="round"
                />
              </svg>
              {activeFilter?.label === 'All questions' ? 'Filter' : activeFilter?.label}
            </button>
          )}
        >
          {({ close }) => (
            <div className={styles.filterMenu}>
              {FILTERS.map((option) => (
                <button
                  key={option.label}
                  type="button"
                  role="menuitemradio"
                  aria-checked={option.value === filter}
                  className={`${styles.filterOption} ${option.value === filter ? styles.filterOptionActive : ''}`}
                  onClick={() => {
                    setFilter(option.value);
                    close();
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </Popover>
      </header>

      <ul className={styles.legend}>
        <li className={styles.legendItem}>
          <span className={`${styles.swatch} ${styles.swatchAttempted ?? ''}`}>{counts.attempted}</span>
          {STATUS_LABEL.attempted}
        </li>
        <li className={styles.legendItem}>
          <span className={`${styles.swatch} ${styles.swatchUnattempted ?? ''}`}>{counts.unattempted}</span>
          {STATUS_LABEL.unattempted}
        </li>
        <li className={styles.legendItem}>
          <span className={`${styles.swatch} ${styles.swatchMarked ?? ''}`}>{counts.markedForReview}</span>
          Marked for Review
        </li>
      </ul>

      <ExamTimer durationSeconds={attempt.durationSeconds} onExpire={handleExpiry} />

      <div className={styles.sections}>
        {attempt.sections.map((section) => (
          <section key={section.name}>
            <h3 className={styles.sectionName}>
              <span className={styles.sectionLabel}>SECTION :</span> {section.name}
            </h3>
            <QuestionPalette
              questions={section.questions.filter(matches)}
              answered={answered}
              selectedNumber={selectedNumber}
              onSelect={selectQuestion}
            />
          </section>
        ))}
      </div>

      <QuestionActions onClearAnswer={onClearAnswer} onSaveAnswer={onSaveAnswer} />

      {/* Announced when filtering changes what the palette shows. */}
      <p className={styles.visuallyHidden} role="status">
        {filter === null
          ? `Showing all ${allQuestions(attempt).length} questions`
          : `Showing ${allQuestions(attempt).filter(matches).length} ${activeFilter?.label.toLowerCase()} questions`}
      </p>
    </aside>
  );
}
