import type { WorkbookSnapshot } from '@/spreadsheet/model/snapshot';
import type { SubjectMarker } from '../markAttempt';
import { isExcelQuestion, type AnswerPayload, type ExamQuestion, type Language } from '../../types';
import type { SheetCriterion } from './criteria';
import { evaluateSheetCriterion } from './evaluate';
import { flattenWorkbook, type FlatWorkbook } from './flattenWorkbook';

/**
 * Marking an Excel paper.
 *
 * The mirror of `WORD_MARKER`, and the only place the spreadsheet engine meets
 * the scoring loop. The starting workbook comes from the question, never from
 * the submission — otherwise a candidate could send a starting state that makes
 * their answer correct.
 */
export const SHEET_MARKER: SubjectMarker<FlatWorkbook, SheetCriterion> = {
  project: (answer: AnswerPayload) => flattenWorkbook(answer as WorkbookSnapshot),

  start: (question: ExamQuestion, language: Language) => {
    if (!isExcelQuestion(question)) {
      throw new Error(`Question ${question.number} is not an Excel question.`);
    }
    return flattenWorkbook(question.workbook[language]);
  },

  evaluate: evaluateSheetCriterion,
};
