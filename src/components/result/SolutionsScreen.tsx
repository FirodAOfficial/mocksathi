'use client';

import { useState } from 'react';
import type { JSONContent } from '@tiptap/core';
import { modelAnswerDocument } from '@/exam/seedAttempt';
import type { ExamResult, QuestionOutcome, QuestionResult } from '@/exam/result';
import { allQuestions, localised, type ExamAttempt, type ExamQuestion, type Language } from '@/exam/types';
import { PassagePreview } from './PassagePreview';
import { MetaIconMark, MockSathiLogo } from './ResultArt';
import styles from './SolutionsScreen.module.css';

export interface SolutionsScreenProps {
  /** The paper that was sat, for the instructions and the worked answers. */
  attempt: ExamAttempt;
  /** The marked result, for what happened on each question. */
  result: ExamResult;
  /**
   * What the candidate submitted, by question number.
   *
   * Absent on the design preview route, which has a result but no paper behind
   * it; the attempt panel then says the question was not attempted.
   */
  answers?: Record<number, JSONContent>;
  language: Language;
  onBack: () => void;
}

const OUTCOME_LABEL: Record<QuestionOutcome, string> = {
  correct: 'Correct',
  incorrect: 'Incorrect',
  unattempted: 'Not Attempted',
};

/**
 * The review screen: one question at a time, with what the candidate did beside
 * what the question wanted.
 *
 * The worked answer is rendered through the editor's own schema rather than
 * described in prose, so the candidate can see the formatting instead of
 * reading about it.
 */
export function SolutionsScreen({ attempt, result, answers, language, onBack }: SolutionsScreenProps) {
  const questions = allQuestions(attempt);
  const marked = new Map(result.questions.map((entry) => [entry.number, entry]));

  const [index, setIndex] = useState(0);
  const question = questions[Math.min(index, questions.length - 1)];

  if (!question) return null;

  const tally = {
    correct: result.questions.filter((entry) => entry.outcome === 'correct').length,
    incorrect: result.questions.filter((entry) => entry.outcome === 'incorrect').length,
    unattempted: result.questions.filter((entry) => entry.outcome === 'unattempted').length,
    review: questions.filter((entry) => entry.bookmarked).length,
  };

  return (
    <div className={styles.page}>
      <header className={styles.topBar}>
        <MockSathiLogo />
        <button type="button" className={styles.ghostButton} onClick={onBack}>
          <span aria-hidden="true">←</span> Back to Result
        </button>
      </header>

      <div className={styles.body}>
        <main className={styles.main}>
          <h1 className={styles.title}>
            {result.testName} <span className={styles.titleAside}>Solution &amp; Review</span>
          </h1>

          <QuestionNav
            index={index}
            total={questions.length}
            marks={question.marks}
            marked={marked.get(question.number)}
            onStep={(step) => setIndex((current) => clamp(current + step, questions.length))}
          />

          <section className={styles.card}>
            <div className={styles.cardHead}>
              <span className={styles.qChip}>Q{question.number}</span>
              <span className={styles.topic}>{question.topic}</span>
              <span className={`${styles.difficulty} ${styles[question.difficulty.toLowerCase()] ?? ''}`}>
                {question.difficulty}
              </span>
            </div>

            {/*
              The instruction only. The passage is not repeated here: it appears
              twice below already — as the candidate left it, and as it should
              have been — and a third, unformatted copy pushed that comparison
              off the screen.
            */}
            <p className={styles.instruction}>{localised(question.instruction, language)}</p>
          </section>

          <div className={styles.columns}>
            <AttemptPanel
              question={question}
              language={language}
              submitted={answers?.[question.number]}
              marked={marked.get(question.number)}
            />
            <ApproachPanel question={question} language={language} />
          </div>

          <nav className={styles.pager}>
            <button
              type="button"
              className={styles.ghostButton}
              disabled={index === 0}
              onClick={() => setIndex((current) => clamp(current - 1, questions.length))}
            >
              <span aria-hidden="true">←</span> Previous Question
            </button>
            <button
              type="button"
              className={styles.primaryButton}
              disabled={index === questions.length - 1}
              onClick={() => setIndex((current) => clamp(current + 1, questions.length))}
            >
              Next Question <span aria-hidden="true">→</span>
            </button>
          </nav>
        </main>

        <aside className={styles.palette}>
          <h2 className={styles.paletteTitle}>
            <span className={styles.paletteIcon} aria-hidden="true">
              <MetaIconMark name="paper" />
            </span>
            Question Palette
          </h2>

          <div className={styles.tally}>
            <Tally tone={styles.toneCorrect} count={tally.correct} label="Correct" />
            <Tally tone={styles.toneIncorrect} count={tally.incorrect} label="Incorrect" />
            <Tally tone={styles.toneSkipped} count={tally.unattempted} label="Not Attempted" />
            <Tally tone={styles.toneReview} count={tally.review} label="Marked for Review" />
          </div>

          <ol className={styles.grid}>
            {questions.map((entry, position) => {
              const outcome = marked.get(entry.number)?.outcome ?? 'unattempted';
              return (
                <li key={entry.number}>
                  <button
                    type="button"
                    aria-current={position === index ? 'true' : undefined}
                    aria-label={`Question ${entry.number}, ${OUTCOME_LABEL[outcome]}${
                      entry.bookmarked ? ', marked for review' : ''
                    }`}
                    className={[
                      styles.cell,
                      styles[outcome] ?? '',
                      position === index ? styles.current : '',
                      entry.bookmarked ? styles.bookmarked : '',
                    ].join(' ')}
                    onClick={() => setIndex(position)}
                  >
                    {entry.number}
                  </button>
                </li>
              );
            })}
          </ol>

          <ul className={styles.legend}>
            <li>
              <span className={`${styles.dot} ${styles.dotCorrect}`} /> Correct
            </li>
            <li>
              <span className={`${styles.dot} ${styles.dotIncorrect}`} /> Incorrect
            </li>
            <li>
              <span className={`${styles.dot} ${styles.dotSkipped}`} /> Not Attempted
            </li>
            <li>
              <span className={`${styles.dot} ${styles.dotReview}`} /> Marked for Review
            </li>
          </ul>
        </aside>
      </div>
    </div>
  );
}

function clamp(value: number, total: number): number {
  return Math.min(total - 1, Math.max(0, value));
}

function Tally({ tone, count, label }: { tone?: string; count: number; label: string }) {
  return (
    <div className={styles.tallyCard}>
      <span className={`${styles.tallyDot} ${tone ?? ''}`} aria-hidden="true" />
      <span>
        <strong className={styles.tallyCount}>{count}</strong>
        <span className={styles.tallyLabel}>{label}</span>
      </span>
    </div>
  );
}

function QuestionNav({
  index,
  total,
  marks,
  marked,
  onStep,
}: {
  index: number;
  total: number;
  marks: number;
  marked: QuestionResult | undefined;
  onStep: (step: number) => void;
}) {
  const outcome = marked?.outcome ?? 'unattempted';
  const awarded = outcome === 'correct' ? marks : 0;

  return (
    <div className={styles.nav}>
      <div className={styles.navSteps}>
        <button type="button" className={styles.stepButton} aria-label="Previous question" disabled={index === 0} onClick={() => onStep(-1)}>
          ‹
        </button>
        <span className={styles.navLabel}>
          Question {index + 1} of {total}
        </span>
        <button
          type="button"
          className={styles.stepButton}
          aria-label="Next question"
          disabled={index === total - 1}
          onClick={() => onStep(1)}
        >
          ›
        </button>
      </div>

      <span className={`${styles.verdict} ${styles[outcome] ?? ''}`}>{OUTCOME_LABEL[outcome]}</span>

      <dl className={styles.stats}>
        <div>
          <dt>Marks</dt>
          <dd className={awarded > 0 ? styles.positive : ''}>
            {awarded > 0 ? `+${awarded}` : awarded} / {marks}
          </dd>
        </div>
        <div>
          <dt>Your Time</dt>
          <dd>{marked ? `${marked.yourTimeSeconds}s` : '—'}</dd>
        </div>
        <div>
          <dt>Avg. Time</dt>
          <dd>{marked ? `${marked.averageTimeSeconds}s` : '—'}</dd>
        </div>
      </dl>
    </div>
  );
}

function AttemptPanel({
  question,
  language,
  submitted,
  marked,
}: {
  question: ExamQuestion;
  language: Language;
  submitted: JSONContent | undefined;
  marked: QuestionResult | undefined;
}) {
  const outcome = marked?.outcome ?? 'unattempted';
  const correct = outcome === 'correct';
  const failures = (marked?.feedback ?? []).filter((entry) => !entry.passed);

  return (
    <section className={`${styles.panel} ${correct ? styles.panelGood : styles.panelBad}`}>
      <h2 className={styles.panelHead}>
        <span className={`${styles.panelBadge} ${correct ? styles.badgeGood : styles.badgeBad}`} aria-hidden="true">
          {correct ? '✓' : '✕'}
        </span>
        Your Attempted Passage
      </h2>

      <div className={styles.panelBody}>
        {submitted ? (
          <div className={styles.passage}>
            <PassagePreview document={submitted} />
          </div>
        ) : (
          <p className={styles.empty}>
            {outcome === 'unattempted'
              ? 'You did not attempt this question.'
              : 'Your answer is not available for this result.'}
          </p>
        )}

        <div className={`${styles.note} ${correct ? styles.noteGood : styles.noteBad}`}>
          <h3 className={styles.noteHead}>
            <span aria-hidden="true">{correct ? '✓' : '✕'}</span> {OUTCOME_LABEL[outcome]}
          </h3>
          {correct ? (
            <p>Every part of this question was done correctly.</p>
          ) : failures.length > 0 ? (
            <ul className={styles.failures}>
              {failures.map((entry) => (
                <li key={entry.label}>
                  {entry.label}
                  {entry.detail ? <span className={styles.failureDetail}> — {entry.detail}</span> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p>{localised(question.instruction, language)}</p>
          )}
        </div>
      </div>
    </section>
  );
}

function ApproachPanel({ question, language }: { question: ExamQuestion; language: Language }) {
  return (
    <section className={`${styles.panel} ${styles.panelGood}`}>
      <h2 className={styles.panelHead}>
        <span className={`${styles.panelBadge} ${styles.badgeGood}`} aria-hidden="true">
          ✓
        </span>
        Right Approach
      </h2>

      <div className={styles.panelBody}>
        <ol className={styles.steps}>
          {localised(question.solution, language).map((step, position) => (
            <li key={step}>
              <span className={styles.stepNumber} aria-hidden="true">
                {position + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>

        <div className={`${styles.note} ${styles.noteGood}`}>
          <h3 className={styles.noteHead}>
            <span aria-hidden="true">✓</span> Correct Answer
          </h3>
          <div className={styles.passage}>
            <PassagePreview document={modelAnswerDocument(question, language)} />
          </div>
        </div>
      </div>
    </section>
  );
}
