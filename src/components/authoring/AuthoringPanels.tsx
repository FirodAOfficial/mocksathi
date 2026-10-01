'use client';

import type { FormEvent } from 'react';
import styles from './DocumentAuthoringShell.module.css';
import { TopicMultiSelect } from './TopicMultiSelect';
import type { AuthoringFlow, AuthoringQuestion } from './useAuthoringFlow';

/**
 * The parts of an authoring screen around the editor, shared by Word and Excel:
 * the paper's question list on the left, and on the right either the starting
 * passage/sheet panel or the question being recorded.
 */

/* -- The question list ------------------------------------------------------ */

export function AuthoringQuestionList<Step>({
  flow,
  questions,
  hasStart,
  startLabel,
  summarise,
}: {
  flow: AuthoringFlow<Step>;
  questions: AuthoringQuestion<Step>[];
  hasStart: boolean;
  startLabel: string;
  /** One line per recorded step, for the list. */
  summarise: (steps: Step[]) => string[];
}) {
  return (
    <nav className={styles.left} aria-label="Questions in this paper">
      <div className={styles.panelSection}>
        <h2 className={styles.panelTitle}>Paper</h2>
        <p className={styles.panelNote}>
          One {startLabel.toLowerCase()}, every question performed on it in turn. Candidates may answer in any order.
        </p>
      </div>

      <ol className={styles.questionList}>
        <li>
          <button
            type="button"
            className={`${styles.questionItem} ${flow.mode === 'passage' ? styles.questionItemActive : ''}`}
            onClick={flow.showStart}
            disabled={flow.busy}
          >
            <span className={styles.questionHead}>
              <span className={styles.questionNumber}>{startLabel}</span>
              <span className={styles.questionMarks}>{hasStart ? (flow.locked ? 'locked' : 'saved') : 'not saved'}</span>
            </span>
          </button>
        </li>
        {questions.map((question) => (
          <li key={question.id}>
            <button
              type="button"
              className={`${styles.questionItem} ${flow.editing?.id === question.id ? styles.questionItemActive : ''}`}
              onClick={() => flow.startEdit(question)}
              disabled={flow.busy}
            >
              <span className={styles.questionHead}>
                <span className={styles.questionNumber}>Q{question.position}</span>
                <span>{question.topic}</span>
                <span className={styles.questionMarks}>
                  {question.marks} {question.marks === 1 ? 'mark' : 'marks'}
                </span>
              </span>
              <span className={styles.questionText}>{question.instructionEn}</span>
              <span className={styles.questionDetected}>{summarise(question.steps).join(' · ')}</span>
            </button>
          </li>
        ))}
      </ol>

      <button type="button" className={styles.addButton} onClick={flow.startNew} disabled={!hasStart || flow.busy}>
        + Record a new question
      </button>
    </nav>
  );
}

/* -- The starting passage or sheet ------------------------------------------ */

export function AuthoringStartPanel<Step>({
  flow,
  startLabel,
  hasStart,
  dirty,
  questionCount,
  onSave,
}: {
  flow: AuthoringFlow<Step>;
  startLabel: string;
  hasStart: boolean;
  dirty: boolean;
  questionCount: number;
  onSave: () => void;
}) {
  return (
    <div className={styles.panelSection}>
      <h2 className={styles.panelTitle}>{startLabel}</h2>
      <div className={styles.form}>
        <p className={styles.panelNote}>
          {flow.locked
            ? `${questionCount} question${questionCount === 1 ? ' is' : 's are'} recorded on this ${startLabel.toLowerCase()}.`
            : hasStart
              ? dirty
                ? `You have unsaved changes to the ${startLabel.toLowerCase()}.`
                : 'Saved. You can keep editing it until the first question is recorded.'
              : 'Not saved yet.'}
        </p>
        {flow.error ? (
          <p className={styles.error} role="alert">
            {flow.error}
          </p>
        ) : null}
        {!flow.locked ? (
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.primary}
              onClick={onSave}
              disabled={flow.busy || (hasStart && !dirty)}
            >
              {flow.saving ? 'Saving…' : `Save ${startLabel.toLowerCase()}`}
            </button>
            {hasStart && !dirty ? (
              <button type="button" className={styles.secondary} onClick={flow.startNew} disabled={flow.busy}>
                Record questions →
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* -- The question being recorded --------------------------------------------- */

export function AuthoringQuestionForm<Step>({
  flow,
  detectedLines,
  problems,
  warnings,
  topics,
  topicOptions,
  dirty,
  hasChange,
  placeholder,
  onSuggest,
  onSubmit,
  onReset,
  resetLabel,
}: {
  flow: AuthoringFlow<Step>;
  /** The detected operation, one line per step. */
  detectedLines: string[];
  problems: string[];
  warnings: string[];
  /** The topics in effect — the detected ones until the admin changes them. */
  topics: string[];
  topicOptions: readonly string[];
  dirty: boolean;
  /** Whether anything recordable has been done since the question started. */
  hasChange: boolean;
  placeholder: string;
  onSuggest: () => string;
  onSubmit: () => void;
  onReset: () => void;
  resetLabel: string;
}) {
  const { form, setForm, editing } = flow;

  const handleSubmit = (event: FormEvent): void => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <form className={styles.panelSection} onSubmit={handleSubmit}>
      <h2 className={styles.panelTitle}>Question {flow.number}</h2>
      <div className={styles.form}>
        <DetectedOperation lines={detectedLines} problems={problems} recorded={Boolean(editing) && !dirty} />

        {[...new Set([...warnings, ...flow.serverWarnings])].map((warning) => (
          <p className={styles.warning} key={warning}>
            {warning}
          </p>
        ))}

        <label className={styles.field}>
          Question (English)
          <textarea
            className={styles.textarea}
            value={form.instructionEn}
            onChange={(event) => setForm({ ...form, instructionEn: event.target.value })}
            placeholder={placeholder}
            required
          />
        </label>
        <button
          type="button"
          className={styles.linkButton}
          disabled={!hasChange}
          onClick={() => setForm({ ...form, instructionEn: onSuggest() })}
        >
          Draft it from the detected change
        </button>

        <label className={styles.field}>
          Question (Hindi) <span className={styles.hint}>Optional — leave blank to use the English.</span>
          <textarea
            className={styles.textarea}
            value={form.instructionHi}
            onChange={(event) => setForm({ ...form, instructionHi: event.target.value })}
          />
        </label>

        <div className={styles.field}>
          <span>
            Topic{' '}
            <span className={styles.hint}>
              {form.topicsChosen ? 'Chosen by you.' : 'Selected from the detected operation — change it if you like.'}
            </span>
          </span>
          <TopicMultiSelect
            options={topicOptions}
            value={topics}
            automatic={!form.topicsChosen}
            onChange={(next) => setForm({ ...form, topics: next, topicsChosen: true })}
            onReset={() => setForm({ ...form, topics: [], topicsChosen: false })}
          />
        </div>

        <div className={styles.fieldRow}>
          <label className={styles.field}>
            Difficulty
            <select
              className={styles.select}
              value={form.difficulty}
              onChange={(event) => setForm({ ...form, difficulty: event.target.value as typeof form.difficulty })}
            >
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </select>
          </label>
          <label className={styles.field}>
            Marks
            <input
              className={styles.input}
              type="number"
              min={1}
              max={100}
              value={form.marks}
              onChange={(event) => setForm({ ...form, marks: event.target.value })}
              required
            />
          </label>
        </div>

        <label className={styles.field}>
          Solution steps{' '}
          <span className={styles.hint}>Optional, one per line — written from the detected change if left blank.</span>
          <textarea
            className={styles.textarea}
            value={form.solutionEn}
            onChange={(event) => setForm({ ...form, solutionEn: event.target.value })}
          />
        </label>
        <label className={styles.field}>
          Solution steps (Hindi) <span className={styles.hint}>Optional.</span>
          <textarea
            className={styles.textarea}
            value={form.solutionHi}
            onChange={(event) => setForm({ ...form, solutionHi: event.target.value })}
          />
        </label>

        {flow.error ? (
          <p className={styles.error} role="alert">
            {flow.error}
          </p>
        ) : null}
        {flow.notice && !flow.error ? (
          <p className={styles.success} role="status">
            {flow.notice}
          </p>
        ) : null}

        <div className={styles.actions}>
          <button
            type="submit"
            className={styles.primary}
            // A new question needs something to have been done; an edit may
            // change only its wording.
            disabled={
              flow.busy ||
              topics.length === 0 ||
              problems.length > 0 ||
              (!editing && !hasChange) ||
              (Boolean(editing) && dirty && !hasChange)
            }
          >
            {flow.saving ? 'Saving…' : `Save question ${flow.number}`}
          </button>
          <button type="button" className={styles.secondary} onClick={onReset} disabled={flow.busy || !dirty}>
            {resetLabel}
          </button>
          {editing ? (
            <>
              <button type="button" className={styles.secondary} onClick={flow.startNew} disabled={flow.busy}>
                Cancel
              </button>
              <button
                type="button"
                className={styles.danger}
                onClick={() => void flow.deleteQuestion(editing)}
                disabled={flow.busy}
              >
                Delete
              </button>
            </>
          ) : null}
        </div>
      </div>
    </form>
  );
}

/** The live reading of what the admin has done since this question started. */
function DetectedOperation({ lines, problems, recorded }: { lines: string[]; problems: string[]; recorded: boolean }) {
  if (problems.length > 0) {
    return (
      <div className={`${styles.detected} ${styles.detectedProblem}`} role="alert">
        <span className={styles.detectedTitle}>Cannot be recorded</span>
        {problems.map((problem) => (
          <p key={problem} style={{ margin: 0 }}>
            {problem}
          </p>
        ))}
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className={`${styles.detected} ${styles.detectedEmpty}`} role="status">
        <span className={styles.detectedTitle}>Detected operation</span>
        Nothing yet. Select what the question is about and apply the operation it asks for.
      </div>
    );
  }

  return (
    <div className={styles.detected} role="status">
      <span className={styles.detectedTitle}>
        {recorded ? 'Recorded operation' : 'Detected operation'} — the candidate must do exactly this
      </span>
      <ul className={styles.detectedList}>
        {lines.map((line, index) => (
          <li key={index}>{line}</li>
        ))}
      </ul>
    </div>
  );
}
