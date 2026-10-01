'use client';

import type { JSONContent } from '@tiptap/core';
import type { Editor } from '@tiptap/react';
import { EditorState } from '@tiptap/pm/state';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { documentsEqual } from '@/editor/answerDocument';
import { documentToProseMirror } from '@/editor/documentToProseMirror';
import { useClipboard } from '@/editor/useClipboard';
import { useDocumentEditor } from '@/editor/useDocumentEditor';
import { useFormatState } from '@/editor/useFormatState';
import { project, replay } from '@/exam/document/apply';
import { describeChanges, describeStep, suggestInstruction } from '@/exam/document/describe';
import { detectChanges, hasVisibleChange, type Detection } from '@/exam/document/detect';
import { overlapWarnings, partialWordWarnings } from '@/exam/document/overlap';
import { DOCUMENT_TOPICS, topicsFor } from '@/exam/document/topics';
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
import { AuthoringQuestionForm, AuthoringQuestionList, AuthoringStartPanel } from './AuthoringPanels';
import styles from './DocumentAuthoringShell.module.css';
import { useAuthoringFlow, type AuthoringQuestion } from './useAuthoringFlow';

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
 *
 * The list, the form and the requests are shared with the Excel screen
 * (`useAuthoringFlow`, `AuthoringPanels`); this file is the Word half.
 */

export interface DocumentAuthoringShellProps {
  testId: string;
  testName: string;
  /** The saved passage, or null before one has been saved. */
  passage: JSONContent | null;
  questions: AuthoringQuestion<DocumentStep>[];
}

type OpenDialog = 'find' | 'replace' | 'wordCount' | 'font' | 'paragraph' | null;

const BLANK = documentToProseMirror(createBlankDocument());

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

const summarise = (steps: DocumentStep[]): string[] =>
  steps.filter((step) => !step.licenceOnly).map((step) => describeChanges(step));

export function DocumentAuthoringShell({ testId, testName, passage, questions }: DocumentAuthoringShellProps) {
  const flow = useAuthoringFlow<DocumentStep>({
    testId,
    kind: 'document',
    questions,
    hasStart: passage !== null,
    topicOptions: DOCUMENT_TOPICS,
    startLabel: 'Passage',
  });

  const [dialog, setDialog] = useState<OpenDialog>(null);
  const openFind = useCallback(() => setDialog('find'), []);
  const openReplace = useCallback(() => setDialog('replace'), []);

  const { editor, status } = useDocumentEditor(null, undefined, { onFind: openFind, onReplace: openReplace });
  const format = useFormatState(editor);
  const clipboard = useClipboard(editor);
  const readOnly = useUiStore((state) => state.readOnly);

  const { editing } = flow;

  /**
   * What the editor opens on, and what changes are measured from.
   *
   * New: both are the passage with every question replayed. Editing question k:
   * measured from the passage with questions before k replayed, and opened on
   * that plus question k — so what it recorded is on screen and detected.
   */
  const { baseline, start } = useMemo(() => {
    if (flow.mode === 'passage' || !passage) return { baseline: null, start: passage ?? BLANK };
    if (!editing) {
      const after = replay(passage, questions);
      return { baseline: after, start: after };
    }
    return {
      baseline: replay(passage, questions.filter((question) => question.position < editing.position)),
      start: replay(passage, questions.filter((question) => question.position <= editing.position)),
    };
  }, [flow.mode, editing, passage, questions]);

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
    editor?.setEditable(!readOnly && !(flow.mode === 'passage' && flow.locked));
  }, [editor, readOnly, flow.mode, flow.locked]);

  const steps = useMemo(() => detection?.steps ?? [], [detection]);
  const problems = detection?.problems ?? [];
  const visible = hasVisibleChange(steps);
  const warnings = useMemo(
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
  const topics = flow.form.topicsChosen ? flow.form.topics : detectedTopics;

  function resetDocument(): void {
    if (!editor) return;
    installedRef.current = install(editor, start);
    setDirty(false);
    setDetection(baselineFlat ? detectChanges(baselineFlat, project(installedRef.current)) : null);
  }

  const paragraphs = useMemo(() => {
    if (!editor || dialog !== 'wordCount') return 0;
    let count = 0;
    editor.state.doc.descendants((node) => {
      if (node.isTextblock) count += 1;
      return true;
    });
    return count;
  }, [editor, dialog]);

  const modeLabel =
    flow.mode === 'passage'
      ? flow.locked
        ? 'Passage (locked)'
        : 'Writing the passage'
      : editing
        ? `Editing question ${editing.position}`
        : `Recording question ${flow.number}`;

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
        <AuthoringQuestionList
          flow={flow}
          questions={questions}
          hasStart={passage !== null}
          startLabel="Passage"
          summarise={summarise}
        />

        <main className={styles.main}>
          {flow.mode === 'passage' ? (
            <p className={`${styles.banner} ${flow.locked ? styles.bannerLocked : ''}`}>
              {flow.locked
                ? 'The passage is fixed: every question is recorded against its exact wording. Delete all questions to change it.'
                : 'Type or paste the complete passage, with any formatting it should start with. Questions are recorded on it next.'}
            </p>
          ) : (
            <p className={styles.banner}>
              {editing
                ? `This is the document as question ${editing.position} left it. Change the formatting to re-record it, or just edit its wording on the right.`
                : `Perform question ${flow.number}’s operation on the document — select the text and use the ribbon, exactly as a candidate would. Formatting only: the wording must not change.`}
            </p>
          )}

          {editor ? <DocumentCanvas editor={editor} onPageCountChange={() => {}} /> : null}
        </main>

        <aside className={styles.right} aria-label="Question details">
          {flow.mode === 'passage' ? (
            <AuthoringStartPanel
              flow={flow}
              startLabel="Passage"
              hasStart={passage !== null}
              dirty={dirty}
              questionCount={questions.length}
              onSave={() => {
                if (editor) void flow.saveStart(editor.getJSON());
              }}
            />
          ) : (
            <AuthoringQuestionForm
              flow={flow}
              detectedLines={steps.filter((step) => !step.licenceOnly).map((step) => describeStep(baselineFlat, step))}
              problems={problems}
              warnings={warnings}
              topics={topics}
              topicOptions={DOCUMENT_TOPICS}
              dirty={dirty}
              hasChange={visible}
              placeholder="e.g. Make the second word of the first paragraph bold."
              onSuggest={() => suggestInstruction(baselineFlat, steps)}
              onSubmit={() => {
                if (!editor) return;
                // The document only when it was touched: an edit to the wording
                // alone keeps what was recorded.
                void flow.saveQuestion(topics, !editing || dirty ? editor.getJSON() : undefined);
              }}
              onReset={resetDocument}
              resetLabel="Reset document"
            />
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
