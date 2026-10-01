'use client';

import type { JSONContent } from '@tiptap/core';
import type { Editor } from '@tiptap/react';
import { EditorState } from '@tiptap/pm/state';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type FormEvent } from 'react';
import { documentsEqual } from '@/editor/answerDocument';
import { documentToProseMirror } from '@/editor/documentToProseMirror';
import { useClipboard } from '@/editor/useClipboard';
import { useDocumentEditor } from '@/editor/useDocumentEditor';
import { useFormatState } from '@/editor/useFormatState';
import { project, replay } from '@/exam/document/apply';
import { describeChanges, describeStep, suggestInstruction } from '@/exam/document/describe';
import { detectChanges, hasVisibleChange, type Detection } from '@/exam/document/detect';
import { overlapWarnings, partialWordWarnings } from '@/exam/document/overlap';
import { DOCUMENT_TOPICS, splitTopics, topicsFor, type DocumentTopic } from '@/exam/document/topics';
import type { DocumentStep } from '@/exam/document/types';
import { createBlankDocument } from '@/services/document/types';
import { useUiStore } from '@/state/uiStore';
import { TitleBar } from '../TitleBar';
import { FindReplaceDialog } from '../dialogs/FindReplaceDialog';
import { FontDialog } from '../dialogs/FontDialog';
import { ParagraphDialog } from '../dialogs/ParagraphDialog';
import { WordCountDialog } from '../dialogs/WordCountDialog';
import { DocumentCanvas } from '../document/DocumentCanvas';
import { Ribbon } from '../ribbon/Ribbon';
import styles from './DocumentAuthoringShell.module.css';
import { TopicMultiSelect } from './TopicMultiSelect';

/**
 * Writing a Word paper on one document.
 *
 * The admin types the passage once, then records the questions one after
 * another by *doing* them: fill in the question's wording, perform the
 * operation in the editor with the real ribbon, save. What changed is detected
 * from the document before and after (`detectChanges`) and shown here as it
 * happens, so the admin can see that "bold the second word" was recorded as
 * exactly that — and the server detects it again from the document it is sent
 * before storing it.
 *
 * Each question is recorded on the document as the previous ones left it: the
 * passage with every stored question replayed (`replay`). Nothing here is a
 * stored snapshot, so deleting a question anywhere in the paper simply drops
 * its changes from every later starting point.
 */

export interface AuthoringQuestion {
  id: string;
  position: number;
  topic: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  marks: number;
  instructionEn: string;
  instructionHi: string;
  solutionEn: string[];
  solutionHi: string[];
  steps: DocumentStep[];
}

export interface DocumentAuthoringShellProps {
  testId: string;
  testName: string;
  /** The saved passage, or null before one has been saved. */
  passage: JSONContent | null;
  questions: AuthoringQuestion[];
}

type Mode = { kind: 'passage' } | { kind: 'new' } | { kind: 'edit'; id: string };

type OpenDialog = 'find' | 'replace' | 'wordCount' | 'font' | 'paragraph' | null;

interface FormState {
  topics: DocumentTopic[];
  /**
   * True once the admin has changed the topics themselves. Until then the
   * topics follow the detected operation as it changes.
   */
  topicsChosen: boolean;
  difficulty: AuthoringQuestion['difficulty'];
  marks: string;
  instructionEn: string;
  instructionHi: string;
  solutionEn: string;
  solutionHi: string;
}

const EMPTY_FORM: FormState = {
  topics: [],
  topicsChosen: false,
  difficulty: 'Easy',
  marks: '1',
  instructionEn: '',
  instructionHi: '',
  solutionEn: '',
  solutionHi: '',
};

const BLANK = documentToProseMirror(createBlankDocument());

function formFor(question: AuthoringQuestion): FormState {
  const topics = splitTopics(question.topic);
  return {
    // What was saved is what the admin chose. A topic stored before the list
    // existed matches none of it, and then the detected ones are offered.
    topics,
    topicsChosen: topics.length > 0,
    difficulty: question.difficulty,
    marks: String(question.marks),
    instructionEn: question.instructionEn,
    // Shown empty when it only repeats the English, as the per-question form does.
    instructionHi: question.instructionHi === question.instructionEn ? '' : question.instructionHi,
    solutionEn: question.solutionEn.join('\n'),
    solutionHi: question.solutionHi.join('\n') === question.solutionEn.join('\n') ? '' : question.solutionHi.join('\n'),
  };
}

/** Installs a document with a fresh undo history, so Undo cannot reach past where this question started. */
function install(editor: Editor, document: JSONContent): JSONContent {
  editor.view.updateState(
    EditorState.create({
      doc: editor.schema.nodeFromJSON(structuredClone(document)),
      plugins: editor.view.state.plugins,
      schema: editor.schema,
    }),
  );
  return editor.getJSON();
}

async function readError(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as { detail?: string } | null;
  return body?.detail ?? `That did not work (${response.status}). Try again.`;
}

export function DocumentAuthoringShell({ testId, testName, passage, questions }: DocumentAuthoringShellProps) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();

  const [dialog, setDialog] = useState<OpenDialog>(null);
  const openFind = useCallback(() => setDialog('find'), []);
  const openReplace = useCallback(() => setDialog('replace'), []);

  const { editor, status } = useDocumentEditor(null, undefined, { onFind: openFind, onReplace: openReplace });
  const format = useFormatState(editor);
  const clipboard = useClipboard(editor);
  const readOnly = useUiStore((state) => state.readOnly);

  const locked = questions.length > 0;
  const [mode, setMode] = useState<Mode>(passage ? { kind: 'new' } : { kind: 'passage' });
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [serverWarnings, setServerWarnings] = useState<string[]>([]);

  // An edit of a question that has since been deleted falls back to a new one.
  const editing = mode.kind === 'edit' ? questions.find((question) => question.id === mode.id) : undefined;
  const effectiveMode: Mode = mode.kind === 'edit' && !editing ? { kind: 'new' } : mode;

  /**
   * What the editor opens on, and what changes are measured from.
   *
   * New: both are the passage with every question replayed. Editing question k:
   * measured from the passage with questions before k replayed, and opened on
   * that plus question k — so what it recorded is on screen and detected.
   */
  const { baseline, start } = useMemo(() => {
    if (effectiveMode.kind === 'passage' || !passage) return { baseline: null, start: passage ?? BLANK };
    if (effectiveMode.kind === 'new') {
      const after = replay(passage, questions);
      return { baseline: after, start: after };
    }
    const target = questions.find((question) => question.id === effectiveMode.id)!;
    return {
      baseline: replay(passage, questions.filter((question) => question.position < target.position)),
      start: replay(passage, questions.filter((question) => question.position <= target.position)),
    };
    // `effectiveMode` is rebuilt each render; its identity-bearing parts are listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveMode.kind, editing?.id, passage, questions]);

  const baselineFlat = useMemo(() => (baseline ? project(baseline) : null), [baseline]);

  /** The document as installed, to tell an edit that changed it from one that did not. */
  const installedRef = useRef<JSONContent | null>(null);
  const [detection, setDetection] = useState<Detection | null>(null);
  const [dirty, setDirty] = useState(false);

  // Put the right document in front of the admin whenever what they are doing changes.
  useEffect(() => {
    if (!editor || status !== 'ready') return;
    installedRef.current = install(editor, start);

    const measure = (): void => {
      const current = editor.getJSON();
      setDirty(!documentsEqual(current, installedRef.current ?? current));
      setDetection(baselineFlat ? detectChanges(baselineFlat, project(current)) : null);
    };

    // Debounced: projecting a passage on every keystroke is cheap, but not free.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onUpdate = (): void => {
      clearTimeout(timer);
      timer = setTimeout(measure, 150);
    };
    editor.on('update', onUpdate);
    timer = setTimeout(measure, 0);

    return () => {
      editor.off('update', onUpdate);
      clearTimeout(timer);
    };
  }, [editor, status, start, baselineFlat]);

  // The passage cannot be edited once questions are recorded on it.
  useEffect(() => {
    editor?.setEditable(!readOnly && !(effectiveMode.kind === 'passage' && locked));
  }, [editor, readOnly, effectiveMode.kind, locked]);

  const steps = useMemo(() => detection?.steps ?? [], [detection]);
  const problems = detection?.problems ?? [];
  const visible = hasVisibleChange(steps);
  const liveWarnings = useMemo(
    () => [
      ...partialWordWarnings(steps, baselineFlat),
      ...overlapWarnings(
        steps,
        questions
          .filter((question) => question.id !== editing?.id)
          .map((question) => ({ number: question.position, steps: question.steps })),
      ),
    ],
    [steps, baselineFlat, questions, editing?.id],
  );

  /** Ticked for the admin from what was detected, until they change the ticks themselves. */
  const detectedTopics = useMemo(() => topicsFor(steps), [steps]);
  const topics = form.topicsChosen ? form.topics : detectedTopics;

  const busy = saving || refreshing;
  const number = editing ? editing.position : questions.length + 1;

  /* -- Moving between modes ------------------------------------------------ */

  function go(next: Mode, nextForm?: FormState): void {
    setMode(next);
    setError(null);
    setServerWarnings([]);
    if (nextForm) setForm(nextForm);
  }

  function startNew(): void {
    // Difficulty and marks carry over: a paper is written in runs of similar
    // questions. Topics do not — they are read off each question's operation.
    go({ kind: 'new' }, { ...EMPTY_FORM, difficulty: form.difficulty, marks: form.marks });
    setNotice(null);
  }

  function startEdit(question: AuthoringQuestion): void {
    go({ kind: 'edit', id: question.id }, formFor(question));
    setNotice(null);
  }

  function resetDocument(): void {
    if (!editor) return;
    installedRef.current = install(editor, start);
    setDirty(false);
    setDetection(baselineFlat ? detectChanges(baselineFlat, project(installedRef.current)) : null);
  }

  /* -- Saving -------------------------------------------------------------- */

  async function savePassage(): Promise<void> {
    if (!editor) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/tests/${testId}/document`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ document: editor.getJSON() }),
      });
      if (!response.ok) {
        setError(await readError(response));
        return;
      }
      setNotice('Passage saved. Record question 1 by performing its operation on the document.');
      go({ kind: 'new' }, { ...EMPTY_FORM });
      startRefresh(() => router.refresh());
    } finally {
      setSaving(false);
    }
  }

  async function saveQuestion(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!editor) return;

    const fields = {
      topics,
      difficulty: form.difficulty,
      marks: form.marks,
      instructionEn: form.instructionEn,
      instructionHi: form.instructionHi,
      solutionEn: form.solutionEn,
      solutionHi: form.solutionHi,
    };

    setSaving(true);
    setError(null);
    setServerWarnings([]);
    try {
      const response = editing
        ? await fetch(`/api/admin/tests/${testId}/document/questions/${editing.id}`, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            // The document only when it was touched: an edit to the wording
            // alone keeps what was recorded.
            body: JSON.stringify({ ...fields, ...(dirty ? { document: editor.getJSON() } : {}) }),
          })
        : await fetch(`/api/admin/tests/${testId}/document/questions`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ ...fields, document: editor.getJSON() }),
          });

      if (!response.ok) {
        setError(await readError(response));
        return;
      }

      const body = (await response.json()) as { warnings?: string[] };
      setServerWarnings(body.warnings ?? []);
      setNotice(editing ? `Question ${editing.position} updated.` : `Question ${number} recorded.`);
      go({ kind: 'new' }, { ...EMPTY_FORM, difficulty: form.difficulty, marks: form.marks });
      // Keep the collision warnings visible past the mode change they came from.
      setServerWarnings(body.warnings ?? []);
      startRefresh(() => router.refresh());
    } finally {
      setSaving(false);
    }
  }

  async function deleteQuestion(question: AuthoringQuestion): Promise<void> {
    if (
      !window.confirm(
        `Delete question ${question.position}? Its formatting is removed from the document, and the questions after it are renumbered.`,
      )
    ) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/tests/${testId}/document/questions/${question.id}`, { method: 'DELETE' });
      if (!response.ok) {
        setError(await readError(response));
        return;
      }
      setNotice(`Question ${question.position} deleted.`);
      if (editing?.id === question.id) go({ kind: 'new' }, { ...EMPTY_FORM });
      startRefresh(() => router.refresh());
    } finally {
      setSaving(false);
    }
  }

  /* -- Rendering ----------------------------------------------------------- */

  const modeLabel =
    effectiveMode.kind === 'passage'
      ? locked
        ? 'Passage (locked)'
        : 'Writing the passage'
      : editing
        ? `Editing question ${editing.position}`
        : `Recording question ${number}`;

  const paragraphs = useMemo(() => {
    if (!editor || dialog !== 'wordCount') return 0;
    let count = 0;
    editor.state.doc.descendants((node) => {
      if (node.isTextblock) count += 1;
      return true;
    });
    return count;
  }, [editor, dialog]);

  return (
    <div className={styles.shell}>
      <TitleBar title={testName} editor={editor} canUndo={format.canUndo} canRedo={format.canRedo} readOnly={readOnly} />

      <div className={styles.topBar}>
        <Link href={`/dashboard/admin/tests/${testId}`} className={styles.backLink}>
          ← Back to the test
        </Link>
        <span className={styles.testName}>{testName}</span>
        <span className={styles.modeChip}>{modeLabel}</span>
      </div>

      {editor ? (
        <Ribbon
          editor={editor}
          format={format}
          clipboard={clipboard}
          onFind={() => setDialog('find')}
          onReplace={() => setDialog('replace')}
          onWordCount={() => setDialog('wordCount')}
          onOpenFontDialog={() => setDialog('font')}
          onOpenParagraphDialog={() => setDialog('paragraph')}
        />
      ) : (
        <div className={styles.ribbonPlaceholder} aria-hidden="true" />
      )}

      <div className={styles.workspace}>
        <nav className={styles.left} aria-label="Questions in this paper">
          <div className={styles.panelSection}>
            <h2 className={styles.panelTitle}>Paper</h2>
            <p className={styles.panelNote}>
              One passage, every question performed on it in turn. Candidates may answer in any order.
            </p>
          </div>

          <ol className={styles.questionList}>
            <li>
              <button
                type="button"
                className={`${styles.questionItem} ${effectiveMode.kind === 'passage' ? styles.questionItemActive : ''}`}
                onClick={() => go({ kind: 'passage' })}
                disabled={busy}
              >
                <span className={styles.questionHead}>
                  <span className={styles.questionNumber}>Passage</span>
                  <span className={styles.questionMarks}>{passage ? (locked ? 'locked' : 'saved') : 'not saved'}</span>
                </span>
              </button>
            </li>
            {questions.map((question) => (
              <li key={question.id}>
                <button
                  type="button"
                  className={`${styles.questionItem} ${editing?.id === question.id ? styles.questionItemActive : ''}`}
                  onClick={() => startEdit(question)}
                  disabled={busy}
                >
                  <span className={styles.questionHead}>
                    <span className={styles.questionNumber}>Q{question.position}</span>
                    <span>{question.topic}</span>
                    <span className={styles.questionMarks}>
                      {question.marks} {question.marks === 1 ? 'mark' : 'marks'}
                    </span>
                  </span>
                  <span className={styles.questionText}>{question.instructionEn}</span>
                  <span className={styles.questionDetected}>
                    {question.steps
                      .filter((step) => !step.licenceOnly)
                      .map((step) => describeChanges(step))
                      .join(' · ')}
                  </span>
                </button>
              </li>
            ))}
          </ol>

          <button type="button" className={styles.addButton} onClick={startNew} disabled={!passage || busy}>
            + Record a new question
          </button>
        </nav>

        <main className={styles.main}>
          {effectiveMode.kind === 'passage' ? (
            <p className={`${styles.banner} ${locked ? styles.bannerLocked : ''}`}>
              {locked
                ? 'The passage is fixed: every question is recorded against its exact wording. Delete all questions to change it.'
                : 'Type or paste the complete passage, with any formatting it should start with. Questions are recorded on it next.'}
            </p>
          ) : (
            <p className={styles.banner}>
              {editing
                ? `This is the document as question ${editing.position} left it. Change the formatting to re-record it, or just edit its wording on the right.`
                : `Perform question ${number}’s operation on the document — select the text and use the ribbon, exactly as a candidate would. Formatting only: the wording must not change.`}
            </p>
          )}

          {editor ? <DocumentCanvas editor={editor} onPageCountChange={() => {}} /> : null}
        </main>

        <aside className={styles.right} aria-label="Question details">
          {effectiveMode.kind === 'passage' ? (
            <div className={styles.panelSection}>
              <h2 className={styles.panelTitle}>Passage</h2>
              <div className={styles.form}>
                <p className={styles.panelNote}>
                  {locked
                    ? `${questions.length} question${questions.length === 1 ? ' is' : 's are'} recorded on this passage.`
                    : passage
                      ? dirty
                        ? 'You have unsaved changes to the passage.'
                        : 'Saved. You can keep editing it until the first question is recorded.'
                      : 'Not saved yet.'}
                </p>
                {error ? (
                  <p className={styles.error} role="alert">
                    {error}
                  </p>
                ) : null}
                {!locked ? (
                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={styles.primary}
                      onClick={() => void savePassage()}
                      disabled={busy || !editor || (passage !== null && !dirty)}
                    >
                      {saving ? 'Saving…' : 'Save passage'}
                    </button>
                    {passage && !dirty ? (
                      <button type="button" className={styles.secondary} onClick={startNew} disabled={busy}>
                        Record questions →
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <form className={styles.panelSection} onSubmit={(event) => void saveQuestion(event)}>
              <h2 className={styles.panelTitle}>{editing ? `Question ${editing.position}` : `Question ${number}`}</h2>
              <div className={styles.form}>
                <DetectedChanges
                  steps={steps}
                  problems={problems}
                  baseline={baselineFlat}
                  editingUntouched={Boolean(editing) && !dirty}
                />

                {[...liveWarnings, ...serverWarnings.filter((warning) => !liveWarnings.includes(warning))].map(
                  (warning) => (
                    <p className={styles.warning} key={warning}>
                      {warning}
                    </p>
                  ),
                )}

                <label className={styles.field}>
                  Question (English)
                  <textarea
                    className={styles.textarea}
                    value={form.instructionEn}
                    onChange={(event) => setForm({ ...form, instructionEn: event.target.value })}
                    placeholder="e.g. Make the second word of the first paragraph bold."
                    required
                  />
                </label>
                <button
                  type="button"
                  className={styles.linkButton}
                  disabled={!visible}
                  onClick={() => setForm({ ...form, instructionEn: suggestInstruction(baselineFlat, steps) })}
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
                    options={DOCUMENT_TOPICS}
                    value={topics}
                    automatic={!form.topicsChosen}
                    onChange={(next) => setForm({ ...form, topics: next as DocumentTopic[], topicsChosen: true })}
                    onReset={() => setForm({ ...form, topics: [], topicsChosen: false })}
                  />
                </div>

                <div className={styles.fieldRow}>
                  <label className={styles.field}>
                    Difficulty
                    <select
                      className={styles.select}
                      value={form.difficulty}
                      onChange={(event) =>
                        setForm({ ...form, difficulty: event.target.value as FormState['difficulty'] })
                      }
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
                  Solution steps <span className={styles.hint}>Optional, one per line — written from the detected change if left blank.</span>
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

                {error ? (
                  <p className={styles.error} role="alert">
                    {error}
                  </p>
                ) : null}
                {notice && !error ? (
                  <p className={styles.success} role="status">
                    {notice}
                  </p>
                ) : null}

                <div className={styles.actions}>
                  <button
                    type="submit"
                    className={styles.primary}
                    // A new question needs something to have been done; an edit
                    // may change only its wording.
                    disabled={
                      busy ||
                      topics.length === 0 ||
                      problems.length > 0 ||
                      (!editing && !visible) ||
                      (Boolean(editing) && dirty && !visible)
                    }
                  >
                    {saving ? 'Saving…' : editing ? `Save question ${editing.position}` : `Save question ${number}`}
                  </button>
                  <button type="button" className={styles.secondary} onClick={resetDocument} disabled={busy || !dirty}>
                    Reset document
                  </button>
                  {editing ? (
                    <>
                      <button type="button" className={styles.secondary} onClick={startNew} disabled={busy}>
                        Cancel
                      </button>
                      <button
                        type="button"
                        className={styles.danger}
                        onClick={() => void deleteQuestion(editing)}
                        disabled={busy}
                      >
                        Delete
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            </form>
          )}
        </aside>
      </div>

      {editor && (dialog === 'find' || dialog === 'replace') ? (
        <FindReplaceDialog editor={editor} mode={dialog} onClose={() => setDialog(null)} />
      ) : null}
      {editor && dialog === 'font' ? <FontDialog editor={editor} onClose={() => setDialog(null)} /> : null}
      {editor && dialog === 'paragraph' ? (
        <ParagraphDialog editor={editor} format={format} onClose={() => setDialog(null)} />
      ) : null}
      {editor && dialog === 'wordCount' ? (
        <WordCountDialog
          words={format.words}
          characters={format.characters}
          paragraphs={paragraphs}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </div>
  );
}

/** The live reading of what the admin has done since this question started. */
function DetectedChanges({
  steps,
  problems,
  baseline,
  editingUntouched,
}: {
  steps: DocumentStep[];
  problems: string[];
  baseline: ReturnType<typeof project> | null;
  editingUntouched: boolean;
}) {
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

  const visible = steps.filter((step) => !step.licenceOnly);
  if (visible.length === 0) {
    return (
      <div className={`${styles.detected} ${styles.detectedEmpty}`} role="status">
        <span className={styles.detectedTitle}>Detected operation</span>
        Nothing yet. Select text in the document and apply the formatting this question asks for.
      </div>
    );
  }

  return (
    <div className={styles.detected} role="status">
      <span className={styles.detectedTitle}>
        {editingUntouched ? 'Recorded operation' : 'Detected operation'} — the candidate must do exactly this
      </span>
      <ul className={styles.detectedList}>
        {visible.map((step, index) => (
          <li key={index}>{describeStep(baseline, step)}</li>
        ))}
      </ul>
    </div>
  );
}
