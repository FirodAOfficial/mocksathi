import { describe, expect, it } from 'vitest';
import { EXCEL_DRAFTS } from '@/exam/excelSeedAttempt';
import { WORD_EFFICIENCY_PAPERS } from '@/exam/papers/wordEfficiency';
import { WORD_DRAFTS } from '@/exam/seedAttempt';
import { stepsOf, type WordQuestionDraft } from './index';
import { topicsForOperations } from './topics';

/* Topics for the per-question papers, read off their catalog operations. */

describe('topics for per-question Word questions', () => {
  it.each([
    [[{ kind: 'bold' }, { kind: 'underline' }], ['Font Style']],
    [[{ kind: 'fontSize', size: 14 }, { kind: 'align', align: 'center' }], ['Font & Size', 'Alignment']],
    [[{ kind: 'highlight', color: '#ffff00' }], ['Font Colour & Highlight']],
    [[{ kind: 'firstLineIndent', special: 'hanging', cm: 1 }], ['Indentation']],
    [[{ kind: 'list', list: 'bullet' }], ['Bullets & Numbering']],
    [[{ kind: 'replaceText', find: 'a', replacement: 'b' }], ['Find & Replace']],
    [[{ kind: 'clearFormatting' }], ['Clear Formatting']],
  ])('%j → %j', (operations, topics) => {
    expect(topicsForOperations('word', operations)).toEqual(topics);
  });

  it('ignores an operation still being filled in', () => {
    expect(topicsForOperations('word', [{ kind: 'nothing-yet' }, null, {}])).toEqual([]);
  });
});

describe('topics for per-question Excel questions', () => {
  const range = { start: { row: 0, col: 0 }, end: { row: 0, col: 3 } };

  it.each([
    [[{ kind: 'merge', range, centre: true }], ['Merge & Center']],
    [[{ kind: 'style', range, style: { numberFormat: '₹#,##0.00' } }], ['Number Format']],
    [[{ kind: 'style', range, style: { bold: true, numberFormat: '0%' } }], ['Cell Formatting']],
    [[{ kind: 'values', cells: [{ row: 1, col: 1, formula: '=SUM(A1:A3)' }] }], ['Formulas & Functions']],
    [[{ kind: 'values', cells: [{ row: 1, col: 1, value: 'Total' }] }], ['Data Entry']],
    [[{ kind: 'freeze', rows: 1, columns: 0 }, { kind: 'printArea', range: null }], ['Freeze Panes', 'Print Area']],
  ])('%j → %j', (operations, topics) => {
    expect(topicsForOperations('excel', operations)).toEqual(topics);
  });

  it('ignores a style with nothing in it yet', () => {
    expect(topicsForOperations('excel', [{ kind: 'style', range }])).toEqual([]);
  });
});

describe('every question in the shipped papers gets a topic', () => {
  const wordQuestions: WordQuestionDraft[] = [
    ...WORD_DRAFTS,
    ...WORD_EFFICIENCY_PAPERS.flatMap((paper) => paper.questions),
  ];

  it.each(wordQuestions.map((draft, index) => [index + 1, draft] as const))('Word question %i', (_index, draft) => {
    const operations = stepsOf(draft).flatMap((step) => step.operations);
    expect(topicsForOperations('word', operations).length).toBeGreaterThan(0);
  });

  it.each(EXCEL_DRAFTS.map((draft) => [draft.number, draft] as const))('Excel question %i', (_number, draft) => {
    expect(topicsForOperations('excel', draft.operations).length).toBeGreaterThan(0);
  });
});
