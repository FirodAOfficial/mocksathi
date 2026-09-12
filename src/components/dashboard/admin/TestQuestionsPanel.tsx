'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { rangeToA1 } from '@/exam/authoring';
import type { RangeAddress } from '@/spreadsheet/model/address';
import type { Test, TestQuestion } from '@/db/schema';
import { QuestionEditor } from './QuestionEditor';
import styles from './TestWorkbench.module.css';

/**
 * One paper's questions: the list, and the editor that writes them.
 *
 * A single screen rather than a page per question, because writing a paper is
 * fifteen of these in a row — a navigation round trip between each one would
 * make the common case the slow one. The editor opens in place: at the bottom
 * when adding, and over the row itself when editing, so the question being
 * changed stays where the eye left it.
 */

export interface TestQuestionsPanelProps {
  test: Test;
  questions: TestQuestion[];
}

/** A one-line "asks for" summary, so the list says what each question does without opening it. */
function describeOperation(operation: Record<string, unknown>): string {
  const range = operation.range as RangeAddress | null | undefined;
  const where = range ? ` ${rangeToA1(range)}` : '';

  switch (operation.kind) {
    case 'bold':
    case 'italic':
    case 'underline':
    case 'strike':
      return String(operation.kind);
    case 'highlight':
      return `highlight ${String(operation.color ?? '')}`;
    case 'fontColor':
      return `colour ${String(operation.color ?? '')}`;
    case 'fontFamily':
      return `font ${String(operation.family ?? '')}`;
    case 'fontSize':
      return `size ${String(operation.size ?? '')}`;
    case 'align':
      return `align ${String(operation.align ?? '')}`;
    case 'lineHeight':
      return `spacing ${String(operation.value ?? '')}`;
    case 'indent':
      return `indent ×${String(operation.levels ?? '')}`;
    case 'merge':
      return `${operation.across ? 'merge across' : operation.centre ? 'merge & centre' : 'merge'}${where}`;
    case 'style':
      return `format${where}`;
    case 'outsideBorder':
      return `outside border${where}`;
    case 'values':
      return `${Array.isArray(operation.cells) ? operation.cells.length : 0} cell(s)`;
    case 'columnWidth':
      return 'column width';
    case 'freeze':
      return 'freeze panes';
    case 'view':
      return 'gridlines / headings';
    case 'printArea':
      return operation.range === null ? 'clear print area' : `print area${where}`;
    default:
      return String(operation.kind ?? 'unknown');
  }
}

export function TestQuestionsPanel({ test, questions }: TestQuestionsPanelProps) {
  const router = useRouter();
  /** The question being edited, `'new'` for the blank editor, null for neither. */
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const totalMarks = questions.reduce((total, question) => total + question.marks, 0);

  /** Every write goes through here so one failure message and one refresh cover them all. */
  async function send(questionId: string, method: 'PATCH' | 'DELETE', body?: unknown) {
    setError(null);
    setBusy(questionId);
    try {
      const response = await fetch(`/api/admin/tests/${test.id}/questions/${questionId}`, {
        method,
        ...(body === undefined ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
      });
      if (!response.ok) {
        const detail = (await response.json().catch(() => null)) as { detail?: string } | null;
        setError(detail?.detail ?? 'That did not work. Try again.');
        return;
      }
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  function handleDelete(question: TestQuestion) {
    // Deleting renumbers everything after it, so this is worth a confirmation.
    if (!window.confirm(`Delete question ${question.position}? The questions after it will be renumbered.`)) return;
    void send(question.id, 'DELETE');
  }

  function saved() {
    setEditing(null);
    router.refresh();
  }

  return (
    <div className={styles.card}>
      <h2 className={styles.cardTitle}>Questions</h2>
      <p className={styles.cardNote}>
        {questions.length === 0
          ? 'None yet. Each question gives the candidate something to start from and one thing to do to it.'
          : `${questions.length} question${questions.length === 1 ? '' : 's'}, ${totalMarks} mark${totalMarks === 1 ? '' : 's'} in total.`}
      </p>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <div className={styles.list}>
        {questions.map((question, index) =>
          editing === question.id ? (
            <QuestionEditor
              key={question.id}
              testId={test.id}
              subject={test.subject}
              question={question}
              onSaved={saved}
              onCancel={() => setEditing(null)}
            />
          ) : (
            <div className={styles.questionRow} key={question.id}>
              <span className={styles.number}>{question.position}</span>
              <div className={styles.questionMain}>
                <p className={styles.questionInstruction}>{question.instructionEn}</p>
                <div className={styles.questionMeta}>
                  <span className={styles.topic}>{question.topic}</span>
                  <span className={styles[question.difficulty] ?? styles.badge}>{question.difficulty}</span>
                  <span>{question.marks} marks</span>
                  {(question.operations as unknown as Record<string, unknown>[]).map((operation, at) => (
                    <span className={styles.asks} key={at}>
                      {describeOperation(operation)}
                    </span>
                  ))}
                </div>
              </div>
              <div className={styles.questionActions}>
                <button
                  type="button"
                  className={styles.iconButton}
                  onClick={() => void send(question.id, 'PATCH', { move: 'up' })}
                  disabled={index === 0 || busy !== null}
                  aria-label={`Move question ${question.position} up`}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className={styles.iconButton}
                  onClick={() => void send(question.id, 'PATCH', { move: 'down' })}
                  disabled={index === questions.length - 1 || busy !== null}
                  aria-label={`Move question ${question.position} down`}
                >
                  ↓
                </button>
                <button type="button" className={styles.iconButton} onClick={() => setEditing(question.id)}>
                  Edit
                </button>
                <button
                  type="button"
                  className={styles.dangerButton}
                  onClick={() => handleDelete(question)}
                  disabled={busy !== null}
                >
                  Delete
                </button>
              </div>
            </div>
          ),
        )}

        {questions.length === 0 && editing !== 'new' && (
          <p className={styles.empty}>
            Start with question 1 — or copy one from the sample papers in <code>src/exam/seedAttempt.ts</code>.
          </p>
        )}
      </div>

      {editing === 'new' ? (
        <QuestionEditor
          testId={test.id}
          subject={test.subject}
          onSaved={saved}
          onCancel={() => setEditing(null)}
        />
      ) : (
        <button type="button" className={styles.addButton} onClick={() => setEditing('new')}>
          + Add a question
        </button>
      )}

      <p className={styles.footnote}>
        Saved questions are built through the same code as the sample papers, so what you write here is what the
        player would render. Opening an authored paper in the player is the one step still to come — see{' '}
        <code>sdd/test-authoring.md</code>.
      </p>
    </div>
  );
}
