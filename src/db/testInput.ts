import type { ExcelOperation, WordOperation, WordScope } from '@/exam/authoring';
import type { CellValue } from '@/spreadsheet/model/Cell';
import type { CellStyle } from '@/spreadsheet/model/styles';
import {
  EXAM_STATUSES,
  QUESTION_DIFFICULTIES,
  TEST_SUBJECTS,
  type ExamStatus,
  type QuestionContentRow,
  type QuestionDifficulty,
  type TestSubject,
} from './schema';

/**
 * What the Test Enigma forms send, and what it is allowed to mean.
 *
 * The same job `examInput.ts` does for exam listings, with one difference that
 * matters: a question's `operations` end up as JSON in the database and are
 * then *executed* — `buildQuestion` turns them into the model answer a
 * candidate is shown, and an answer key derived from them would decide marks.
 * So they are not stored as sent. Every operation is rebuilt field by field
 * from a closed vocabulary, and anything unrecognised is a 400 rather than a
 * value that quietly reaches the builders.
 */

/* -- Limits ---------------------------------------------------------------- */

/*
 * Sized for the papers this actually serves — fifteen questions, a paragraph
 * each or a table of a few dozen cells (`src/exam/seedAttempt.ts`). They are
 * here to bound what one admin request can store and what one exam page then
 * has to render, not to express a product rule.
 */
export const MAX_PASSAGE_LINES = 50;
export const MAX_LINE_LENGTH = 8_000;
export const MAX_GRID_ROWS = 200;
export const MAX_GRID_COLUMNS = 50;
export const MAX_CELL_LENGTH = 500;
export const MAX_OPERATIONS = 25;
export const MAX_ANSWER_CELLS = 500;
export const MAX_SOLUTION_STEPS = 20;
export const MAX_MARKS = 100;
export const MAX_DURATION_MINUTES = 600;

/* -- Test ------------------------------------------------------------------ */

export interface TestInput {
  examId?: string;
  name?: string;
  subject?: string;
  description?: string;
  sectionName?: string;
  tagline?: string;
  durationMinutes?: string;
  qualifyingMarks?: string;
  status?: string;
}

export interface ParsedTestFields {
  examId: string;
  name: string;
  subject: TestSubject;
  description: string | null;
  sectionName: string;
  tagline: string | null;
  durationMinutes: number;
  qualifyingMarks: number;
  status: ExamStatus;
}

export type ParseResult<T> = { ok: true; fields: T } | { ok: false; code: string; detail: string };

function fail<T>(code: string, detail: string): ParseResult<T> {
  return { ok: false, code, detail };
}

/** `""` and `undefined` both mean "not provided", same as `examInput.ts`. */
function orNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function intOrNull(value: string | undefined): number | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

/** A UUID, loosely — enough to keep a malformed id out of a query, not a checksum. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isTestSubject(value: unknown): value is TestSubject {
  return typeof value === 'string' && (TEST_SUBJECTS as readonly string[]).includes(value);
}

function isExamStatus(value: string): value is ExamStatus {
  return (EXAM_STATUSES as readonly string[]).includes(value);
}

function isDifficulty(value: string): value is QuestionDifficulty {
  return (QUESTION_DIFFICULTIES as readonly string[]).includes(value);
}

/** Shared by `POST /api/admin/tests` and `PUT /api/admin/tests/[id]`. */
export function parseTestInput(body: TestInput): ParseResult<ParsedTestFields> {
  const name = body.name?.trim() ?? '';
  if (!name) return fail('NAME_REQUIRED', 'Enter the test name.');

  const examId = body.examId?.trim() ?? '';
  if (!UUID.test(examId)) return fail('EXAM_REQUIRED', 'Choose the exam this test belongs to.');

  if (!isTestSubject(body.subject)) {
    return fail('SUBJECT_REQUIRED', 'Choose whether this is a Word or an Excel paper.');
  }

  const durationMinutes = intOrNull(body.durationMinutes) ?? 15;
  if (durationMinutes < 1 || durationMinutes > MAX_DURATION_MINUTES) {
    return fail('INVALID_DURATION', `Duration must be between 1 and ${MAX_DURATION_MINUTES} minutes.`);
  }

  const qualifyingMarks = intOrNull(body.qualifyingMarks) ?? 0;
  if (qualifyingMarks < 0) return fail('INVALID_QUALIFYING_MARKS', 'Qualifying marks cannot be negative.');

  return {
    ok: true,
    fields: {
      examId,
      name,
      subject: body.subject,
      description: orNull(body.description),
      sectionName: orNull(body.sectionName) ?? (body.subject === 'excel' ? 'Spreadsheet' : 'Word Processing'),
      tagline: orNull(body.tagline),
      durationMinutes,
      qualifyingMarks,
      status: body.status && isExamStatus(body.status) ? body.status : 'draft',
    },
  };
}

/* -- Question -------------------------------------------------------------- */

export interface QuestionInput {
  topic?: string;
  difficulty?: string;
  marks?: string;
  instructionEn?: string;
  /** Falls back to the English instruction when left blank, rather than being required. */
  instructionHi?: string;
  /** One step per line. */
  solutionEn?: string;
  solutionHi?: string;
  /** Word: one paragraph per line. */
  passageEn?: string;
  passageHi?: string;
  /** Word: the character range of the one line the question names; blank means the whole paragraph. */
  scopeFrom?: string;
  scopeTo?: string;
  /** Excel: one array per row, one string per cell. */
  gridEn?: string[][];
  gridHi?: string[][];
  /** Excel: a non-default starting view, for a question whose task is to restore it. */
  startingGridlines?: boolean;
  startingHeadings?: boolean;
  /** The vocabulary in `src/exam/authoring/types.ts`, validated field by field below. */
  operations?: unknown[];
}

export interface ParsedQuestionFields {
  subject: TestSubject;
  topic: string;
  difficulty: QuestionDifficulty;
  marks: number;
  instructionEn: string;
  instructionHi: string;
  solutionEn: string[];
  solutionHi: string[];
  content: QuestionContentRow;
  operations: (WordOperation | ExcelOperation)[];
}

/** Splits a textarea into lines, dropping the blank ones a trailing newline leaves. */
function linesOf(value: string | undefined): string[] {
  return (value ?? '')
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line, index, all) => line !== '' || index < all.length - 1);
}

function steps(value: string | undefined): string[] {
  return (value ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, MAX_SOLUTION_STEPS);
}

/**
 * A question, parsed against the subject its test declares.
 *
 * `subject` is passed in rather than read from the body: a question belongs to
 * a test, the test decides which application it is sat in, and letting the
 * request say otherwise would put an Excel question in a Word paper.
 */
export function parseQuestionInput(body: QuestionInput, subject: TestSubject): ParseResult<ParsedQuestionFields> {
  const topic = body.topic?.trim() ?? '';
  if (!topic) return fail('TOPIC_REQUIRED', 'Enter the topic this question exercises.');

  const instructionEn = body.instructionEn?.trim() ?? '';
  if (!instructionEn) return fail('INSTRUCTION_REQUIRED', 'Enter the instruction, in English.');

  const marks = intOrNull(body.marks) ?? 1;
  if (marks < 1 || marks > MAX_MARKS) return fail('INVALID_MARKS', `Marks must be between 1 and ${MAX_MARKS}.`);

  const difficultyRaw = body.difficulty?.trim() ?? 'Easy';
  if (!isDifficulty(difficultyRaw)) return fail('INVALID_DIFFICULTY', 'Choose Easy, Medium or Hard.');

  const content = subject === 'word' ? parseWordContent(body) : parseExcelContent(body);
  if (!content.ok) return content as ParseResult<ParsedQuestionFields>;

  const operations = parseOperations(body.operations, subject);
  if (!operations.ok) return operations as ParseResult<ParsedQuestionFields>;

  return {
    ok: true,
    fields: {
      subject,
      topic,
      difficulty: difficultyRaw,
      marks,
      instructionEn,
      // A paper authored in English only is a real thing an admin does; making
      // the Hindi instruction required would only get English typed into it.
      instructionHi: body.instructionHi?.trim() || instructionEn,
      solutionEn: steps(body.solutionEn),
      solutionHi: steps(body.solutionHi).length > 0 ? steps(body.solutionHi) : steps(body.solutionEn),
      content: content.fields,
      operations: operations.fields,
    },
  };
}

function parseWordContent(body: QuestionInput): ParseResult<QuestionContentRow> {
  const en = linesOf(body.passageEn);
  if (en.length === 0 || en.every((line) => line === '')) {
    return fail('PASSAGE_REQUIRED', 'Enter the passage the candidate starts from.');
  }
  if (en.length > MAX_PASSAGE_LINES) {
    return fail('PASSAGE_TOO_LONG', `A passage may have at most ${MAX_PASSAGE_LINES} paragraphs.`);
  }
  if (en.some((line) => line.length > MAX_LINE_LENGTH)) {
    return fail('PASSAGE_TOO_LONG', `A paragraph may be at most ${MAX_LINE_LENGTH} characters.`);
  }

  const hiRaw = linesOf(body.passageHi);
  const hi = hiRaw.length > 0 && hiRaw.some((line) => line !== '') ? hiRaw : en;

  const scope = parseScope(body, en);
  if (!scope.ok) return scope as ParseResult<QuestionContentRow>;

  return { ok: true, fields: { subject: 'word', lines: { en, hi }, scope: scope.fields } };
}

/**
 * Whether the question names one line of the passage, and which characters it is.
 *
 * Offsets are measured against the rendered page, so a range only stays correct
 * while the passage, the page width and the default font do — the note above
 * `BOAT_LINE_TWO` in `seedAttempt.ts` says how to re-measure one. All this can
 * check is that the range lies inside the first paragraph.
 */
function parseScope(body: QuestionInput, lines: string[]): ParseResult<WordScope> {
  const from = intOrNull(body.scopeFrom);
  const to = intOrNull(body.scopeTo);

  if (from === null && to === null) return { ok: true, fields: 'all' };
  if (from === null || to === null) {
    return fail('INVALID_SCOPE', 'Give both the start and the end of the range, or leave both blank.');
  }
  if (from < 0 || to <= from) {
    return fail('INVALID_SCOPE', 'The range must start at 0 or more and end after it starts.');
  }
  if (to > (lines[0]?.length ?? 0)) {
    return fail('INVALID_SCOPE', 'The range runs past the end of the first paragraph.');
  }

  return { ok: true, fields: { from, to } };
}

function parseExcelContent(body: QuestionInput): ParseResult<QuestionContentRow> {
  const en = normaliseGrid(body.gridEn);
  if (!en.ok) return en as ParseResult<QuestionContentRow>;
  if (en.fields.length === 0) {
    return fail('SHEET_REQUIRED', 'Fill in at least one cell of the sheet the candidate starts from.');
  }

  const hi = normaliseGrid(body.gridHi);
  if (!hi.ok) return hi as ParseResult<QuestionContentRow>;

  // The two languages must describe the same sheet — only the labels may
  // differ — so an empty Hindi grid means "same as English", not "blank sheet".
  const hiGrid = hi.fields.length > 0 ? hi.fields : en.fields;

  const startingView =
    body.startingGridlines === false || body.startingHeadings === false
      ? { showGridlines: body.startingGridlines ?? true, showHeadings: body.startingHeadings ?? true }
      : undefined;

  return {
    ok: true,
    fields: {
      subject: 'excel',
      grid: { en: en.fields, hi: hiGrid },
      ...(startingView ? { startingView } : {}),
    },
  };
}

/** Trims a grid to its occupied rectangle, so trailing blank rows the form adds cost nothing. */
function normaliseGrid(grid: string[][] | undefined): ParseResult<string[][]> {
  if (!Array.isArray(grid)) return { ok: true, fields: [] };
  if (grid.length > MAX_GRID_ROWS) return fail('SHEET_TOO_LARGE', `A sheet may have at most ${MAX_GRID_ROWS} rows.`);

  const rows: string[][] = [];
  for (const row of grid) {
    if (!Array.isArray(row)) return fail('INVALID_SHEET', 'The sheet is not a grid of cells.');
    if (row.length > MAX_GRID_COLUMNS) {
      return fail('SHEET_TOO_LARGE', `A sheet may have at most ${MAX_GRID_COLUMNS} columns.`);
    }
    const cells = row.map((cell) => (typeof cell === 'string' ? cell.trim() : ''));
    if (cells.some((cell) => cell.length > MAX_CELL_LENGTH)) {
      return fail('SHEET_TOO_LARGE', `A cell may hold at most ${MAX_CELL_LENGTH} characters.`);
    }
    rows.push(cells);
  }

  // Drop trailing empty rows, then trailing empty columns.
  while (rows.length > 0 && rows[rows.length - 1]!.every((cell) => cell === '')) rows.pop();
  const width = rows.reduce((widest, row) => {
    const last = row.reduce((index, cell, at) => (cell === '' ? index : at), -1);
    return Math.max(widest, last + 1);
  }, 0);

  return { ok: true, fields: rows.map((row) => row.slice(0, width)) };
}

/* -- Operations ------------------------------------------------------------ */

const HEX_COLOUR = /^#[0-9a-f]{6}$/i;
const ALIGNMENTS = ['left', 'center', 'right', 'justify'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function colourOf(value: unknown): string | null {
  return typeof value === 'string' && HEX_COLOUR.test(value) ? value.toLowerCase() : null;
}

function numberOf(value: unknown, min: number, max: number): number | null {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return null;
  return parsed;
}

function indexOf(value: unknown, max: number): number | null {
  const parsed = numberOf(value, 0, max);
  return parsed === null || !Number.isInteger(parsed) ? null : parsed;
}

/** A zero-based range, rebuilt corner by corner so no extra properties survive. */
function rangeOf(value: unknown): { start: { row: number; col: number }; end: { row: number; col: number } } | null {
  if (!isRecord(value) || !isRecord(value.start) || !isRecord(value.end)) return null;

  const startRow = indexOf(value.start.row, MAX_GRID_ROWS);
  const startCol = indexOf(value.start.col, MAX_GRID_COLUMNS);
  const endRow = indexOf(value.end.row, MAX_GRID_ROWS);
  const endCol = indexOf(value.end.col, MAX_GRID_COLUMNS);
  if (startRow === null || startCol === null || endRow === null || endCol === null) return null;
  // Normalised so a range dragged upward or leftward still names the same cells.
  return {
    start: { row: Math.min(startRow, endRow), col: Math.min(startCol, endCol) },
    end: { row: Math.max(startRow, endRow), col: Math.max(startCol, endCol) },
  };
}

/**
 * The `CellStyle` properties a question may ask for.
 *
 * A whitelist, not a filter of a denylist: an unknown property is dropped
 * rather than stored, so a future `CellStyle` field cannot be set through this
 * route before the form and the answer key know what to do with it. Borders are
 * absent on purpose — `outsideBorder` is the operation that applies one, and
 * per-edge borders are not something any question here asks for.
 */
function styleOf(value: unknown): Partial<CellStyle> | null {
  if (!isRecord(value)) return null;
  const style: Partial<CellStyle> = {};

  if (typeof value.fontFamily === 'string' && value.fontFamily.trim()) {
    style.fontFamily = value.fontFamily.trim().slice(0, 100);
  }
  const fontSize = numberOf(value.fontSize, 1, 409);
  if (fontSize !== null) style.fontSize = fontSize;

  if (value.bold === true) style.bold = true;
  if (value.italic === true) style.italic = true;
  if (value.underline === true) style.underline = true;
  if (value.strikethrough === true) style.strikethrough = true;
  if (value.wrapText === true) style.wrapText = true;

  const fontColor = colourOf(value.fontColor);
  if (fontColor) style.fontColor = fontColor;
  const fillColor = colourOf(value.fillColor);
  if (fillColor) style.fillColor = fillColor;

  if (typeof value.horizontalAlignment === 'string' && (ALIGNMENTS as readonly string[]).includes(value.horizontalAlignment)) {
    style.horizontalAlignment = value.horizontalAlignment as CellStyle['horizontalAlignment'];
  }
  if (value.verticalAlignment === 'top' || value.verticalAlignment === 'middle' || value.verticalAlignment === 'bottom') {
    style.verticalAlignment = value.verticalAlignment;
  }
  if (value.textEffect === 'subscript' || value.textEffect === 'superscript') {
    style.textEffect = value.textEffect;
  }
  if (typeof value.numberFormat === 'string' && value.numberFormat.trim()) {
    style.numberFormat = value.numberFormat.trim().slice(0, 100);
  }
  const indent = indexOf(value.indent, 15);
  if (indent !== null && indent > 0) style.indent = indent;

  return Object.keys(style).length > 0 ? style : null;
}

function cellValueOf(value: unknown): CellValue | undefined {
  if (value === null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.slice(0, MAX_CELL_LENGTH);
  return undefined;
}

function wordOperationOf(raw: unknown): WordOperation | null {
  if (!isRecord(raw)) return null;

  switch (raw.kind) {
    case 'bold':
    case 'italic':
    case 'underline':
    case 'strike':
      return { kind: raw.kind };
    case 'highlight': {
      const color = colourOf(raw.color);
      return color ? { kind: 'highlight', color } : null;
    }
    case 'fontColor': {
      const color = colourOf(raw.color);
      return color ? { kind: 'fontColor', color } : null;
    }
    case 'fontFamily': {
      const family = typeof raw.family === 'string' ? raw.family.trim().slice(0, 100) : '';
      return family ? { kind: 'fontFamily', family } : null;
    }
    case 'fontSize': {
      const size = numberOf(raw.size, 1, 1638);
      return size === null ? null : { kind: 'fontSize', size };
    }
    case 'align':
      return typeof raw.align === 'string' && (ALIGNMENTS as readonly string[]).includes(raw.align)
        ? { kind: 'align', align: raw.align as (typeof ALIGNMENTS)[number] }
        : null;
    case 'lineHeight': {
      const value = numberOf(raw.value, 0.5, 10);
      return value === null ? null : { kind: 'lineHeight', value };
    }
    case 'indent': {
      const levels = indexOf(raw.levels, 10);
      return levels === null || levels < 1 ? null : { kind: 'indent', levels };
    }
    default:
      return null;
  }
}

function excelOperationOf(raw: unknown): ExcelOperation | null {
  if (!isRecord(raw)) return null;

  switch (raw.kind) {
    case 'merge': {
      const target = rangeOf(raw.range);
      return target
        ? { kind: 'merge', range: target, ...(raw.across === true ? { across: true } : {}), ...(raw.centre === true ? { centre: true } : {}) }
        : null;
    }
    case 'style': {
      const target = rangeOf(raw.range);
      const style = styleOf(raw.style);
      return target && style ? { kind: 'style', range: target, style } : null;
    }
    case 'outsideBorder': {
      const target = rangeOf(raw.range);
      if (!target) return null;
      const color = colourOf(raw.color);
      return { kind: 'outsideBorder', range: target, ...(color ? { color } : {}) };
    }
    case 'values': {
      if (!Array.isArray(raw.cells) || raw.cells.length === 0 || raw.cells.length > MAX_ANSWER_CELLS) return null;
      const cells: NonNullable<Extract<ExcelOperation, { kind: 'values' }>['cells']> = [];

      for (const entry of raw.cells) {
        if (!isRecord(entry)) return null;
        const row = indexOf(entry.row, MAX_GRID_ROWS);
        const col = indexOf(entry.col, MAX_GRID_COLUMNS);
        if (row === null || col === null) return null;

        const value = cellValueOf(entry.value);
        const formula =
          typeof entry.formula === 'string' && entry.formula.trim() ? entry.formula.trim().slice(0, MAX_CELL_LENGTH) : undefined;
        // A cell that asks for neither a value nor a formula asks for nothing.
        if (value === undefined && formula === undefined) return null;

        cells.push({ row, col, ...(value === undefined ? {} : { value }), ...(formula === undefined ? {} : { formula }) });
      }

      return { kind: 'values', cells };
    }
    case 'columnWidth': {
      const col = indexOf(raw.col, MAX_GRID_COLUMNS);
      const width = numberOf(raw.width, 1, 2_000);
      return col === null || width === null ? null : { kind: 'columnWidth', col, width };
    }
    case 'freeze': {
      const rows = indexOf(raw.rows, MAX_GRID_ROWS);
      const columns = indexOf(raw.columns, MAX_GRID_COLUMNS);
      return rows === null || columns === null ? null : { kind: 'freeze', rows, columns };
    }
    case 'view': {
      const view: Extract<ExcelOperation, { kind: 'view' }> = { kind: 'view' };
      if (typeof raw.showGridlines === 'boolean') view.showGridlines = raw.showGridlines;
      if (typeof raw.showHeadings === 'boolean') view.showHeadings = raw.showHeadings;
      // "Change the view" with nothing named is not a question.
      return view.showGridlines === undefined && view.showHeadings === undefined ? null : view;
    }
    case 'printArea': {
      if (raw.range === null) return { kind: 'printArea', range: null };
      const target = rangeOf(raw.range);
      return target ? { kind: 'printArea', range: target } : null;
    }
    default:
      return null;
  }
}

/**
 * Every operation, rebuilt from a closed vocabulary.
 *
 * One bad operation fails the whole question rather than being dropped: a
 * question silently missing the thing it asked for would be marked against an
 * answer key that no longer matches its own instruction, and the admin would
 * have no way to see that had happened.
 */
export function parseOperations(raw: unknown, subject: TestSubject): ParseResult<(WordOperation | ExcelOperation)[]> {
  if (raw === undefined || raw === null) return { ok: true, fields: [] };
  if (!Array.isArray(raw)) return fail('INVALID_OPERATIONS', 'The operations are not a list.');
  if (raw.length > MAX_OPERATIONS) {
    return fail('TOO_MANY_OPERATIONS', `A question may ask for at most ${MAX_OPERATIONS} operations.`);
  }

  const parsed: (WordOperation | ExcelOperation)[] = [];
  for (const [index, entry] of raw.entries()) {
    const operation = subject === 'word' ? wordOperationOf(entry) : excelOperationOf(entry);
    if (!operation) {
      const kind = isRecord(entry) && typeof entry.kind === 'string' ? `"${entry.kind}"` : 'it';
      return fail('INVALID_OPERATION', `Operation ${index + 1} is incomplete — check what ${kind} needs.`);
    }
    parsed.push(operation);
  }

  if (parsed.length === 0) {
    return fail('OPERATIONS_REQUIRED', 'Add at least one operation, so the question has an answer to show.');
  }

  return { ok: true, fields: parsed };
}
