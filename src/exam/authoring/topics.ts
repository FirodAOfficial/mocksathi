import { DOCUMENT_TOPICS, orderIn, type DocumentTopic } from '@/exam/document/topics';
import type { ExcelOperation, WordOperation } from './types';

/**
 * Topics for the per-question papers, read off the operations a question asks for.
 *
 * A Word question here uses the same list as the single-document flow
 * (`DOCUMENT_TOPICS`), so a report counts "Alignment" once whichever way the
 * paper was written. Excel has its own list, after the ribbon groups and
 * dialogs a spreadsheet question exercises.
 *
 * Both maps are typed as one entry per operation kind, so a new operation
 * without a topic does not compile. See `.claude/skills/editor-functions`
 * and `.claude/skills/excel-exam-data`.
 */

export const EXCEL_TOPICS = [
  'Merge & Center',
  'Cell Formatting',
  'Number Format',
  'Borders',
  'Data Entry',
  'Formulas & Functions',
  'Column Width',
  // Row height and hiding rows or columns. No per-question operation asks for
  // these; the single-workbook flow detects them (`src/exam/workbook/topics.ts`).
  'Rows & Columns',
  'Freeze Panes',
  'Gridlines & Headings',
  'Print Area',
] as const;

export type ExcelTopic = (typeof EXCEL_TOPICS)[number];

const WORD_TOPIC_OF: Record<WordOperation['kind'], DocumentTopic> = {
  bold: 'Font Style',
  italic: 'Font Style',
  underline: 'Font Style',
  underlineStyle: 'Font Style',
  strike: 'Font Style',
  doubleStrike: 'Font Style',
  superscript: 'Font Style',
  subscript: 'Font Style',
  removeUnderline: 'Font Style',
  highlight: 'Font Colour & Highlight',
  highlightAny: 'Font Colour & Highlight',
  fontColor: 'Font Colour & Highlight',
  removeFontColor: 'Font Colour & Highlight',
  removeHighlight: 'Font Colour & Highlight',
  fontFamily: 'Font & Size',
  fontSize: 'Font & Size',
  caps: 'Font Effects',
  hidden: 'Font Effects',
  effect: 'Font Effects',
  charScale: 'Font Effects',
  charSpacing: 'Font Effects',
  align: 'Alignment',
  lineHeight: 'Line & Paragraph Spacing',
  lineSpacingAt: 'Line & Paragraph Spacing',
  spaceBefore: 'Line & Paragraph Spacing',
  spaceAfter: 'Line & Paragraph Spacing',
  contextualSpacing: 'Line & Paragraph Spacing',
  indent: 'Indentation',
  indentLeft: 'Indentation',
  indentRight: 'Indentation',
  firstLineIndent: 'Indentation',
  border: 'Borders',
  paragraphStyle: 'Styles',
  list: 'Bullets & Numbering',
  replaceText: 'Find & Replace',
  clearFormatting: 'Clear Formatting',
};

function excelTopicOf(operation: ExcelOperation): ExcelTopic {
  switch (operation.kind) {
    case 'merge':
      return 'Merge & Center';
    case 'style':
      // "Format as currency" is a style operation that only sets the format.
      return Object.keys(operation.style).every((key) => key === 'numberFormat') ? 'Number Format' : 'Cell Formatting';
    case 'outsideBorder':
      return 'Borders';
    case 'values':
      return operation.cells.some((cell) => cell.formula) ? 'Formulas & Functions' : 'Data Entry';
    case 'columnWidth':
      return 'Column Width';
    case 'freeze':
      return 'Freeze Panes';
    case 'view':
      return 'Gridlines & Headings';
    case 'printArea':
      return 'Print Area';
  }
}

/** The topic list a paper of this subject picks from. */
export function topicOptions(subject: 'word' | 'excel'): readonly string[] {
  return subject === 'word' ? DOCUMENT_TOPICS : EXCEL_TOPICS;
}

/**
 * The topics a per-question paper's operations exercise.
 *
 * Operations arrive as the form builds them — loosely typed — so an unknown
 * kind contributes nothing rather than throwing while the admin is mid-edit.
 */
export function topicsForOperations(subject: 'word' | 'excel', operations: readonly unknown[]): string[] {
  const found: string[] = [];
  for (const raw of operations) {
    if (!raw || typeof raw !== 'object' || typeof (raw as { kind?: unknown }).kind !== 'string') continue;
    const operation = raw as { kind: string };
    if (subject === 'word') {
      const topic = WORD_TOPIC_OF[operation.kind as WordOperation['kind']];
      if (topic) found.push(topic);
    } else {
      try {
        found.push(excelTopicOf(operation as ExcelOperation));
      } catch {
        // A half-filled operation (no style, no cells yet) has no topic yet.
      }
    }
  }
  return orderIn(topicOptions(subject), found);
}
