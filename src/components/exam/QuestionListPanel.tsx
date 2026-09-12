'use client';

import { useEffect, useRef, type KeyboardEvent } from 'react';
import { useExamStore } from '@/state/examStore';
import { allQuestions, localised } from '@/exam/types';
import styles from './QuestionListPanel.module.css';

/** Breathing room left between the selected item and the edge it scrolled to. */
const SCROLL_MARGIN_PX = 8;

/**
 * The question list down the left-hand side.
 *
 * The list scrolls independently of the page, and selecting a question — from
 * here, from the palette on the right, or with the arrow keys — scrolls that
 * question into view. Without that, picking question 23 from the palette would
 * leave this list sitting at the top showing question 1.
 */
export function QuestionListPanel() {
  const attempt = useExamStore((state) => state.attempt);
  const selectedNumber = useExamStore((state) => state.selectedNumber);
  const selectQuestion = useExamStore((state) => state.selectQuestion);
  const stepQuestion = useExamStore((state) => state.stepQuestion);

  const answers = useExamStore((state) => state.answers);
  const language = useExamStore((state) => state.language);

  const listRef = useRef<HTMLDivElement>(null);
  const questions = allQuestions(attempt);
  // Only edited questions are stored, so membership is the "has edits" test.
  const edited = new Set(Object.keys(answers).map(Number));

  useEffect(() => {
    const container = listRef.current;
    const selected = container?.querySelector<HTMLElement>('[data-selected="true"]');
    if (!container || !selected) return;

    // Scroll only when the item is actually out of view, so selecting an
    // already-visible question does not make the list jump.
    //
    // The scroll offset is computed and assigned rather than delegating to
    // `scrollIntoView`: its smooth behaviour is unreliable for a nested scroll
    // container — in testing it left the list at scrollTop 0 while the plain
    // assignment below moved it correctly every time.
    const containerBox = container.getBoundingClientRect();
    const itemBox = selected.getBoundingClientRect();

    if (itemBox.top < containerBox.top) {
      container.scrollTop -= containerBox.top - itemBox.top + SCROLL_MARGIN_PX;
    } else if (itemBox.bottom > containerBox.bottom) {
      container.scrollTop += itemBox.bottom - containerBox.bottom + SCROLL_MARGIN_PX;
    }
  }, [selectedNumber]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    // Home and End jump to the ends of the list, which the listbox pattern
    // asks for and which a 15-question paper makes worth having: without them
    // the only way back to question 1 is fourteen presses of ArrowUp.
    if (event.key === 'Home' || event.key === 'End') {
      const target = event.key === 'Home' ? questions.at(0) : questions.at(-1);
      if (!target) return;

      event.preventDefault();
      selectQuestion(target.number);
      return;
    }

    const direction = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
    if (direction === 0) return;

    event.preventDefault();
    stepQuestion(direction);
  };

  return (
    <aside className={styles.panel} aria-label="Questions">
      <h2 className={styles.heading}>Questions:</h2>

      <div
        className={styles.list}
        ref={listRef}
        role="listbox"
        aria-label="Question list"
        aria-activedescendant={`question-item-${selectedNumber}`}
        tabIndex={0}
        onKeyDown={onKeyDown}
      >
        {questions.map((question) => {
          const selected = question.number === selectedNumber;

          return (
            <div
              key={question.number}
              id={`question-item-${question.number}`}
              role="option"
              aria-selected={selected}
              data-selected={selected}
              className={`${styles.item} ${selected ? styles.itemSelected : ''}`}
              onClick={() => selectQuestion(question.number)}
            >
              <span className={styles.itemInner}>
                <span className={styles.number}>{question.number}</span>
                <span className={styles.prompt}>{localised(question.instruction, language)}</span>

                <span className={styles.badges}>
                  {edited.has(question.number) ? (
                    <span className={styles.editedDot} title="Edited" aria-label="edited" role="img" />
                  ) : null}
                  {question.bookmarked ? (
                    <span className={styles.markedDot} title="Marked for review" aria-label="marked for review" role="img" />
                  ) : null}
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
