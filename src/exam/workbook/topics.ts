import { EXCEL_TOPICS, type ExcelTopic } from '@/exam/authoring/topics';
import { orderIn } from '@/exam/document/topics';
import type { WorkbookStep } from './types';

/**
 * The topics a recorded workbook operation exercises — what the question form
 * ticks for the admin. The same list the per-question Excel papers use
 * (`EXCEL_TOPICS`), so a report counts "Number Format" once however the paper
 * was written.
 *
 * A total switch over the step kinds, so a new kind of change without a topic
 * does not compile. See `.claude/skills/excel-exam-data`.
 */
function topicsOf(step: WorkbookStep): ExcelTopic[] {
  switch (step.kind) {
    case 'content': {
      const topics: ExcelTopic[] = [];
      if (step.cells.some((cell) => cell.formula !== undefined)) topics.push('Formulas & Functions');
      if (step.cells.some((cell) => cell.formula === undefined)) topics.push('Data Entry');
      return topics;
    }
    case 'style':
      return [step.property === 'numberFormat' ? 'Number Format' : step.property === 'borders' ? 'Borders' : 'Cell Formatting'];
    case 'merge':
      return ['Merge & Center'];
    case 'column':
      return [...(step.width ? (['Column Width'] as const) : []), ...(step.hidden ? (['Rows & Columns'] as const) : [])];
    case 'row':
      return ['Rows & Columns'];
    case 'freeze':
      return ['Freeze Panes'];
    case 'view':
      return ['Gridlines & Headings'];
    case 'printArea':
      return ['Print Area'];
  }
}

export function workbookTopicsFor(steps: readonly WorkbookStep[]): ExcelTopic[] {
  return orderIn(EXCEL_TOPICS, steps.flatMap(topicsOf));
}
