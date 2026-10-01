import type { JSONContent } from '@tiptap/core';
import { normaliseDocument, project } from '@/exam/document/apply';
import { DOCUMENT_TOPICS, isDocumentTopic, joinTopics } from '@/exam/document/topics';
import { QUESTION_DIFFICULTIES, type QuestionDifficulty } from './schema';
import { MAX_MARKS, MAX_SOLUTION_STEPS, type ParseResult } from './testInput';

/**
 * What the single-document authoring screen sends, and what it may mean.
 *
 * The descriptive fields follow `parseQuestionInput` exactly — same limits,
 * same Hindi-falls-back-to-English rule — so a question reads the same in the
 * admin list whichever flow wrote it. What differs is that there are no
 * operations to validate: the operation is detected on the server from the
 * document that is sent (`recordQuestion`), never taken from the request.
 */

/** A passage of a few hundred words is a few kilobytes of editor JSON; this is generous. */
export const MAX_DOCUMENT_BYTES = 512 * 1024;
export const MAX_DOCUMENT_PARAGRAPHS = 400;
export const MAX_DOCUMENT_CHARACTERS = 60_000;
export const MAX_DOCUMENT_QUESTIONS = 100;

export interface DocumentQuestionInput {
  /** One or more of `DOCUMENT_TOPICS`. */
  topics?: unknown;
  difficulty?: string;
  marks?: string | number;
  instructionEn?: string;
  instructionHi?: string;
  /** One step per line. */
  solutionEn?: string;
  solutionHi?: string;
  /** The editor's document after the operation; absent on an edit that only changes the wording. */
  document?: unknown;
}

export interface ParsedDocumentQuestionFields {
  topic: string;
  difficulty: QuestionDifficulty;
  marks: number;
  instructionEn: string;
  instructionHi: string;
  solutionEn: string[];
  solutionHi: string[];
}

function fail<T>(code: string, detail: string): ParseResult<T> {
  return { ok: false, code, detail };
}

function steps(value: string | undefined): string[] {
  return (typeof value === 'string' ? value : '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, MAX_SOLUTION_STEPS);
}

function isDifficulty(value: string): value is QuestionDifficulty {
  return (QUESTION_DIFFICULTIES as readonly string[]).includes(value);
}

export function parseDocumentQuestionFields(body: DocumentQuestionInput): ParseResult<ParsedDocumentQuestionFields> {
  // Picked from a fixed list, so anything off it is a crafted request, not a typo.
  const topics = Array.isArray(body.topics) ? body.topics : [];
  if (topics.length === 0) return fail('TOPIC_REQUIRED', 'Choose at least one topic this question exercises.');
  if (!topics.every(isDocumentTopic)) {
    return fail('INVALID_TOPIC', `Topics must be chosen from the list: ${DOCUMENT_TOPICS.join(', ')}.`);
  }
  const topic = joinTopics(topics);

  const instructionEn = typeof body.instructionEn === 'string' ? body.instructionEn.trim() : '';
  if (!instructionEn) return fail('INSTRUCTION_REQUIRED', 'Enter the question, in English.');
  if (instructionEn.length > 2000) return fail('INSTRUCTION_TOO_LONG', 'Keep the question under 2,000 characters.');

  const instructionHiRaw = typeof body.instructionHi === 'string' ? body.instructionHi.trim() : '';
  if (instructionHiRaw.length > 2000) return fail('INSTRUCTION_TOO_LONG', 'Keep the question under 2,000 characters.');

  const marks = typeof body.marks === 'number' ? body.marks : Number.parseInt(String(body.marks ?? '1'), 10);
  if (!Number.isInteger(marks) || marks < 1 || marks > MAX_MARKS) {
    return fail('INVALID_MARKS', `Marks must be a whole number between 1 and ${MAX_MARKS}.`);
  }

  const difficulty = typeof body.difficulty === 'string' ? body.difficulty.trim() : 'Easy';
  if (!isDifficulty(difficulty)) return fail('INVALID_DIFFICULTY', 'Choose Easy, Medium or Hard.');

  const solutionEn = steps(body.solutionEn);
  const solutionHi = steps(body.solutionHi);

  return {
    ok: true,
    fields: {
      topic,
      difficulty,
      marks,
      instructionEn,
      instructionHi: instructionHiRaw || instructionEn,
      solutionEn,
      solutionHi: solutionHi.length > 0 ? solutionHi : solutionEn,
    },
  };
}

/**
 * A document sent by the editor, checked for shape and size.
 *
 * Not normalised here — the caller decides: the passage is stored normalised,
 * while a question's after is only ever compared, never stored.
 */
export function parseEditorDocument(value: unknown): ParseResult<JSONContent> {
  if (!value || typeof value !== 'object' || (value as JSONContent).type !== 'doc') {
    return fail('INVALID_DOCUMENT', 'The document is missing or is not an editor document.');
  }
  if (!Array.isArray((value as JSONContent).content)) {
    return fail('INVALID_DOCUMENT', 'The document has no content.');
  }
  if (JSON.stringify(value).length > MAX_DOCUMENT_BYTES) {
    return fail('DOCUMENT_TOO_LARGE', 'The document is too large. Shorten the passage.');
  }

  const projection = project(value as JSONContent);
  if (projection.blocks.length > MAX_DOCUMENT_PARAGRAPHS) {
    return fail('DOCUMENT_TOO_LARGE', `A passage may have at most ${MAX_DOCUMENT_PARAGRAPHS} paragraphs.`);
  }
  if (projection.chars.length > MAX_DOCUMENT_CHARACTERS) {
    return fail('DOCUMENT_TOO_LARGE', `A passage may have at most ${MAX_DOCUMENT_CHARACTERS.toLocaleString('en-IN')} characters.`);
  }
  return { ok: true, fields: value as JSONContent };
}

/** The passage as it is stored: checked, normalised, and not empty. */
export function parsePassage(value: unknown): ParseResult<JSONContent> {
  const parsed = parseEditorDocument(value);
  if (!parsed.ok) return parsed;

  const passage = normaliseDocument(parsed.fields);
  if (project(passage).text.trim() === '') {
    return fail('PASSAGE_REQUIRED', 'Type the passage before saving it.');
  }
  return { ok: true, fields: passage };
}
