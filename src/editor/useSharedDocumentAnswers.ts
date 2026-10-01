'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { JSONContent } from '@tiptap/core';
import type { Editor } from '@tiptap/react';
import { EditorState } from '@tiptap/pm/state';
import type { TimelineEntry } from '@/exam/document/types';
import { useExamStore } from '@/state/examStore';
import { useSharedDocumentStore } from '@/state/sharedDocumentStore';
import { documentsEqual } from './answerDocument';
import type { QuestionAnswers } from './useQuestionAnswers';

/**
 * Binds the editor to a single-document paper.
 *
 * `useQuestionAnswers` gives every question its own document and swaps them as
 * the candidate moves around. Here there is one document for the whole sitting,
 * and what is recorded is *when* it changed: every time the candidate leaves a
 * question (or saves, or the clock runs out), the document as it now stands is
 * added to the timeline against the question that was open — if anything
 * changed while it was. The marker then judges each question only on the
 * changes made while it was open (`documentMarker`), which is what lets the
 * candidate answer in any order on a document every answer shares.
 *
 * Each visit also gets a fresh undo history. Otherwise Undo on question 5
 * could reach back into question 4's work, and that undo would be recorded as
 * something question 5 changed.
 */

interface OpenVisit {
  number: number;
  /** The document when the question was opened — what Clear puts back. */
  document: JSONContent;
  /** The timeline when it was opened — what Clear restores alongside it. */
  timeline: TimelineEntry[];
}

export function useSharedDocumentAnswers(editor: Editor | null, { enabled }: { enabled: boolean }): QuestionAnswers {
  const passage = useExamStore((state) => state.attempt.sharedDocument);
  const selectedNumber = useExamStore((state) => state.selectedNumber);
  const saveAnswer = useExamStore((state) => state.saveAnswer);
  const clearAnswer = useExamStore((state) => state.clearAnswer);

  /** Which passage is installed, so a new sitting re-installs and a re-render does not. */
  const installedRef = useRef<JSONContent | null>(null);
  const openRef = useRef<OpenVisit | null>(null);
  /** The document at the last point something was recorded — a visit's change is measured from here. */
  const recordedRef = useRef<JSONContent | null>(null);

  /** Replaces the editor state with a fresh one, which is also a fresh undo history. */
  const install = useCallback((instance: Editor, document: JSONContent): JSONContent => {
    instance.view.updateState(
      EditorState.create({
        doc: instance.schema.nodeFromJSON(document),
        plugins: instance.view.state.plugins,
        schema: instance.schema,
      }),
    );
    instance.chain().focus('start').run();
    // Read back through the schema, so later comparisons are like for like.
    return instance.getJSON();
  }, []);

  /** Adds the document to the timeline against `number`, if it changed since the last record. */
  const commit = useCallback(
    (instance: Editor, number: number): void => {
      const current = instance.getJSON();
      if (recordedRef.current && documentsEqual(current, recordedRef.current)) return;

      useSharedDocumentStore.getState().record(number, current);
      saveAnswer(number, current);
      recordedRef.current = current;
    },
    [saveAnswer],
  );

  useEffect(() => {
    if (!editor || !enabled || !passage) return;

    // A new sitting: the passage goes in untouched and nothing is recorded yet.
    if (installedRef.current !== passage) {
      const start = install(editor, structuredClone(passage));
      useSharedDocumentStore.getState().reset();
      installedRef.current = passage;
      recordedRef.current = start;
      openRef.current = { number: selectedNumber, document: start, timeline: [] };
      return;
    }

    const open = openRef.current;
    if (!open || open.number === selectedNumber) return;

    // Leaving a question: what was done while it was open is recorded against
    // it, and the next question starts with a clean undo history on the same
    // document.
    commit(editor, open.number);
    const start = install(editor, editor.getJSON());
    recordedRef.current = start;
    openRef.current = {
      number: selectedNumber,
      document: start,
      timeline: useSharedDocumentStore.getState().timeline,
    };
  }, [editor, enabled, passage, selectedNumber, install, commit]);

  /**
   * Undoes this visit: the document goes back to how it was when the question
   * was opened, and so does the timeline.
   *
   * Only this visit. Earlier visits to the question are followed in the
   * timeline by other questions' work on the same document, and taking them
   * out would hand their changes to whichever question came next.
   */
  const clearCurrent = useCallback(() => {
    const open = openRef.current;
    if (!editor || !open) return;

    recordedRef.current = install(editor, open.document);
    useSharedDocumentStore.getState().restore(open.timeline);

    const earlier = [...open.timeline].reverse().find((entry) => entry.question === open.number);
    if (earlier) saveAnswer(open.number, earlier.document);
    else clearAnswer(open.number);
  }, [editor, install, saveAnswer, clearAnswer]);

  const saveCurrent = useCallback(() => {
    if (editor && openRef.current) commit(editor, openRef.current.number);
  }, [editor, commit]);

  return { clearCurrent, saveCurrent };
}
