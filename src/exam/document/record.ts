import type { JSONContent } from '@tiptap/core';
import { faithful, project } from './apply';
import { detectChanges, hasVisibleChange } from './detect';
import type { DocumentStep, TimelineEntry } from './types';

/**
 * The rules for turning a before and an after into a stored question, and for
 * accepting a candidate's timeline.
 *
 * Both run on the server against documents the server holds or has just been
 * sent — the authoring screen detects too, to show the admin what is being
 * recorded, but its reading is never what is stored.
 */

/** More than this in one question is a paper being pasted in, not a question being recorded. */
export const MAX_STEPS_PER_QUESTION = 40;

export type RecordResult = { ok: true; steps: DocumentStep[] } | { ok: false; code: string; detail: string };

/**
 * What the admin did between `before` and `after`, if it can be a question.
 *
 * Refused when the wording changed, when nothing visible changed, and when
 * replaying what was detected would not give back the same document — the
 * last because every later question is recorded on, and every worked answer is
 * shown as, a replay (`apply.ts`).
 */
export function recordQuestion(before: JSONContent, after: JSONContent): RecordResult {
  const detection = detectChanges(project(before), project(after));

  if (detection.problems.length > 0) {
    return { ok: false, code: 'NOT_A_FORMATTING_CHANGE', detail: detection.problems.join(' ') };
  }
  if (!hasVisibleChange(detection.steps)) {
    return {
      ok: false,
      code: 'NOTHING_DETECTED',
      detail: 'No formatting change was detected. Perform the question’s operation in the document, then save.',
    };
  }
  if (detection.steps.length > MAX_STEPS_PER_QUESTION) {
    return {
      ok: false,
      code: 'TOO_MANY_CHANGES',
      detail: `That is ${detection.steps.length} separate changes. A question may make at most ${MAX_STEPS_PER_QUESTION} — split it into several questions.`,
    };
  }
  if (!faithful(before, detection.steps, after)) {
    return {
      ok: false,
      code: 'NOT_REPLAYABLE',
      detail:
        'Part of this change cannot be recorded faithfully (for example a list nested inside another, or a heading inside a list). Undo it and use a different operation.',
    };
  }

  return { ok: true, steps: detection.steps };
}

/* -- The candidate's timeline --------------------------------------------- */

/** A sitting is a few dozen visits; this bounds what one submission can make the server project. */
export const MAX_TIMELINE_ENTRIES = 400;

/**
 * A submitted timeline, or null when it is not one.
 *
 * Only the shape is checked. What each document contains is the candidate's
 * answer and is judged by marking; a document that is not a document projects
 * to nothing and marks wrong, which is all it deserves.
 */
export function parseTimeline(value: unknown): TimelineEntry[] | null {
  if (!Array.isArray(value) || value.length > MAX_TIMELINE_ENTRIES) return null;

  const entries: TimelineEntry[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') return null;
    const { question, document } = raw as { question?: unknown; document?: unknown };
    if (typeof question !== 'number' || !Number.isInteger(question) || question < 1) return null;
    if (!document || typeof document !== 'object' || (document as JSONContent).type !== 'doc') return null;
    entries.push({ question, document: document as JSONContent });
  }
  return entries;
}
