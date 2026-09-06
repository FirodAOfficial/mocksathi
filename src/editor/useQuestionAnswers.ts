'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { Editor } from '@tiptap/react';
import { EditorState } from '@tiptap/pm/state';
import { findQuestion } from '@/exam/types';
import { useExamStore } from '@/state/examStore';
import { defaultAnswerDocument, documentsEqual, type AnswerDocument } from './answerDocument';

export interface QuestionAnswers {
  /** Restores the open question to its starting document. */
  clearCurrent: () => void;
  /** Writes the open question's current text into the store. */
  saveCurrent: () => void;
}

export interface UseQuestionAnswersOptions {
  /** False while a document is still loading, so the load is not overwritten. */
  enabled: boolean;
  /**
   * True when a `.docx` was loaded from a URL: its content is kept as the open
   * question's answer instead of being replaced by that question's default.
   */
  adoptInitialContent: boolean;
}

/**
 * Binds the editor to the selected question.
 *
 * Moving to another question stores whatever was typed and installs the target
 * question's document. Only questions actually changed from their starting text
 * are stored, so "has this been edited" is just membership of that map.
 */
export function useQuestionAnswers(
  editor: Editor | null,
  { enabled, adoptInitialContent }: UseQuestionAnswersOptions,
): QuestionAnswers {
  const attempt = useExamStore((state) => state.attempt);
  const language = useExamStore((state) => state.language);
  const selectedNumber = useExamStore((state) => state.selectedNumber);
  const saveAnswer = useExamStore((state) => state.saveAnswer);
  const clearAnswer = useExamStore((state) => state.clearAnswer);

  /** The question whose document is currently loaded into the editor. */
  const installedRef = useRef<number | null>(null);

  /**
   * Replaces the document by building a fresh `EditorState`.
   *
   * A `setContent` command would push the swap onto the undo stack, so undoing
   * on question 5 could pull question 4's text back in. Re-creating the state
   * re-initialises every plugin, which gives each question its own history.
   */
  const install = useCallback((instance: Editor, document: AnswerDocument): void => {
    instance.view.updateState(
      EditorState.create({
        doc: instance.schema.nodeFromJSON(document),
        plugins: instance.view.state.plugins,
        schema: instance.schema,
      }),
    );

    /*
     * The caret goes to the start of the passage and nothing is selected.
     *
     * Selecting the paragraph on arrival would do part of the candidate's work:
     * choosing what to format is half of every question here, and a paper that
     * pre-selects it stops testing that. It is also dangerous — with everything
     * selected, one stray keystroke replaces the passage.
     */
    // Focus first: a selection set on an unfocused editor is held in
    // ProseMirror's state but never rendered, so the caret would be invisible.
    instance.chain().focus('start').run();
  }, []);

  const persist = useCallback(
    (instance: Editor, number: number): void => {
      const question = findQuestion(attempt, number);
      if (!question) return;

      // Both documents go through the schema so the comparison is between two
      // canonical forms; see `documentsEqual`.
      const current = instance.getJSON();
      const untouched = instance.schema.nodeFromJSON(defaultAnswerDocument(question, language)).toJSON();

      if (documentsEqual(current, untouched)) clearAnswer(number);
      else saveAnswer(number, current);
    },
    [attempt, language, saveAnswer, clearAnswer],
  );

  useEffect(() => {
    if (!editor || !enabled) return;
    if (installedRef.current === selectedNumber) return;

    const question = findQuestion(attempt, selectedNumber);
    if (!question) return;

    const previous = installedRef.current;
    if (previous !== null) persist(editor, previous);

    if (previous === null && adoptInitialContent) {
      // A document arrived from a URL; keep it as this question's answer.
      persist(editor, selectedNumber);
    } else {
      const stored = useExamStore.getState().answers[selectedNumber];
      install(editor, stored ?? defaultAnswerDocument(question, language));
    }

    installedRef.current = selectedNumber;
  }, [editor, enabled, selectedNumber, attempt, language, adoptInitialContent, install, persist]);

  const clearCurrent = useCallback(() => {
    const question = findQuestion(attempt, selectedNumber);
    if (!editor || !question) return;

    clearAnswer(selectedNumber);
    install(editor, defaultAnswerDocument(question, language));
  }, [editor, attempt, language, selectedNumber, clearAnswer, install]);

  const saveCurrent = useCallback(() => {
    if (editor && installedRef.current !== null) persist(editor, installedRef.current);
  }, [editor, persist]);

  return { clearCurrent, saveCurrent };
}
