'use client';

import type { JSONContent } from '@tiptap/core';
import type { ExamResult } from './result';
import type { Language } from './types';

/**
 * Sends the paper for marking.
 *
 * Only what the candidate produced is sent. The paper, the marks and the answer
 * key all live on the server, so nothing here can be tampered with to change a
 * score, and the criteria never reach the browser.
 */
export interface SubmitPayload {
  answers: Record<number, JSONContent>;
  language: Language;
  timePerQuestion: Record<number, number>;
  totalTimeSeconds: number;
}

export class SubmissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SubmissionError';
  }
}

export async function submitAttempt(payload: SubmitPayload, signal?: AbortSignal): Promise<ExamResult> {
  let response: Response;
  try {
    response = await fetch('/api/attempts/submit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
    throw new SubmissionError('Your paper could not be sent for marking. Check your connection and try again.');
  }

  if (!response.ok) {
    const detail = await response
      .json()
      .then((body: { detail?: string }) => body.detail)
      .catch(() => undefined);
    throw new SubmissionError(detail ?? `Marking failed (${response.status}).`);
  }

  return (await response.json()) as ExamResult;
}
