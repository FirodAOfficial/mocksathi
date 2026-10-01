'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { splitTopicsIn } from '@/exam/document/topics';

/**
 * The state and requests every single-document authoring screen shares —
 * Word's (`DocumentAuthoringShell`) and Excel's (`WorkbookAuthoringShell`).
 *
 * Which question is open, the form, saving, and the three requests. What
 * differs between the two screens — the editor, how a document is read out of
 * it, how a change is detected and described — stays in each shell.
 */

export interface AuthoringQuestion<Step = unknown> {
  id: string;
  position: number;
  topic: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  marks: number;
  instructionEn: string;
  instructionHi: string;
  solutionEn: string[];
  solutionHi: string[];
  steps: Step[];
}

export type AuthoringMode = { kind: 'passage' } | { kind: 'new' } | { kind: 'edit'; id: string };

export interface AuthoringForm {
  topics: string[];
  /** True once the admin has changed the topics; until then they follow the detected operation. */
  topicsChosen: boolean;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  marks: string;
  instructionEn: string;
  instructionHi: string;
  solutionEn: string;
  solutionHi: string;
}

export const EMPTY_FORM: AuthoringForm = {
  topics: [],
  topicsChosen: false,
  difficulty: 'Easy',
  marks: '1',
  instructionEn: '',
  instructionHi: '',
  solutionEn: '',
  solutionHi: '',
};

function formFor(question: AuthoringQuestion, topicOptions: readonly string[]): AuthoringForm {
  // What was saved is what the admin chose. A topic stored before the list
  // existed matches none of it, and then the detected ones are offered.
  const topics = splitTopicsIn(topicOptions, question.topic);
  const solutionEn = question.solutionEn.join('\n');
  const solutionHi = question.solutionHi.join('\n');
  return {
    topics,
    topicsChosen: topics.length > 0,
    difficulty: question.difficulty,
    marks: String(question.marks),
    instructionEn: question.instructionEn,
    // Shown empty when it only repeats the English, as the per-question form does.
    instructionHi: question.instructionHi === question.instructionEn ? '' : question.instructionHi,
    solutionEn,
    solutionHi: solutionHi === solutionEn ? '' : solutionHi,
  };
}

async function readError(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as { detail?: string } | null;
  return body?.detail ?? `That did not work (${response.status}). Try again.`;
}

export interface AuthoringFlowOptions<Step> {
  testId: string;
  /** `document` for Word, `workbook` for Excel: the route segment and the body key. */
  kind: 'document' | 'workbook';
  questions: AuthoringQuestion<Step>[];
  /** Whether the starting passage or sheet has been saved. */
  hasStart: boolean;
  topicOptions: readonly string[];
  /** What a saved starting point is called to the admin: "Passage", "Sheet". */
  startLabel: string;
}

export function useAuthoringFlow<Step>({ testId, kind, questions, hasStart, topicOptions, startLabel }: AuthoringFlowOptions<Step>) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();

  const [mode, setMode] = useState<AuthoringMode>(hasStart ? { kind: 'new' } : { kind: 'passage' });
  const [form, setForm] = useState<AuthoringForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [serverWarnings, setServerWarnings] = useState<string[]>([]);

  // An edit of a question that has since been deleted falls back to a new one.
  const editing = mode.kind === 'edit' ? questions.find((question) => question.id === mode.id) : undefined;
  const modeKind: AuthoringMode['kind'] = mode.kind === 'edit' && !editing ? 'new' : mode.kind;
  const busy = saving || refreshing;
  const locked = questions.length > 0;
  const number = editing ? editing.position : questions.length + 1;
  const base = `/api/admin/tests/${testId}/${kind}`;

  function go(next: AuthoringMode, nextForm?: AuthoringForm): void {
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

  function startEdit(question: AuthoringQuestion<Step>): void {
    go({ kind: 'edit', id: question.id }, formFor(question, topicOptions));
    setNotice(null);
  }

  function showStart(): void {
    go({ kind: 'passage' });
  }

  async function send(run: () => Promise<Response>, after: (body: { warnings?: string[] }) => void): Promise<void> {
    setSaving(true);
    setError(null);
    setServerWarnings([]);
    try {
      const response = await run();
      if (!response.ok) {
        setError(await readError(response));
        return;
      }
      const body = (await response.json().catch(() => ({}))) as { warnings?: string[] };
      after(body);
      startRefresh(() => router.refresh());
    } finally {
      setSaving(false);
    }
  }

  /** Saves the starting passage or sheet. */
  async function saveStart(content: unknown): Promise<void> {
    await send(
      () =>
        fetch(base, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ [kind]: content }),
        }),
      () => {
        setNotice(`${startLabel} saved. Record question 1 by performing its operation.`);
        go({ kind: 'new' }, { ...EMPTY_FORM });
      },
    );
  }

  /**
   * Saves the open question. `content` is the document or workbook after the
   * operation — omitted on an edit that only changes the wording, which keeps
   * what was recorded.
   */
  async function saveQuestion(topics: string[], content: unknown | undefined): Promise<void> {
    const fields = {
      topics,
      difficulty: form.difficulty,
      marks: form.marks,
      instructionEn: form.instructionEn,
      instructionHi: form.instructionHi,
      solutionEn: form.solutionEn,
      solutionHi: form.solutionHi,
      ...(content === undefined ? {} : { [kind]: content }),
    };
    const wasEditing = editing;

    await send(
      () =>
        fetch(wasEditing ? `${base}/questions/${wasEditing.id}` : `${base}/questions`, {
          method: wasEditing ? 'PUT' : 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(fields),
        }),
      (body) => {
        setNotice(wasEditing ? `Question ${wasEditing.position} updated.` : `Question ${number} recorded.`);
        go({ kind: 'new' }, { ...EMPTY_FORM, difficulty: form.difficulty, marks: form.marks });
        // Kept visible past the mode change they came from.
        setServerWarnings(body.warnings ?? []);
      },
    );
  }

  async function deleteQuestion(question: AuthoringQuestion<Step>): Promise<void> {
    const target = startLabel.toLowerCase();
    if (
      !window.confirm(
        `Delete question ${question.position}? Its changes are removed from the ${target}, and the questions after it are renumbered.`,
      )
    ) {
      return;
    }
    await send(
      () => fetch(`${base}/questions/${question.id}`, { method: 'DELETE' }),
      () => {
        setNotice(`Question ${question.position} deleted.`);
        if (editing?.id === question.id) go({ kind: 'new' }, { ...EMPTY_FORM });
      },
    );
  }

  return {
    mode: modeKind,
    editing,
    form,
    setForm,
    saving,
    busy,
    locked,
    number,
    error,
    notice,
    serverWarnings,
    startNew,
    startEdit,
    showStart,
    saveStart,
    saveQuestion,
    deleteQuestion,
  };
}

export type AuthoringFlow<Step> = ReturnType<typeof useAuthoringFlow<Step>>;
