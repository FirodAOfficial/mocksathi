import type { ExamAttempt, ExamQuestion, ExamSection, Subject } from '@/exam/types';
import { buildExcelQuestion } from './excel';
import { isWordDraft, type QuestionDraft } from './types';
import { buildWordQuestion } from './word';

/**
 * Building a paper from drafts.
 *
 * The one entry point a caller needs: `src/db/tests.ts` turns stored rows into
 * drafts and hands them here, and the fixtures build themselves the same way.
 */

export * from './types';
export * from './word';
export * from './excel';

export function buildQuestion(draft: QuestionDraft): ExamQuestion {
  return isWordDraft(draft) ? buildWordQuestion(draft) : buildExcelQuestion(draft);
}

export interface AttemptDraft {
  candidateName: string;
  subject: Subject;
  sectionName: string;
  durationSeconds: number;
  questions: QuestionDraft[];
}

/**
 * A paper from its questions.
 *
 * The question numbers come from the drafts rather than being reassigned here:
 * a stored question's position is what the answer key, the palette and the
 * result screen all agree to call it, and renumbering on the way out would put
 * this function in the middle of that agreement.
 */
export function buildAttempt(draft: AttemptDraft): ExamAttempt {
  const section: ExamSection = {
    name: draft.sectionName,
    questions: draft.questions.map(buildQuestion),
  };

  return {
    candidateName: draft.candidateName,
    subject: draft.subject,
    durationSeconds: draft.durationSeconds,
    sections: [section],
  };
}
