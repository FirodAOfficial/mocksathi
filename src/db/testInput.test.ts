import { describe, expect, it } from 'vitest';
import { parseOperations, parseQuestionInput, parseTestInput, type QuestionInput } from './testInput';
import type { ExcelContentRow, WordContentRow } from './schema';

/**
 * What an admin form sends is not what gets stored.
 *
 * These rows are read back and *executed* — the builders turn `operations`
 * into the model answer a candidate is shown, and an answer key derived from
 * the same field would decide marks. So the write path rebuilds every
 * operation from a closed vocabulary rather than trusting the request, and
 * that is what this file holds it to.
 */

const EXAM_ID = '11111111-2222-3333-4444-555555555555';

function wordQuestion(overrides: Partial<QuestionInput> = {}): QuestionInput {
  return {
    topic: 'Character Formatting',
    difficulty: 'Easy',
    marks: '3',
    instructionEn: 'Make the paragraph bold.',
    passageEn: 'A short passage to format.',
    operations: [{ kind: 'bold' }],
    ...overrides,
  };
}

describe('parseTestInput', () => {
  it('accepts a complete test', () => {
    const parsed = parseTestInput({
      examId: EXAM_ID,
      name: 'Word Practical 1',
      subject: 'word',
      durationMinutes: '20',
      qualifyingMarks: '12',
      status: 'published',
    });

    expect(parsed).toMatchObject({
      ok: true,
      fields: { name: 'Word Practical 1', subject: 'word', durationMinutes: 20, qualifyingMarks: 12, status: 'published' },
    });
  });

  it('names a default section per application, so the instructions screen is never blank', () => {
    const word = parseTestInput({ examId: EXAM_ID, name: 'W', subject: 'word' });
    const excel = parseTestInput({ examId: EXAM_ID, name: 'E', subject: 'excel' });

    expect(word.ok && word.fields.sectionName).toBe('Word Processing');
    expect(excel.ok && excel.fields.sectionName).toBe('Spreadsheet');
  });

  it('refuses a test with no name, no exam, or no application', () => {
    expect(parseTestInput({ examId: EXAM_ID, subject: 'word' })).toMatchObject({ ok: false, code: 'NAME_REQUIRED' });
    expect(parseTestInput({ name: 'W', subject: 'word' })).toMatchObject({ ok: false, code: 'EXAM_REQUIRED' });
    expect(parseTestInput({ examId: EXAM_ID, name: 'W' })).toMatchObject({ ok: false, code: 'SUBJECT_REQUIRED' });
  });

  it('refuses an exam id that is not one', () => {
    // A malformed id would otherwise reach a query as a Postgres cast error.
    expect(parseTestInput({ examId: 'not-a-uuid', name: 'W', subject: 'word' })).toMatchObject({
      ok: false,
      code: 'EXAM_REQUIRED',
    });
  });

  it('refuses a paper that runs for no time, or for longer than a sitting', () => {
    expect(parseTestInput({ examId: EXAM_ID, name: 'W', subject: 'word', durationMinutes: '0' })).toMatchObject({
      ok: false,
      code: 'INVALID_DURATION',
    });
    expect(parseTestInput({ examId: EXAM_ID, name: 'W', subject: 'word', durationMinutes: '601' })).toMatchObject({
      ok: false,
      code: 'INVALID_DURATION',
    });
  });

  it('falls back to draft for a status it does not recognise', () => {
    const parsed = parseTestInput({ examId: EXAM_ID, name: 'W', subject: 'word', status: 'live' });
    expect(parsed.ok && parsed.fields.status).toBe('draft');
  });
});

describe('parseQuestionInput', () => {
  it('accepts a complete Word question', () => {
    const parsed = parseQuestionInput(wordQuestion(), 'word');
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.fields.content).toEqual({
      subject: 'word',
      lines: { en: ['A short passage to format.'], hi: ['A short passage to format.'] },
      scope: 'all',
    });
    expect(parsed.fields.operations).toEqual([{ kind: 'bold' }]);
  });

  it('uses the English instruction and solution when the Hindi ones are left blank', () => {
    // A paper authored in English only is a real thing an admin does; requiring
    // the Hindi field would only get English typed into it.
    const parsed = parseQuestionInput(wordQuestion({ solutionEn: 'Click Bold.' }), 'word');
    expect(parsed.ok && parsed.fields.instructionHi).toBe('Make the paragraph bold.');
    expect(parsed.ok && parsed.fields.solutionHi).toEqual(['Click Bold.']);
  });

  it('splits the solution into one step per line, dropping the blank ones', () => {
    const parsed = parseQuestionInput(wordQuestion({ solutionEn: 'Select it.\n\nClick Bold.\n' }), 'word');
    expect(parsed.ok && parsed.fields.solutionEn).toEqual(['Select it.', 'Click Bold.']);
  });

  it('refuses a question with no topic, instruction, passage or operation', () => {
    expect(parseQuestionInput(wordQuestion({ topic: ' ' }), 'word')).toMatchObject({ ok: false, code: 'TOPIC_REQUIRED' });
    expect(parseQuestionInput(wordQuestion({ instructionEn: '' }), 'word')).toMatchObject({
      ok: false,
      code: 'INSTRUCTION_REQUIRED',
    });
    expect(parseQuestionInput(wordQuestion({ passageEn: '' }), 'word')).toMatchObject({
      ok: false,
      code: 'PASSAGE_REQUIRED',
    });
    expect(parseQuestionInput(wordQuestion({ operations: [] }), 'word')).toMatchObject({
      ok: false,
      code: 'OPERATIONS_REQUIRED',
    });
  });

  describe('the line range a question may name', () => {
    it('accepts one that lies inside the first paragraph', () => {
      const parsed = parseQuestionInput(wordQuestion({ scopeFrom: '2', scopeTo: '7' }), 'word');
      expect(parsed.ok && (parsed.fields.content as WordContentRow).scope).toEqual({ from: 2, to: 7 });
    });

    it('refuses half a range, a backwards one, or one past the end of the passage', () => {
      expect(parseQuestionInput(wordQuestion({ scopeFrom: '2' }), 'word')).toMatchObject({ ok: false, code: 'INVALID_SCOPE' });
      expect(parseQuestionInput(wordQuestion({ scopeFrom: '7', scopeTo: '2' }), 'word')).toMatchObject({
        ok: false,
        code: 'INVALID_SCOPE',
      });
      expect(parseQuestionInput(wordQuestion({ scopeFrom: '0', scopeTo: '9999' }), 'word')).toMatchObject({
        ok: false,
        code: 'INVALID_SCOPE',
      });
    });
  });

  describe('a spreadsheet question', () => {
    const excelQuestion = (overrides: Partial<QuestionInput> = {}): QuestionInput => ({
      topic: 'Merge & Center',
      instructionEn: 'Merge and center A1:D1.',
      gridEn: [['Student Report', '', '', '']],
      operations: [{ kind: 'merge', range: { start: { row: 0, col: 0 }, end: { row: 0, col: 3 } }, centre: true }],
      ...overrides,
    });

    it('trims the blank rows and columns a form leaves behind', () => {
      const parsed = parseQuestionInput(
        excelQuestion({
          gridEn: [
            ['Name', 'Fee', '', ''],
            ['Rahul', '5000', '', ''],
            ['', '', '', ''],
          ],
        }),
        'excel',
      );

      expect(parsed.ok && (parsed.fields.content as ExcelContentRow).grid.en).toEqual([
        ['Name', 'Fee'],
        ['Rahul', '5000'],
      ]);
    });

    it('reuses the English sheet when no Hindi one was typed', () => {
      // Empty means "same sheet", not "blank sheet" — the two languages must
      // describe the same data for one answer key to be right for both.
      const parsed = parseQuestionInput(excelQuestion(), 'excel');
      const content = parsed.ok ? (parsed.fields.content as ExcelContentRow) : null;
      expect(content?.grid.hi).toEqual(content?.grid.en);
    });

    it('records a non-default starting view, and nothing when both are on', () => {
      const hidden = parseQuestionInput(excelQuestion({ startingHeadings: false }), 'excel');
      expect(hidden.ok && (hidden.fields.content as ExcelContentRow).startingView).toEqual({
        showGridlines: true,
        showHeadings: false,
      });

      const normal = parseQuestionInput(excelQuestion({ startingGridlines: true, startingHeadings: true }), 'excel');
      expect(normal.ok && (normal.fields.content as ExcelContentRow).startingView).toBeUndefined();
    });

    it('refuses a sheet with nothing on it', () => {
      expect(parseQuestionInput(excelQuestion({ gridEn: [['', '']] }), 'excel')).toMatchObject({
        ok: false,
        code: 'SHEET_REQUIRED',
      });
    });
  });
});

describe('parseOperations', () => {
  it('rebuilds a Word operation and drops anything else the request carried', () => {
    const parsed = parseOperations([{ kind: 'highlight', color: '#00FF00', extra: 'ignored' }], 'word');
    expect(parsed).toMatchObject({ ok: true, fields: [{ kind: 'highlight', color: '#00ff00' }] });
  });

  it('refuses a kind it does not know, rather than storing it for the builders to meet later', () => {
    expect(parseOperations([{ kind: 'runScript', src: 'x' }], 'word')).toMatchObject({ ok: false, code: 'INVALID_OPERATION' });
  });

  it('refuses a Word operation in an Excel paper, and the reverse', () => {
    expect(parseOperations([{ kind: 'bold' }], 'excel')).toMatchObject({ ok: false, code: 'INVALID_OPERATION' });
    expect(parseOperations([{ kind: 'printArea', range: null }], 'word')).toMatchObject({
      ok: false,
      code: 'INVALID_OPERATION',
    });
  });

  it('refuses a colour that is not one', () => {
    expect(parseOperations([{ kind: 'highlight', color: 'green' }], 'word')).toMatchObject({ ok: false });
    expect(parseOperations([{ kind: 'highlight', color: 'javascript:alert(1)' }], 'word')).toMatchObject({ ok: false });
  });

  it('fails the whole question on one bad operation rather than quietly dropping it', () => {
    // A question silently missing what it asked for would be marked against a
    // key that no longer matches its own instruction.
    const parsed = parseOperations([{ kind: 'bold' }, { kind: 'fontSize' }], 'word');
    expect(parsed).toMatchObject({ ok: false, code: 'INVALID_OPERATION' });
    expect(parsed.ok === false && parsed.detail).toContain('Operation 2');
  });

  it('keeps only the style properties a question may ask for', () => {
    const parsed = parseOperations(
      [
        {
          kind: 'style',
          range: { start: { row: 0, col: 0 }, end: { row: 0, col: 3 } },
          style: { bold: true, fillColor: '#FFFF00', styleId: 7, borders: { top: { style: 'thin' } } },
        },
      ],
      'excel',
    );

    expect(parsed).toMatchObject({ ok: true, fields: [{ style: { bold: true, fillColor: '#ffff00' } }] });
    if (!parsed.ok) return;
    const style = (parsed.fields[0] as { style: Record<string, unknown> }).style;
    expect(Object.keys(style).sort()).toEqual(['bold', 'fillColor']);
  });

  it('normalises a range typed backwards', () => {
    const parsed = parseOperations(
      [{ kind: 'merge', range: { start: { row: 5, col: 3 }, end: { row: 0, col: 0 } } }],
      'excel',
    );
    expect(parsed).toMatchObject({
      ok: true,
      fields: [{ range: { start: { row: 0, col: 0 }, end: { row: 5, col: 3 } } }],
    });
  });

  it('refuses a values operation whose cell asks for neither a value nor a formula', () => {
    expect(parseOperations([{ kind: 'values', cells: [{ row: 1, col: 1 }] }], 'excel')).toMatchObject({ ok: false });
  });

  it('refuses a view operation that names neither gridlines nor headings', () => {
    expect(parseOperations([{ kind: 'view' }], 'excel')).toMatchObject({ ok: false });
  });

  it('caps how many operations one question may carry', () => {
    const many = Array.from({ length: 26 }, () => ({ kind: 'bold' }));
    expect(parseOperations(many, 'word')).toMatchObject({ ok: false, code: 'TOO_MANY_OPERATIONS' });
  });

  it('refuses anything that is not a list', () => {
    expect(parseOperations('bold', 'word')).toMatchObject({ ok: false, code: 'INVALID_OPERATIONS' });
    expect(parseOperations({ kind: 'bold' }, 'word')).toMatchObject({ ok: false, code: 'INVALID_OPERATIONS' });
  });
});
