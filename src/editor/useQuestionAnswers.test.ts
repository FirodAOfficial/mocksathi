import { Editor } from '@tiptap/core';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SEED_ATTEMPT } from '@/exam/seedAttempt';
import { useExamStore } from '@/state/examStore';
import { defaultAnswerDocument, documentsEqual } from './answerDocument';
import { buildEditorExtensions } from './extensions';
import { useQuestionAnswers } from './useQuestionAnswers';

const questionOne = SEED_ATTEMPT.sections[0]!.questions[0]!;

describe('answerDocument', () => {
  it('starts a question with a heading, the prompt, and somewhere to answer', () => {
    const document = defaultAnswerDocument(questionOne);

    expect(document.content?.map((node) => node.type)).toEqual(['heading', 'paragraph', 'paragraph']);
    expect(document.content?.[0]?.content?.[0]?.text).toBe('Question 1');
    expect(document.content?.[1]?.content?.[0]?.text).toBe(questionOne.prompt);
  });

  it('treats two identical documents as equal', () => {
    expect(documentsEqual(defaultAnswerDocument(questionOne), defaultAnswerDocument(questionOne))).toBe(true);
  });

  it('treats a changed document as different', () => {
    const changed = defaultAnswerDocument(questionOne);
    changed.content?.push({ type: 'paragraph', content: [{ type: 'text', text: 'my working' }] });

    expect(documentsEqual(changed, defaultAnswerDocument(questionOne))).toBe(false);
  });
});

describe('useQuestionAnswers', () => {
  let editor: Editor;

  beforeEach(() => {
    useExamStore.setState({
      attempt: SEED_ATTEMPT,
      selectedNumber: 1,
      answers: {},
      submittedBy: null,
      resultSeen: false,
    });

    const element = document.createElement('div');
    document.body.appendChild(element);
    editor = new Editor({ element, extensions: buildEditorExtensions(), content: '' });
  });

  afterEach(() => editor.destroy());

  const mount = () =>
    renderHook(() => useQuestionAnswers(editor, { enabled: true, adoptInitialContent: false }));

  const typeIntoAnswer = (text: string): void => {
    act(() => {
      editor.commands.focus('end');
      editor.commands.insertContent(text);
    });
  };

  it('loads the selected question document into the editor', () => {
    mount();

    expect(editor.getText()).toContain('Question 1');
    expect(editor.getText()).toContain(questionOne.prompt);
  });

  it('swaps the document when another question is selected', () => {
    mount();

    act(() => useExamStore.getState().selectQuestion(4));

    expect(editor.getText()).toContain('Question 4');
    expect(editor.getText()).not.toContain('Question 1');
  });

  it('keeps edits when moving away and coming back', () => {
    mount();
    typeIntoAnswer('my working for question one');

    act(() => useExamStore.getState().selectQuestion(2));
    expect(editor.getText()).not.toContain('my working');

    act(() => useExamStore.getState().selectQuestion(1));
    expect(editor.getText()).toContain('my working for question one');
  });

  it('stores only the questions that were actually edited', () => {
    mount();

    // Move through three questions, typing into just one of them.
    act(() => useExamStore.getState().selectQuestion(2));
    typeIntoAnswer('only question two');
    act(() => useExamStore.getState().selectQuestion(3));
    act(() => useExamStore.getState().selectQuestion(1));

    expect(Object.keys(useExamStore.getState().answers)).toEqual(['2']);
  });

  it('does not leak one question edit into another', () => {
    mount();
    typeIntoAnswer('answer one');

    act(() => useExamStore.getState().selectQuestion(2));
    typeIntoAnswer('answer two');

    act(() => useExamStore.getState().selectQuestion(1));
    expect(editor.getText()).toContain('answer one');
    expect(editor.getText()).not.toContain('answer two');
  });

  it('gives each question its own undo history', () => {
    mount();
    typeIntoAnswer('question one working');

    act(() => useExamStore.getState().selectQuestion(2));

    // Undo on a fresh question must not pull the previous question's text back.
    act(() => {
      editor.commands.undo();
    });
    expect(editor.getText()).toContain('Question 2');
    expect(editor.getText()).not.toContain('question one working');
  });

  it('restores the starting document when the answer is cleared', () => {
    const { result } = mount();
    typeIntoAnswer('scratch work');
    expect(editor.getText()).toContain('scratch work');

    act(() => result.current.clearCurrent());

    expect(editor.getText()).not.toContain('scratch work');
    expect(editor.getText()).toContain(questionOne.prompt);
    expect(useExamStore.getState().answers[1]).toBeUndefined();
  });

  it('saves the open question on demand, so nothing is lost at submit', () => {
    const { result } = mount();
    typeIntoAnswer('typed but not navigated away');

    act(() => result.current.saveCurrent());

    expect(useExamStore.getState().answers[1]).toBeDefined();
  });

  it('does nothing until enabled, so a loading document is not overwritten', () => {
    editor.commands.setContent('<p>loaded from a URL</p>');
    renderHook(() => useQuestionAnswers(editor, { enabled: false, adoptInitialContent: false }));

    expect(editor.getText()).toBe('loaded from a URL');
  });
});
