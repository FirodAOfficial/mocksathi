'use client';

import { useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { rangeFromA1, rangeToA1 } from '@/exam/authoring';
import { columnToLabel, labelToColumn, type RangeAddress } from '@/spreadsheet/model/address';
import { QUESTION_DIFFICULTIES, type ExcelContentRow, type TestQuestion, type TestSubject, type WordContentRow } from '@/db/schema';
import styles from './TestWorkbench.module.css';

/**
 * Writing one question.
 *
 * The form asks for two things and derives the rest. What the candidate starts
 * from — a passage, or a sheet — and what they are asked to *do* to it, as the
 * operations of `src/exam/authoring/types.ts`. The model answer is never typed
 * in: it is built from those operations on the way out, so a question that says
 * "make it bold" cannot ship a worked answer that italicises it.
 *
 * Everything here is the admin's own text except the operation fields, which
 * are a closed vocabulary — the server rebuilds each one from that vocabulary
 * on arrival (`src/db/testInput.ts`) rather than storing what it was sent.
 */

/* -- Draft state ----------------------------------------------------------- */

interface StyleDraft {
  fontFamily: string;
  fontSize: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  useFontColor: boolean;
  fontColor: string;
  useFillColor: boolean;
  fillColor: string;
  horizontalAlignment: string;
  textEffect: string;
  numberFormat: string;
}

interface CellDraft {
  id: string;
  /** An A1 address, as typed. */
  ref: string;
  value: string;
  formula: string;
}

/**
 * One operation as the form holds it.
 *
 * Every field for every kind, rather than a union: switching an operation from
 * Bold to Highlight then keeps what was already typed, and there is no state
 * machine deciding which half of a union is live. Only the fields the chosen
 * kind uses are read on the way out.
 */
interface OperationDraft {
  /** React key only — never sent. */
  id: string;
  kind: string;
  color: string;
  family: string;
  size: string;
  align: string;
  lineHeight: string;
  levels: string;
  rangeA1: string;
  across: boolean;
  centre: boolean;
  style: StyleDraft;
  cells: CellDraft[];
  column: string;
  width: string;
  freezeRows: string;
  freezeColumns: string;
  gridlines: string;
  headings: string;
  clearPrintArea: boolean;
}

interface EditorState {
  topic: string;
  difficulty: string;
  marks: string;
  instructionEn: string;
  instructionHi: string;
  solutionEn: string;
  solutionHi: string;
  passageEn: string;
  passageHi: string;
  scopeFrom: string;
  scopeTo: string;
  gridEn: string[][];
  gridHi: string[][];
  startingGridlines: boolean;
  startingHeadings: boolean;
  operations: OperationDraft[];
}

const BLANK_STYLE: StyleDraft = {
  fontFamily: '',
  fontSize: '',
  bold: false,
  italic: false,
  underline: false,
  strikethrough: false,
  useFontColor: false,
  fontColor: '#000000',
  useFillColor: false,
  fillColor: '#ffff00',
  horizontalAlignment: '',
  textEffect: '',
  numberFormat: '',
};

/** The default colour per operation, so a freshly added one already means something. */
const DEFAULT_COLOUR: Record<string, string> = { highlight: '#ffff00', fontColor: '#ff0000' };

function newId(): string {
  return crypto.randomUUID();
}

function blankOperation(kind: string): OperationDraft {
  return {
    id: newId(),
    kind,
    color: DEFAULT_COLOUR[kind] ?? '#ffff00',
    family: '',
    size: '',
    align: 'center',
    lineHeight: '2',
    levels: '1',
    rangeA1: '',
    across: false,
    centre: kind === 'merge',
    style: { ...BLANK_STYLE },
    cells: [{ id: newId(), ref: '', value: '', formula: '' }],
    column: '',
    width: '120',
    freezeRows: '1',
    freezeColumns: '0',
    gridlines: '',
    headings: '',
    clearPrintArea: false,
  };
}

const BLANK_GRID_ROWS = 6;
const BLANK_GRID_COLUMNS = 4;

function blankGrid(rows = BLANK_GRID_ROWS, columns = BLANK_GRID_COLUMNS): string[][] {
  return Array.from({ length: rows }, () => Array.from({ length: columns }, () => ''));
}

/** Pads a stored grid out to the editor's minimum, so there is always somewhere to type. */
function gridForEditing(stored: string[][] | undefined, rows: number, columns: number): string[][] {
  const source = stored ?? [];
  return Array.from({ length: rows }, (_row, rowIndex) =>
    Array.from({ length: columns }, (_cell, colIndex) => source[rowIndex]?.[colIndex] ?? ''),
  );
}

function blankState(subject: TestSubject): EditorState {
  return {
    topic: '',
    difficulty: 'Easy',
    marks: '3',
    instructionEn: '',
    instructionHi: '',
    solutionEn: '',
    solutionHi: '',
    passageEn: '',
    passageHi: '',
    scopeFrom: '',
    scopeTo: '',
    gridEn: blankGrid(),
    gridHi: blankGrid(),
    startingGridlines: true,
    startingHeadings: true,
    operations: [blankOperation(subject === 'word' ? 'bold' : 'merge')],
  };
}

/* -- A stored question, back into the form --------------------------------- */

function styleDraftFrom(style: Record<string, unknown>): StyleDraft {
  return {
    ...BLANK_STYLE,
    fontFamily: typeof style.fontFamily === 'string' ? style.fontFamily : '',
    fontSize: typeof style.fontSize === 'number' ? String(style.fontSize) : '',
    bold: style.bold === true,
    italic: style.italic === true,
    underline: style.underline === true,
    strikethrough: style.strikethrough === true,
    useFontColor: typeof style.fontColor === 'string',
    fontColor: typeof style.fontColor === 'string' ? style.fontColor : BLANK_STYLE.fontColor,
    useFillColor: typeof style.fillColor === 'string',
    fillColor: typeof style.fillColor === 'string' ? style.fillColor : BLANK_STYLE.fillColor,
    horizontalAlignment: typeof style.horizontalAlignment === 'string' ? style.horizontalAlignment : '',
    textEffect: typeof style.textEffect === 'string' ? style.textEffect : '',
    numberFormat: typeof style.numberFormat === 'string' ? style.numberFormat : '',
  };
}

function operationDraftFrom(stored: Record<string, unknown>): OperationDraft {
  const kind = typeof stored.kind === 'string' ? stored.kind : 'bold';
  const draft = blankOperation(kind);
  const range = stored.range as RangeAddress | null | undefined;

  return {
    ...draft,
    ...(typeof stored.color === 'string' ? { color: stored.color } : {}),
    ...(typeof stored.family === 'string' ? { family: stored.family } : {}),
    ...(typeof stored.size === 'number' ? { size: String(stored.size) } : {}),
    ...(typeof stored.align === 'string' ? { align: stored.align } : {}),
    ...(typeof stored.value === 'number' ? { lineHeight: String(stored.value) } : {}),
    ...(typeof stored.levels === 'number' ? { levels: String(stored.levels) } : {}),
    ...(range ? { rangeA1: rangeToA1(range) } : {}),
    across: stored.across === true,
    centre: stored.centre === true,
    ...(stored.style ? { style: styleDraftFrom(stored.style as Record<string, unknown>) } : {}),
    ...(Array.isArray(stored.cells)
      ? {
          cells: (stored.cells as Record<string, unknown>[]).map((cell) => ({
            id: newId(),
            ref: `${columnToLabel(Number(cell.col))}${Number(cell.row) + 1}`,
            value: cell.value === undefined || cell.value === null ? '' : String(cell.value),
            formula: typeof cell.formula === 'string' ? cell.formula : '',
          })),
        }
      : {}),
    ...(typeof stored.col === 'number' ? { column: columnToLabel(stored.col) } : {}),
    ...(typeof stored.width === 'number' ? { width: String(stored.width) } : {}),
    ...(typeof stored.rows === 'number' ? { freezeRows: String(stored.rows) } : {}),
    ...(typeof stored.columns === 'number' ? { freezeColumns: String(stored.columns) } : {}),
    gridlines: typeof stored.showGridlines === 'boolean' ? String(stored.showGridlines) : '',
    headings: typeof stored.showHeadings === 'boolean' ? String(stored.showHeadings) : '',
    clearPrintArea: kind === 'printArea' && stored.range === null,
  };
}

function stateFromQuestion(question: TestQuestion): EditorState {
  const base: EditorState = {
    ...blankState(question.subject),
    topic: question.topic,
    difficulty: question.difficulty,
    marks: String(question.marks),
    instructionEn: question.instructionEn,
    instructionHi: question.instructionHi === question.instructionEn ? '' : question.instructionHi,
    solutionEn: question.solutionEn.join('\n'),
    solutionHi: question.solutionHi.join('\n') === question.solutionEn.join('\n') ? '' : question.solutionHi.join('\n'),
    operations: (question.operations as unknown as Record<string, unknown>[]).map(operationDraftFrom),
  };

  if (question.subject === 'word') {
    const content = question.content as WordContentRow;
    return {
      ...base,
      passageEn: content.lines.en.join('\n'),
      // The Hindi passage is stored even when it equals the English one; an
      // empty box here means "same as English", so show it as empty again.
      passageHi: content.lines.hi.join('\n') === content.lines.en.join('\n') ? '' : content.lines.hi.join('\n'),
      scopeFrom: content.scope === 'all' ? '' : String(content.scope.from),
      scopeTo: content.scope === 'all' ? '' : String(content.scope.to),
    };
  }

  const content = question.content as ExcelContentRow;
  const rows = Math.max(BLANK_GRID_ROWS, content.grid.en.length, content.grid.hi.length);
  const columns = Math.max(
    BLANK_GRID_COLUMNS,
    ...content.grid.en.map((row) => row.length),
    ...content.grid.hi.map((row) => row.length),
  );

  return {
    ...base,
    gridEn: gridForEditing(content.grid.en, rows, columns),
    gridHi: gridForEditing(content.grid.hi, rows, columns),
    startingGridlines: content.startingView?.showGridlines ?? true,
    startingHeadings: content.startingView?.showHeadings ?? true,
  };
}

/* -- The form back out to the API ------------------------------------------ */

function numberOrUndefined(value: string): number | undefined {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function styleFrom(draft: StyleDraft): Record<string, unknown> {
  return {
    ...(draft.fontFamily.trim() ? { fontFamily: draft.fontFamily.trim() } : {}),
    ...(numberOrUndefined(draft.fontSize) === undefined ? {} : { fontSize: numberOrUndefined(draft.fontSize) }),
    ...(draft.bold ? { bold: true } : {}),
    ...(draft.italic ? { italic: true } : {}),
    ...(draft.underline ? { underline: true } : {}),
    ...(draft.strikethrough ? { strikethrough: true } : {}),
    ...(draft.useFontColor ? { fontColor: draft.fontColor } : {}),
    ...(draft.useFillColor ? { fillColor: draft.fillColor } : {}),
    ...(draft.horizontalAlignment ? { horizontalAlignment: draft.horizontalAlignment } : {}),
    ...(draft.textEffect ? { textEffect: draft.textEffect } : {}),
    ...(draft.numberFormat.trim() ? { numberFormat: draft.numberFormat.trim() } : {}),
  };
}

/** The address a cell reference names, or null — `rangeFromA1` accepts a single cell. */
function addressFrom(ref: string): { row: number; col: number } | null {
  const parsed = rangeFromA1(ref);
  return parsed ? { row: parsed.start.row, col: parsed.start.col } : null;
}

/**
 * A typed cell value: a number if it reads as one, otherwise text.
 *
 * The same rule `cellValueOf` applies to the starting sheet, for the same
 * reason — an expected total of `1500` has to be the number a formula
 * produces, not the string "1500".
 */
function answerValueFrom(text: string): string | number | undefined {
  const trimmed = text.trim();
  if (trimmed === '') return undefined;
  return /^-?\d+(?:\.\d+)?$/.test(trimmed) ? Number(trimmed) : trimmed;
}

function operationFrom(draft: OperationDraft): Record<string, unknown> {
  const range = rangeFromA1(draft.rangeA1);

  switch (draft.kind) {
    case 'bold':
    case 'italic':
    case 'underline':
    case 'strike':
      return { kind: draft.kind };
    case 'highlight':
    case 'fontColor':
      return { kind: draft.kind, color: draft.color };
    case 'fontFamily':
      return { kind: 'fontFamily', family: draft.family };
    case 'fontSize':
      return { kind: 'fontSize', size: numberOrUndefined(draft.size) };
    case 'align':
      return { kind: 'align', align: draft.align };
    case 'lineHeight':
      return { kind: 'lineHeight', value: numberOrUndefined(draft.lineHeight) };
    case 'indent':
      return { kind: 'indent', levels: numberOrUndefined(draft.levels) };
    case 'merge':
      return { kind: 'merge', range, across: draft.across, centre: draft.centre };
    case 'style':
      return { kind: 'style', range, style: styleFrom(draft.style) };
    case 'outsideBorder':
      return { kind: 'outsideBorder', range };
    case 'values':
      return {
        kind: 'values',
        cells: draft.cells
          .map((cell) => {
            const address = addressFrom(cell.ref);
            if (!address) return null;
            const value = answerValueFrom(cell.value);
            const formula = cell.formula.trim();
            return {
              ...address,
              ...(value === undefined ? {} : { value }),
              ...(formula ? { formula } : {}),
            };
          })
          .filter((cell) => cell !== null),
      };
    case 'columnWidth':
      return { kind: 'columnWidth', col: labelToColumn(draft.column.trim()), width: numberOrUndefined(draft.width) };
    case 'freeze':
      return { kind: 'freeze', rows: numberOrUndefined(draft.freezeRows), columns: numberOrUndefined(draft.freezeColumns) };
    case 'view':
      return {
        kind: 'view',
        ...(draft.gridlines === '' ? {} : { showGridlines: draft.gridlines === 'true' }),
        ...(draft.headings === '' ? {} : { showHeadings: draft.headings === 'true' }),
      };
    case 'printArea':
      return { kind: 'printArea', range: draft.clearPrintArea ? null : range };
    default:
      return { kind: draft.kind };
  }
}

/**
 * What an operation still needs before the server would accept it.
 *
 * A mirror of `wordOperationOf` / `excelOperationOf` in `src/db/testInput.ts`,
 * and deliberately only that: the server stays the one that decides, because it
 * is the one that cannot be bypassed. This exists so the gap is visible while
 * it is being typed rather than announced as "Operation 3 is incomplete" after
 * a failed save, by which point the admin has to work out which one that was.
 */
function operationProblem(draft: OperationDraft): string | null {
  const needsRange = (): string | null =>
    rangeFromA1(draft.rangeA1) ? null : draft.rangeA1.trim() === '' ? 'Needs a range' : 'That is not a range';

  switch (draft.kind) {
    case 'fontFamily':
      return draft.family.trim() ? null : 'Needs a font name';
    case 'fontSize':
      return numberOrUndefined(draft.size) === undefined ? 'Needs a size' : null;
    case 'lineHeight':
      return numberOrUndefined(draft.lineHeight) === undefined ? 'Needs a spacing' : null;
    case 'indent':
      return numberOrUndefined(draft.levels) === undefined ? 'Needs a number of levels' : null;
    case 'merge':
    case 'outsideBorder':
      return needsRange();
    case 'style':
      return needsRange() ?? (Object.keys(styleFrom(draft.style)).length > 0 ? null : 'Needs at least one formatting choice');
    case 'values': {
      const addressed = draft.cells.filter((cell) => addressFrom(cell.ref));
      if (addressed.length === 0) return 'Needs at least one cell, written as A1';
      return addressed.every((cell) => cell.value.trim() || cell.formula.trim())
        ? null
        : 'Every cell listed needs a value or a formula';
    }
    case 'columnWidth':
      return labelToColumn(draft.column.trim()) === null
        ? 'Needs a column letter'
        : numberOrUndefined(draft.width) === undefined
          ? 'Needs a width'
          : null;
    case 'freeze':
      return numberOrUndefined(draft.freezeRows) === undefined || numberOrUndefined(draft.freezeColumns) === undefined
        ? 'Needs a number of rows and columns'
        : null;
    case 'view':
      return draft.gridlines === '' && draft.headings === '' ? 'Needs gridlines or headings to be set' : null;
    case 'printArea':
      return draft.clearPrintArea ? null : needsRange();
    default:
      return null;
  }
}

/** Whether a grid has anything typed into it at all. */
function gridIsEmpty(grid: string[][]): boolean {
  return grid.every((row) => row.every((cell) => cell.trim() === ''));
}

/* -- Vocabulary shown in the pickers --------------------------------------- */

const WORD_KINDS: { value: string; label: string }[] = [
  { value: 'bold', label: 'Bold' },
  { value: 'italic', label: 'Italic' },
  { value: 'underline', label: 'Underline' },
  { value: 'strike', label: 'Strikethrough' },
  { value: 'highlight', label: 'Highlight colour' },
  { value: 'fontColor', label: 'Font colour' },
  { value: 'fontFamily', label: 'Font' },
  { value: 'fontSize', label: 'Font size' },
  { value: 'align', label: 'Alignment' },
  { value: 'lineHeight', label: 'Line spacing' },
  { value: 'indent', label: 'Indent' },
];

const EXCEL_KINDS: { value: string; label: string }[] = [
  { value: 'merge', label: 'Merge cells' },
  { value: 'style', label: 'Formatting' },
  { value: 'outsideBorder', label: 'Outside border' },
  { value: 'values', label: 'Values & formulas' },
  { value: 'columnWidth', label: 'Column width' },
  { value: 'freeze', label: 'Freeze panes' },
  { value: 'view', label: 'Gridlines & headings' },
  { value: 'printArea', label: 'Print area' },
];

/* -- The editor ------------------------------------------------------------ */

export interface QuestionEditorProps {
  testId: string;
  subject: TestSubject;
  /** Present when editing an existing question; absent when adding one. */
  question?: TestQuestion;
  onSaved: () => void;
  onCancel: () => void;
}

export function QuestionEditor({ testId, subject, question, onSaved, onCancel }: QuestionEditorProps) {
  const [values, setValues] = useState<EditorState>(() => (question ? stateFromQuestion(question) : blankState(subject)));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof EditorState>(key: K, value: EditorState[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function handleChange(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
  }

  /** The two sheets must stay the same shape, so a resize applies to both. */
  function resizeSheets(rows: number, columns: number) {
    setValues((current) => ({
      ...current,
      gridEn: gridForEditing(current.gridEn, rows, columns),
      gridHi: gridForEditing(current.gridHi, rows, columns),
    }));
  }

  function updateOperation(operationId: string, changes: Partial<OperationDraft>) {
    set(
      'operations',
      values.operations.map((operation) => (operation.id === operationId ? { ...operation, ...changes } : operation)),
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);

    const payload = {
      topic: values.topic,
      difficulty: values.difficulty,
      marks: values.marks,
      instructionEn: values.instructionEn,
      instructionHi: values.instructionHi,
      solutionEn: values.solutionEn,
      solutionHi: values.solutionHi,
      ...(subject === 'word'
        ? {
            passageEn: values.passageEn,
            passageHi: values.passageHi,
            scopeFrom: values.scopeFrom,
            scopeTo: values.scopeTo,
          }
        : {
            gridEn: values.gridEn,
            gridHi: values.gridHi,
            startingGridlines: values.startingGridlines,
            startingHeadings: values.startingHeadings,
          }),
      operations: values.operations.map(operationFrom),
    };

    try {
      const response = await fetch(
        question ? `/api/admin/tests/${testId}/questions/${question.id}` : `/api/admin/tests/${testId}/questions`,
        {
          method: question ? 'PUT' : 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { detail?: string } | null;
        setError(body?.detail ?? 'The question could not be saved. Try again.');
        return;
      }

      onSaved();
    } finally {
      setSaving(false);
    }
  }

  const kinds = subject === 'word' ? WORD_KINDS : EXCEL_KINDS;
  const id = (field: string): string => `${field}-${question?.id ?? 'new'}`;

  /*
   * What is still missing, recomputed every render rather than captured when
   * Save is pressed.
   *
   * Required-ness is a property of the form's contents, not of having tried to
   * submit — so the gaps are marked from the moment the editor opens, and a
   * field stops being marked the moment it is filled. Hindi is never required:
   * an empty Hindi box means "same as English" (`parseQuestionInput`), which is
   * a real thing an admin wants and not an omission to nag about.
   */
  const missing = {
    topic: values.topic.trim() === '',
    instruction: values.instructionEn.trim() === '',
    marks: numberOrUndefined(values.marks) === undefined,
    passage: subject === 'word' && values.passageEn.trim() === '',
    sheet: subject === 'excel' && gridIsEmpty(values.gridEn),
    noOperations: values.operations.length === 0,
  };
  const operationProblems = new Map(
    values.operations.map((operation) => [operation.id, operationProblem(operation)] as const),
  );

  /** Everything outstanding, named in one place — the per-field marks can be off-screen behind the language tabs. */
  const outstanding: string[] = [
    missing.topic ? 'a topic' : null,
    missing.instruction ? 'the English instruction' : null,
    missing.marks ? 'a mark value' : null,
    missing.passage ? 'the English passage' : null,
    missing.sheet ? 'the English starting sheet' : null,
    missing.noOperations ? 'at least one operation' : null,
    ...values.operations.map((operation, index) => {
      const problem = operationProblems.get(operation.id);
      return problem ? `operation ${index + 1} (${problem.toLowerCase()})` : null;
    }),
  ].filter((entry) => entry !== null);

  /** `styles.invalid` on a control, but only while the control is actually on screen. */
  const mark = (isMissing: boolean): string => (isMissing ? ` ${styles.invalid}` : '');

  return (
    <form className={styles.editor} onSubmit={handleSubmit} noValidate>
      <div className={styles.editorHead}>
        <h3 className={styles.editorTitle}>
          {question ? `Question ${question.position}` : 'New question'}
        </h3>
        {/* Both languages are on screen together rather than behind a toggle:
            a question carries both, they have to say the same thing, and you
            cannot check that against something you cannot see. */}
        <p className={styles.hint}>English and हिन्दी together — Hindi is optional.</p>
      </div>

      <div className={styles.grid3}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={id('topic')}>
            Topic
          </label>
          <input
            id={id('topic')}
            name="topic"
            className={styles.input + mark(missing.topic)}
            placeholder={subject === 'word' ? 'Character Formatting' : 'Merge & Center'}
            value={values.topic}
            onChange={handleChange}
            aria-invalid={missing.topic}
            required
          />
          {missing.topic && <p className={styles.requiredNote}>Required</p>}
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={id('difficulty')}>
            Difficulty
          </label>
          <select
            id={id('difficulty')}
            name="difficulty"
            className={styles.select}
            value={values.difficulty}
            onChange={handleChange}
          >
            {QUESTION_DIFFICULTIES.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={id('marks')}>
            Marks
          </label>
          <input
            id={id('marks')}
            name="marks"
            type="number"
            min={1}
            max={100}
            className={styles.input + mark(missing.marks)}
            value={values.marks}
            onChange={handleChange}
            aria-invalid={missing.marks}
          />
          {missing.marks && <p className={styles.requiredNote}>Required</p>}
        </div>
      </div>

      <div className={styles.group}>
        <p className={styles.groupTitle}>What the candidate is asked</p>
        <div className={styles.grid2}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor={id('instructionEn')}>
              Instruction <span className={styles.optional}>· English</span>
            </label>
            <textarea
              id={id('instructionEn')}
              name="instructionEn"
              className={styles.textarea + mark(missing.instruction)}
              placeholder="Make the paragraph bold and underline it."
              value={values.instructionEn}
              onChange={handleChange}
              aria-invalid={missing.instruction}
            />
            {missing.instruction && <p className={styles.requiredNote}>Required</p>}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor={id('instructionHi')}>
              Instruction <span className={styles.optional}>· हिन्दी, blank reuses the English</span>
            </label>
            <textarea
              id={id('instructionHi')}
              name="instructionHi"
              className={styles.textarea}
              placeholder="पैराग्राफ को बोल्ड करें, अंडरलाइन करें।"
              value={values.instructionHi}
              onChange={handleChange}
            />
          </div>
        </div>
        <p className={styles.hint}>
          Shown beside the document, never inside it — so there is nothing in the answer the candidate could
          format by mistake.
        </p>

        <div className={styles.grid2}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor={id('solutionEn')}>
              Solution steps <span className={styles.optional}>· English, one per line</span>
            </label>
            <textarea
              id={id('solutionEn')}
              name="solutionEn"
              className={styles.textarea}
              placeholder={'Select the whole paragraph.\nOn the Home tab, click Bold.'}
              value={values.solutionEn}
              onChange={handleChange}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor={id('solutionHi')}>
              Solution steps <span className={styles.optional}>· हिन्दी, blank reuses the English</span>
            </label>
            <textarea
              id={id('solutionHi')}
              name="solutionHi"
              className={styles.textarea}
              placeholder={'पूरे पैराग्राफ को सेलेक्ट करें।\nHome टैब में Bold पर क्लिक करें।'}
              value={values.solutionHi}
              onChange={handleChange}
            />
          </div>
        </div>
        <p className={styles.hint}>The ribbon route, shown only after the paper closes.</p>
      </div>

      <div className={styles.group}>
        <p className={styles.groupTitle}>What they start from</p>
        {subject === 'word' ? (
          <>
            <div className={styles.grid2}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor={id('passageEn')}>
                  Passage <span className={styles.optional}>· English, one paragraph per line</span>
                </label>
                <textarea
                  id={id('passageEn')}
                  name="passageEn"
                  className={styles.textarea + mark(missing.passage)}
                  value={values.passageEn}
                  onChange={handleChange}
                  aria-invalid={missing.passage}
                />
                {missing.passage && <p className={styles.requiredNote}>Required</p>}
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor={id('passageHi')}>
                  Passage <span className={styles.optional}>· हिन्दी, blank reuses the English</span>
                </label>
                <textarea
                  id={id('passageHi')}
                  name="passageHi"
                  className={styles.textarea}
                  value={values.passageHi}
                  onChange={handleChange}
                />
              </div>
            </div>
            <p className={styles.hint}>
              The passage is the whole answer document, so everything in it is under test. A question that names a
              line by character range must read identically in both languages — the offsets are measured against
              the rendered page.
            </p>

            <div className={styles.grid2}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor={`scopeFrom-${question?.id ?? 'new'}`}>
                  Line range: from <span className={styles.optional}>(optional)</span>
                </label>
                <input
                  id={`scopeFrom-${question?.id ?? 'new'}`}
                  name="scopeFrom"
                  type="number"
                  min={0}
                  className={styles.input}
                  placeholder="Whole paragraph"
                  value={values.scopeFrom}
                  onChange={handleChange}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor={`scopeTo-${question?.id ?? 'new'}`}>
                  Line range: to <span className={styles.optional}>(optional)</span>
                </label>
                <input
                  id={`scopeTo-${question?.id ?? 'new'}`}
                  name="scopeTo"
                  type="number"
                  min={1}
                  className={styles.input}
                  placeholder="Whole paragraph"
                  value={values.scopeTo}
                  onChange={handleChange}
                />
              </div>
            </div>
            <p className={styles.hint}>
              Leave both blank unless the question names one wrapped line (&ldquo;underline the 2nd line&rdquo;).
              Those are character offsets into the first paragraph, measured from the rendered page — so a passage
              addressed this way must read identically in both languages, and must be re-measured if its wording
              changes.
            </p>
          </>
        ) : (
          <>
            {/* Stacked rather than side by side: a sheet is already as wide as
                the panel, and two of them abreast would put both behind a
                horizontal scrollbar. Resizing either resizes both, since the
                two have to describe the same layout. */}
            <p className={styles.label}>Starting sheet · English</p>
            {missing.sheet && <p className={styles.requiredNote}>Required — fill in at least one cell.</p>}
            <SheetGridEditor
              invalid={missing.sheet}
              grid={values.gridEn}
              onChange={(next) => set('gridEn', next)}
              onResize={resizeSheets}
            />

            <p className={styles.label}>Starting sheet · हिन्दी — blank reuses the English</p>
            <SheetGridEditor grid={values.gridHi} onChange={(next) => set('gridHi', next)} onResize={resizeSheets} />

            <p className={styles.hint}>
              Only the labels may differ between the two — the numbers, the layout and every cell address must
              not, because one answer key has to be right for both.
            </p>
            <div className={styles.checkRow}>
              <label className={styles.check}>
                <input
                  type="checkbox"
                  checked={values.startingGridlines}
                  onChange={(event) => set('startingGridlines', event.target.checked)}
                />
                Gridlines shown at the start
              </label>
              <label className={styles.check}>
                <input
                  type="checkbox"
                  checked={values.startingHeadings}
                  onChange={(event) => set('startingHeadings', event.target.checked)}
                />
                Row &amp; column headings shown at the start
              </label>
            </div>
          </>
        )}
      </div>

      <div className={styles.group}>
        <p className={styles.groupTitle}>What they have to do</p>
        <p className={styles.hint}>
          One entry per thing the question asks for. The model answer is built from these, and a candidate who
          does something extra has not answered the question — so add only what the instruction says.
        </p>

        <div className={styles.operations}>
          {missing.noOperations && (
            <p className={`${styles.operationEmpty} ${styles.invalid}`}>
              Required — a question with no operation has no answer to show.
            </p>
          )}
          {values.operations.map((operation, index) => (
            <div
              className={operationProblems.get(operation.id) ? `${styles.operation} ${styles.invalid}` : styles.operation}
              key={operation.id}
            >
              <div className={styles.operationHead}>
                <span className={styles.number}>{index + 1}</span>
                <select
                  className={styles.operationKind}
                  value={operation.kind}
                  onChange={(event) => updateOperation(operation.id, { kind: event.target.value })}
                  aria-label={`Operation ${index + 1}`}
                >
                  {kinds.map((kind) => (
                    <option key={kind.value} value={kind.value}>
                      {kind.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className={styles.dangerButton}
                  onClick={() => set('operations', values.operations.filter((entry) => entry.id !== operation.id))}
                  aria-label={`Remove operation ${index + 1}`}
                >
                  Remove
                </button>
              </div>
              <OperationFields
                operation={operation}
                onChange={(changes) => updateOperation(operation.id, changes)}
              />
              {operationProblems.get(operation.id) && (
                <p className={styles.requiredNote}>{operationProblems.get(operation.id)}</p>
              )}
            </div>
          ))}
        </div>

        <button
          type="button"
          className={styles.addButton}
          onClick={() =>
            set('operations', [...values.operations, blankOperation(subject === 'word' ? 'bold' : 'style')])
          }
        >
          + Add an operation
        </button>
      </div>

      {outstanding.length > 0 && (
        <p className={styles.outstanding}>
          Still needed: {outstanding.join(', ')}.
        </p>
      )}

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <div className={styles.actions}>
        <button type="submit" className={styles.primary} disabled={saving}>
          {saving ? 'Saving…' : question ? 'Save question' : 'Add question'}
        </button>
        <button type="button" className={styles.secondary} onClick={onCancel} disabled={saving}>
          Cancel
        </button>
      </div>
    </form>
  );
}

/* -- Per-kind fields ------------------------------------------------------- */

function Field({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <label className={styles.field}>
      <span className={styles.label}>{label}</span>
      {children}
    </label>
  );
}

/** Echoes back what a typed range actually names, so a typo is visible before saving. */
function RangeField({
  value,
  onChange,
  label = 'Range',
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}) {
  const parsed = rangeFromA1(value);

  return (
    <div className={styles.field}>
      <label className={styles.field}>
        <span className={styles.label}>{label}</span>
        <input
          className={styles.input}
          placeholder="A1:D1"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
      <p className={styles.hint}>
        {value.trim() === ''
          ? 'Zero or more cells, written as Excel writes them — A1, or A1:D6.'
          : parsed
            ? `${rangeToA1(parsed)} — ${parsed.end.row - parsed.start.row + 1} row(s) × ${parsed.end.col - parsed.start.col + 1} column(s).`
            : 'Not a range — write it as A1 or A1:D6.'}
      </p>
    </div>
  );
}

function OperationFields({
  operation,
  onChange,
}: {
  operation: OperationDraft;
  onChange: (changes: Partial<OperationDraft>) => void;
}) {
  switch (operation.kind) {
    case 'bold':
    case 'italic':
    case 'underline':
    case 'strike':
      return null;

    case 'highlight':
    case 'fontColor':
      return (
        <div className={styles.grid2}>
          <Field label="Colour">
            <input
              type="color"
              className={styles.colorInput}
              value={operation.color}
              onChange={(event) => onChange({ color: event.target.value })}
            />
          </Field>
        </div>
      );

    case 'fontFamily':
      return (
        <div className={styles.grid2}>
          <Field label="Font name">
            <input
              className={styles.input}
              placeholder="Times New Roman"
              value={operation.family}
              onChange={(event) => onChange({ family: event.target.value })}
            />
          </Field>
        </div>
      );

    case 'fontSize':
      return (
        <div className={styles.grid2}>
          <Field label="Size (pt)">
            <input
              type="number"
              min={1}
              className={styles.input}
              placeholder="15"
              value={operation.size}
              onChange={(event) => onChange({ size: event.target.value })}
            />
          </Field>
        </div>
      );

    case 'align':
      return (
        <div className={styles.grid2}>
          <Field label="Alignment">
            <select
              className={styles.select}
              value={operation.align}
              onChange={(event) => onChange({ align: event.target.value })}
            >
              <option value="left">Left</option>
              <option value="center">Centre</option>
              <option value="right">Right</option>
              <option value="justify">Justify</option>
            </select>
          </Field>
        </div>
      );

    case 'lineHeight':
      return (
        <div className={styles.grid2}>
          <Field label="Line spacing">
            <input
              type="number"
              step="0.05"
              min={0.5}
              className={styles.input}
              placeholder="2"
              value={operation.lineHeight}
              onChange={(event) => onChange({ lineHeight: event.target.value })}
            />
          </Field>
        </div>
      );

    case 'indent':
      return (
        <div className={styles.grid2}>
          <Field label="Indent levels">
            <input
              type="number"
              min={1}
              max={10}
              className={styles.input}
              value={operation.levels}
              onChange={(event) => onChange({ levels: event.target.value })}
            />
          </Field>
        </div>
      );

    case 'merge':
      return (
        <>
          <div className={styles.grid2}>
            <RangeField value={operation.rangeA1} onChange={(rangeA1) => onChange({ rangeA1 })} />
          </div>
          <div className={styles.checkRow}>
            <label className={styles.check}>
              <input
                type="checkbox"
                checked={operation.centre}
                onChange={(event) => onChange({ centre: event.target.checked })}
              />
              Also centre (Merge &amp; Center)
            </label>
            <label className={styles.check}>
              <input
                type="checkbox"
                checked={operation.across}
                onChange={(event) => onChange({ across: event.target.checked })}
              />
              Merge Across — each row on its own
            </label>
          </div>
        </>
      );

    case 'style':
      return (
        <>
          <div className={styles.grid2}>
            <RangeField value={operation.rangeA1} onChange={(rangeA1) => onChange({ rangeA1 })} />
          </div>
          <StyleFields style={operation.style} onChange={(style) => onChange({ style })} />
        </>
      );

    case 'outsideBorder':
      return (
        <div className={styles.grid2}>
          <RangeField value={operation.rangeA1} onChange={(rangeA1) => onChange({ rangeA1 })} />
        </div>
      );

    case 'values':
      return <AnswerCellFields cells={operation.cells} onChange={(cells) => onChange({ cells })} />;

    case 'columnWidth':
      return (
        <div className={styles.grid2}>
          <Field label="Column">
            <input
              className={styles.input}
              placeholder="D"
              value={operation.column}
              onChange={(event) => onChange({ column: event.target.value.toUpperCase() })}
            />
          </Field>
          <Field label="Width (px)">
            <input
              type="number"
              min={1}
              className={styles.input}
              value={operation.width}
              onChange={(event) => onChange({ width: event.target.value })}
            />
          </Field>
        </div>
      );

    case 'freeze':
      return (
        <div className={styles.grid2}>
          <Field label="Rows frozen">
            <input
              type="number"
              min={0}
              className={styles.input}
              value={operation.freezeRows}
              onChange={(event) => onChange({ freezeRows: event.target.value })}
            />
          </Field>
          <Field label="Columns frozen">
            <input
              type="number"
              min={0}
              className={styles.input}
              value={operation.freezeColumns}
              onChange={(event) => onChange({ freezeColumns: event.target.value })}
            />
          </Field>
        </div>
      );

    case 'view':
      return (
        <div className={styles.grid2}>
          <Field label="Gridlines">
            <select
              className={styles.select}
              value={operation.gridlines}
              onChange={(event) => onChange({ gridlines: event.target.value })}
            >
              <option value="">Leave as they are</option>
              <option value="true">Show</option>
              <option value="false">Hide</option>
            </select>
          </Field>
          <Field label="Row &amp; column headings">
            <select
              className={styles.select}
              value={operation.headings}
              onChange={(event) => onChange({ headings: event.target.value })}
            >
              <option value="">Leave as they are</option>
              <option value="true">Show</option>
              <option value="false">Hide</option>
            </select>
          </Field>
        </div>
      );

    case 'printArea':
      return (
        <>
          {!operation.clearPrintArea && (
            <div className={styles.grid2}>
              <RangeField
                value={operation.rangeA1}
                onChange={(rangeA1) => onChange({ rangeA1 })}
                label="Print area"
              />
            </div>
          )}
          <div className={styles.checkRow}>
            <label className={styles.check}>
              <input
                type="checkbox"
                checked={operation.clearPrintArea}
                onChange={(event) => onChange({ clearPrintArea: event.target.checked })}
              />
              Clear the print area instead of setting one
            </label>
          </div>
        </>
      );

    default:
      return null;
  }
}

function StyleFields({ style, onChange }: { style: StyleDraft; onChange: (style: StyleDraft) => void }) {
  const set = <K extends keyof StyleDraft>(key: K, value: StyleDraft[K]) => onChange({ ...style, [key]: value });

  return (
    <>
      <div className={styles.checkRow}>
        {(['bold', 'italic', 'underline', 'strikethrough'] as const).map((mark) => (
          <label className={styles.check} key={mark}>
            <input type="checkbox" checked={style[mark]} onChange={(event) => set(mark, event.target.checked)} />
            {mark[0]!.toUpperCase() + mark.slice(1)}
          </label>
        ))}
      </div>

      <div className={styles.grid3}>
        <Field label="Font">
          <input
            className={styles.input}
            placeholder="Calibri"
            value={style.fontFamily}
            onChange={(event) => set('fontFamily', event.target.value)}
          />
        </Field>
        <Field label="Size (pt)">
          <input
            type="number"
            min={1}
            className={styles.input}
            placeholder="20"
            value={style.fontSize}
            onChange={(event) => set('fontSize', event.target.value)}
          />
        </Field>
        <Field label="Number format">
          <input
            className={styles.input}
            placeholder="₹#,##0"
            value={style.numberFormat}
            onChange={(event) => set('numberFormat', event.target.value)}
          />
        </Field>
        <Field label="Alignment">
          <select
            className={styles.select}
            value={style.horizontalAlignment}
            onChange={(event) => set('horizontalAlignment', event.target.value)}
          >
            <option value="">Leave as it is</option>
            <option value="left">Left</option>
            <option value="center">Centre</option>
            <option value="right">Right</option>
            <option value="justify">Justify</option>
          </select>
        </Field>
        <Field label="Effect">
          <select className={styles.select} value={style.textEffect} onChange={(event) => set('textEffect', event.target.value)}>
            <option value="">None</option>
            <option value="subscript">Subscript</option>
            <option value="superscript">Superscript</option>
          </select>
        </Field>
      </div>

      <div className={styles.grid2}>
        <div className={styles.field}>
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={style.useFontColor}
              onChange={(event) => set('useFontColor', event.target.checked)}
            />
            Text colour
          </label>
          {style.useFontColor && (
            <input
              type="color"
              className={styles.colorInput}
              value={style.fontColor}
              onChange={(event) => set('fontColor', event.target.value)}
              aria-label="Text colour"
            />
          )}
        </div>
        <div className={styles.field}>
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={style.useFillColor}
              onChange={(event) => set('useFillColor', event.target.checked)}
            />
            Cell background
          </label>
          {style.useFillColor && (
            <input
              type="color"
              className={styles.colorInput}
              value={style.fillColor}
              onChange={(event) => set('fillColor', event.target.value)}
              aria-label="Cell background"
            />
          )}
        </div>
      </div>
    </>
  );
}

/**
 * The cells a spreadsheet answer fills in.
 *
 * Value *and* formula, because a question that asks for `=MIN(B2:B6)` is
 * answered by a cell that both holds that formula and shows what it works out
 * to — the review screen shows the result, and a formula alone would leave it
 * blank.
 */
function AnswerCellFields({ cells, onChange }: { cells: CellDraft[]; onChange: (cells: CellDraft[]) => void }) {
  return (
    <div className={styles.cells}>
      <div className={styles.cellHead}>
        <span>Cell</span>
        <span>Value</span>
        <span>Formula (optional)</span>
        <span />
      </div>
      {cells.map((cell, index) => (
        <div className={styles.cellRow} key={cell.id}>
          <input
            className={styles.input}
            placeholder="D2"
            value={cell.ref}
            aria-label={`Cell ${index + 1} address`}
            onChange={(event) =>
              onChange(cells.map((entry) => (entry.id === cell.id ? { ...entry, ref: event.target.value.toUpperCase() } : entry)))
            }
          />
          <input
            className={styles.input}
            placeholder="1500"
            value={cell.value}
            aria-label={`Cell ${index + 1} value`}
            onChange={(event) =>
              onChange(cells.map((entry) => (entry.id === cell.id ? { ...entry, value: event.target.value } : entry)))
            }
          />
          <input
            className={styles.input}
            placeholder="=B2-C2"
            value={cell.formula}
            aria-label={`Cell ${index + 1} formula`}
            onChange={(event) =>
              onChange(cells.map((entry) => (entry.id === cell.id ? { ...entry, formula: event.target.value } : entry)))
            }
          />
          <button
            type="button"
            className={styles.dangerButton}
            onClick={() => onChange(cells.filter((entry) => entry.id !== cell.id))}
            aria-label={`Remove cell ${index + 1}`}
            disabled={cells.length === 1}
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        className={styles.secondary}
        onClick={() => onChange([...cells, { id: newId(), ref: '', value: '', formula: '' }])}
      >
        + Add a cell
      </button>
    </div>
  );
}

/** The sheet the candidate opens, typed in as a grid rather than as JSON. */
function SheetGridEditor({
  grid,
  onChange,
  onResize,
  invalid = false,
}: {
  grid: string[][];
  onChange: (grid: string[][]) => void;
  onResize: (rows: number, columns: number) => void;
  invalid?: boolean;
}) {
  const rows = grid.length;
  const columns = grid[0]?.length ?? 0;

  return (
    <>
      <div className={invalid ? `${styles.sheet} ${styles.invalid}` : styles.sheet}>
        <table className={styles.sheetTable}>
          <thead>
            <tr>
              <th />
              {Array.from({ length: columns }, (_column, index) => (
                <th key={index}>{columnToLabel(index)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.map((row, rowIndex) => (
              <tr key={rowIndex}>
                <th>{rowIndex + 1}</th>
                {row.map((cell, colIndex) => (
                  <td key={colIndex}>
                    <input
                      className={styles.sheetCell}
                      value={cell}
                      aria-label={`${columnToLabel(colIndex)}${rowIndex + 1}`}
                      onChange={(event) =>
                        onChange(
                          grid.map((currentRow, currentRowIndex) =>
                            currentRowIndex === rowIndex
                              ? currentRow.map((currentCell, currentColIndex) =>
                                  currentColIndex === colIndex ? event.target.value : currentCell,
                                )
                              : currentRow,
                          ),
                        )
                      }
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.sheetControls}>
        <button type="button" className={styles.secondary} onClick={() => onResize(rows + 1, columns)}>
          + Row
        </button>
        <button type="button" className={styles.secondary} onClick={() => onResize(rows, columns + 1)}>
          + Column
        </button>
        <button
          type="button"
          className={styles.secondary}
          onClick={() => onResize(Math.max(1, rows - 1), columns)}
          disabled={rows <= 1}
        >
          − Row
        </button>
        <button
          type="button"
          className={styles.secondary}
          onClick={() => onResize(rows, Math.max(1, columns - 1))}
          disabled={columns <= 1}
        >
          − Column
        </button>
      </div>
    </>
  );
}
