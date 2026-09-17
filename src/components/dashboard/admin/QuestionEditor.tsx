'use client';

import { useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { rangeFromA1, rangeToA1 } from '@/exam/authoring';
import { columnToLabel, labelToColumn, type RangeAddress } from '@/spreadsheet/model/address';
import { QUESTION_DIFFICULTIES, type ExcelContentRow, type TestQuestion, type TestSubject, type WordContentRow } from '@/db/schema';
import { WORD_FUNCTIONS, WORD_FUNCTION_LIST, isWordFunctionId } from '@/editor/functions/catalog';
import type { WordOperation } from '@/exam/authoring';
import { PassagePreview } from '@/components/result/PassagePreview';
import { questionPreview } from './questionPreview';
import { FUNCTION_CATEGORIES, type ParamSpec } from '@/editor/functions/types';
import {
  SELECTORS,
  resolveSelections,
  type SelectionSpec,
  type SelectorName,
} from '@/editor/functions/selection';
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
  /**
   * A Word function's arguments, by parameter name.
   *
   * Held as strings because that is what an input yields; the catalog's
   * `ParamSpec` says what each one is and `operationFrom` converts on the way
   * out. Everything below this line is the Excel half, which is still a field
   * per kind — its operations address ranges and cells rather than taking a
   * list of scalars, so a generic bag would not have saved anything.
   */
  args: Record<string, string>;
  color: string;
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
  /** How the question names its text; see `@/editor/functions/selection`. */
  selector: SelectorName;
  selectorIndex: string;
  selectorParagraph: string;
  selectorText: string;
  selectorOccurrence: string;
  scopeFrom: string;
  scopeTo: string;
  /**
   * A multi-step question's steps, carried through untouched.
   *
   * The form does not offer these — they come from papers a migration loaded —
   * and dropping them on the way through would quietly turn "number the first,
   * second and fourth paragraphs" into a question about the first paragraph.
   */
  steps: unknown[] | null;
  /**
   * The formatting the passage *starts* with, which the form does offer.
   *
   * This is what makes "remove the highlight from the second paragraph" a
   * question rather than a no-op: the paragraph has to arrive highlighted. It
   * applies to the same text the question is about, which is what every such
   * question actually wants — a passage whose starting formatting sits
   * somewhere else is still authored through the API.
   */
  initialOperations: OperationDraft[];
  /**
   * A stored `initial` this form cannot represent — more than one entry, or one
   * addressing different text — kept verbatim so editing the instruction does
   * not silently rewrite it.
   */
  initialPassThrough: unknown[] | null;
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


function newId(): string {
  return crypto.randomUUID();
}

/** A Word function's parameters at their catalog defaults. */
function defaultArgsFor(kind: string): Record<string, string> {
  if (!isWordFunctionId(kind)) return {};
  const args: Record<string, string> = {};
  for (const param of WORD_FUNCTIONS[kind].params) args[param.name] = String(param.default);
  return args;
}

function blankOperation(kind: string): OperationDraft {
  return {
    id: newId(),
    kind,
    args: defaultArgsFor(kind),
    color: '#ffff00',
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
    selector: 'all',
    selectorIndex: '1',
    selectorParagraph: '1',
    selectorText: '',
    selectorOccurrence: '1',
    scopeFrom: '',
    scopeTo: '',
    steps: null,
    initialOperations: [],
    initialPassThrough: null,
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

  if (isWordFunctionId(kind)) {
    const args = { ...draft.args };
    for (const param of WORD_FUNCTIONS[kind].params) {
      const value = stored[param.name];
      if (value !== undefined && value !== null) args[param.name] = String(value);
    }
    return { ...draft, args };
  }

  return {
    ...draft,
    ...(typeof stored.color === 'string' ? { color: stored.color } : {}),
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

/**
 * A stored selection as the form's fields.
 *
 * The inverse of `parseScope` on the server. Every field is filled whatever the
 * selector, so switching between selectors in the picker keeps what was already
 * typed — the same reason the operation drafts hold every field at once.
 */
function selectionFields(scope: WordContentRow['scope']): Pick<
  EditorState,
  'selector' | 'selectorIndex' | 'selectorParagraph' | 'selectorText' | 'selectorOccurrence' | 'scopeFrom' | 'scopeTo'
> {
  const blank = {
    selector: 'all' as SelectorName,
    selectorIndex: '1',
    selectorParagraph: '1',
    selectorText: '',
    selectorOccurrence: '1',
    scopeFrom: '',
    scopeTo: '',
  };

  if (scope === 'all') return blank;

  // The legacy shape: a character range in the first paragraph.
  if (!('select' in scope)) {
    return { ...blank, scopeFrom: String(scope.from), scopeTo: String(scope.to) };
  }

  switch (scope.select) {
    case 'paragraph':
      return { ...blank, selector: 'paragraph', selectorIndex: String(scope.index) };
    case 'word':
    case 'sentence':
      return {
        ...blank,
        selector: scope.select,
        selectorIndex: String(scope.index),
        selectorParagraph: String(scope.paragraph ?? 1),
      };
    case 'words':
      return {
        ...blank,
        selector: 'words',
        scopeFrom: String(scope.from),
        scopeTo: String(scope.to),
        selectorParagraph: String(scope.paragraph ?? 1),
      };
    case 'text':
      return {
        ...blank,
        selector: 'text',
        selectorText: scope.text,
        selectorOccurrence: String(scope.occurrence ?? 1),
        selectorParagraph: String(scope.paragraph ?? 1),
      };
    case 'range':
      return {
        ...blank,
        selector: 'range',
        scopeFrom: String(scope.from),
        scopeTo: String(scope.to),
        selectorParagraph: String(scope.paragraph ?? 1),
      };
  }
}

/**
 * A stored `initial` as the form's rows, when the form can represent it.
 *
 * One entry addressing the question's own text is the shape every "remove the
 * formatting" question has, and the only one the rows below can edit. Anything
 * else is kept verbatim and shown as read-only, rather than being flattened
 * into something the author did not write.
 */
function startingFormattingFields(
  content: WordContentRow,
): Pick<EditorState, 'initialOperations' | 'initialPassThrough'> {
  const initial = content.initial ?? [];
  const only = initial.length === 1 ? initial[0] : undefined;

  if (!only || JSON.stringify(only.scope) !== JSON.stringify(content.scope)) {
    return { initialOperations: [], initialPassThrough: initial.length > 0 ? initial : null };
  }

  return {
    initialOperations: (only.operations as unknown as Record<string, unknown>[]).map(operationDraftFrom),
    initialPassThrough: null,
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
      ...selectionFields(content.scope),
      steps: content.steps ?? null,
      ...startingFormattingFields(content),
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

  /*
   * A Word operation is its parameters, converted to the types the catalog
   * declares. The server rebuilds it from the same declaration rather than
   * trusting this — see `wordOperationOf` — so what this has to get right is
   * the shape, not the safety.
   */
  if (isWordFunctionId(draft.kind)) {
    const operation: Record<string, unknown> = { kind: draft.kind };
    for (const param of WORD_FUNCTIONS[draft.kind].params) {
      const raw = draft.args[param.name] ?? '';
      if (param.type === 'number') operation[param.name] = numberOrUndefined(raw);
      else if (param.type === 'boolean') operation[param.name] = raw === 'true';
      else operation[param.name] = raw;
    }
    return operation;
  }

  switch (draft.kind) {
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

  if (isWordFunctionId(draft.kind)) {
    for (const param of WORD_FUNCTIONS[draft.kind].params) {
      const raw = (draft.args[param.name] ?? '').trim();

      if (param.type === 'number') {
        const value = numberOrUndefined(raw);
        if (value === undefined) return `Needs ${param.label.toLowerCase()}`;
        if (value < param.min || value > param.max) {
          return `${param.label} must be between ${param.min} and ${param.max}`;
        }
      }

      if (param.type === 'text' && raw === '') return `Needs ${param.label.toLowerCase()}`;
      // The underline's colour is the one optional parameter; the server
      // agrees, and reads an empty one as Word's Automatic.
      if (param.type === 'colour' && raw === '' && draft.kind !== 'underlineStyle') {
        return `Needs ${param.label.toLowerCase()}`;
      }
    }
    return null;
  }

  switch (draft.kind) {
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

/**
 * The starting formatting, as the API takes it.
 *
 * A single entry addressing the question's own text, which is the shape every
 * "remove the formatting" question has. A stored `initial` the form could not
 * represent is sent back exactly as it arrived.
 */
function startingFormattingPayload(values: EditorState): { initial?: unknown[] } {
  if (values.initialPassThrough) return { initial: values.initialPassThrough };
  if (values.initialOperations.length === 0) return {};

  const scope = selectionFromFields(values);
  if (!scope) return {};

  return { initial: [{ scope, operations: values.initialOperations.map(operationFrom) }] };
}

/* -- Vocabulary shown in the pickers --------------------------------------- */

/**
 * Every Word function the catalog declares, grouped by its ribbon group.
 *
 * Not a list kept here: a function added to `@/editor/functions/catalog` shows
 * up in this picker, with its own fields, validated on the way out, with no
 * edit to this file. That is what the catalog is for.
 */
const WORD_KIND_GROUPS = FUNCTION_CATEGORIES.map((category) => ({
  label: category.label,
  kinds: WORD_FUNCTION_LIST.filter((entry) => entry.category === category.value).map((entry) => ({
    value: entry.id,
    label: entry.label,
  })),
})).filter((group) => group.kinds.length > 0);

const WORD_KINDS: { value: string; label: string }[] = WORD_KIND_GROUPS.flatMap((group) => group.kinds);

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
            selector: values.selector,
            selectorIndex: values.selectorIndex,
            selectorParagraph: values.selectorParagraph,
            selectorText: values.selectorText,
            selectorOccurrence: values.selectorOccurrence,
            scopeFrom: values.scopeFrom,
            scopeTo: values.scopeTo,
            ...(values.steps ? { steps: values.steps } : {}),
            ...startingFormattingPayload(values),
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
  const initialProblems = new Map(
    values.initialOperations.map((operation) => [operation.id, operationProblem(operation)] as const),
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

            <SelectionFields
              id={id}
              values={values}
              lines={values.passageEn.split('\n')}
              onChange={handleChange}
            />
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

        {missing.noOperations && (
          <p className={`${styles.operationEmpty} ${styles.invalid}`}>
            Required — a question with no operation has no answer to show.
          </p>
        )}

        <OperationList
          operations={values.operations}
          kinds={kinds}
          problems={operationProblems}
          label="Operation"
          defaultKind={subject === 'word' ? 'bold' : 'style'}
          onChange={(next) => set('operations', next)}
        />
      </div>

      {subject === 'word' && (
        <div className={styles.group}>
          <p className={styles.groupTitle}>What the passage starts with</p>
          <p className={styles.hint}>
            Formatting the candidate finds already applied, to the same text the question is about. This is what
            makes &ldquo;remove the highlight&rdquo; a question rather than a no-op — and the marking follows: the
            passage below is what &ldquo;nothing else changed&rdquo; is measured against.
          </p>

          {values.initialPassThrough ? (
            <p className={styles.hint}>
              This question&rsquo;s starting formatting was written through the API and addresses text other than
              the question&rsquo;s own. It is kept as it is; editing it here would rewrite it.
            </p>
          ) : (
            <OperationList
              operations={values.initialOperations}
              kinds={kinds}
              problems={initialProblems}
              label="Starting format"
              defaultKind="highlight"
              onChange={(next) => set('initialOperations', next)}
            />
          )}
        </div>
      )}

      {subject === 'word' && (
        <QuestionPreviewPanel
          lines={values.passageEn.split('\n')}
          scope={selectionFromFields(values)}
          operations={values.operations}
          initial={values.initialOperations}
        />
      )}

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

/* -- Seeing the question ---------------------------------------------------- */

/**
 * The passage as the candidate opens it, and as it looks answered.
 *
 * An author writing "bold the third word" cannot tell from the form whether
 * they have written the third word or the third paragraph — the difference is
 * an index in a picker. These two panels are where that becomes visible, and
 * they are rendered by the same builders the exam and the marker use, so a
 * preview that looks right cannot be a question that sits wrong.
 */
function QuestionPreviewPanel({
  lines,
  scope,
  operations,
  initial,
}: {
  lines: string[];
  scope: SelectionSpec | null;
  operations: OperationDraft[];
  initial: OperationDraft[];
}) {
  const preview =
    scope === null
      ? null
      : questionPreview({
          lines,
          scope,
          operations: operations.map(operationFrom) as unknown as WordOperation[],
          initial: initial.map(operationFrom) as unknown as WordOperation[],
        });

  return (
    <div className={styles.group}>
      <p className={styles.groupTitle}>What the candidate will see</p>
      <p className={styles.hint}>
        The English passage, rendered by the editor itself. The left panel is what opens when the question is
        selected; the right is the worked answer shown after the paper closes — and what the answer key checks.
      </p>

      {preview === null ? (
        <p className={styles.hint}>
          Nothing to show yet — fill in the passage, and make sure the selection names text that is in it.
        </p>
      ) : (
        <div className={styles.grid2}>
          <div className={styles.field}>
            <span className={styles.label}>As the candidate finds it</span>
            <div className={styles.previewSheet}>
              <PassagePreview document={preview.start} />
            </div>
          </div>
          <div className={styles.field}>
            <span className={styles.label}>Answered correctly</span>
            <div className={styles.previewSheet}>
              <PassagePreview document={preview.answer} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* -- Operation lists ------------------------------------------------------- */

/**
 * A list of operations, added to and removed from.
 *
 * Shared by the two lists on this form — what the question asks for, and what
 * the passage starts with — because they are the same vocabulary pointed in
 * opposite directions: one applies formatting, the other is the formatting that
 * is already there for a question to ask about.
 */
function OperationList({
  operations,
  kinds,
  problems,
  label,
  defaultKind,
  onChange,
}: {
  operations: OperationDraft[];
  kinds: { value: string; label: string }[];
  problems: Map<string, string | null>;
  label: string;
  defaultKind: string;
  onChange: (next: OperationDraft[]) => void;
}) {
  const update = (id: string, changes: Partial<OperationDraft>): void =>
    onChange(operations.map((entry) => (entry.id === id ? { ...entry, ...changes } : entry)));

  return (
    <>
      <div className={styles.operations}>
        {operations.map((operation, index) => (
          <div
            className={problems.get(operation.id) ? `${styles.operation} ${styles.invalid}` : styles.operation}
            key={operation.id}
          >
            <div className={styles.operationHead}>
              <span className={styles.number}>{index + 1}</span>
              <select
                className={styles.operationKind}
                value={operation.kind}
                onChange={(event) => update(operation.id, { kind: event.target.value })}
                aria-label={`${label} ${index + 1}`}
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
                onClick={() => onChange(operations.filter((entry) => entry.id !== operation.id))}
                aria-label={`Remove ${label.toLowerCase()} ${index + 1}`}
              >
                Remove
              </button>
            </div>
            <OperationFields operation={operation} onChange={(changes) => update(operation.id, changes)} />
            {problems.get(operation.id) && <p className={styles.requiredNote}>{problems.get(operation.id)}</p>}
          </div>
        ))}
      </div>

      <button
        type="button"
        className={styles.addButton}
        onClick={() => onChange([...operations, blankOperation(defaultKind)])}
      >
        + Add {label.toLowerCase()}
      </button>
    </>
  );
}

/* -- Naming the text a question is about ----------------------------------- */

/**
 * The selection picker.
 *
 * Each selector asks for what it needs and nothing else, and the preview under
 * it shows the words the stored selection actually lands on — which is the
 * whole reason for naming a selection rather than typing offsets: the admin can
 * see they have named the right thing before the paper is sat.
 */
function SelectionFields({
  id,
  values,
  lines,
  onChange,
}: {
  id: (field: string) => string;
  values: EditorState;
  lines: string[];
  onChange: (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
}) {
  const scope = selectionFromFields(values);
  const resolved = scope ? resolveSelections(scope, lines) : [];
  const first = resolved[0];
  const preview = first ? (lines[first.block] ?? '').slice(first.from, first.to) : '';

  const number = (field: keyof EditorState, label: string, min: number) => (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id(field)}>
        {label}
      </label>
      <input
        id={id(field)}
        name={field}
        type="number"
        min={min}
        className={styles.input}
        value={String(values[field] ?? '')}
        onChange={onChange}
      />
    </div>
  );

  return (
    <>
      <div className={styles.grid2}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={id('selector')}>
            The question is about
          </label>
          <select
            id={id('selector')}
            name="selector"
            className={styles.input}
            value={values.selector}
            onChange={onChange}
          >
            {SELECTORS.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </select>
        </div>

        {values.selector === 'paragraph' ? number('selectorIndex', 'Paragraph number', 1) : null}
        {values.selector === 'word' || values.selector === 'sentence'
          ? number('selectorIndex', values.selector === 'word' ? 'Word number' : 'Sentence number', 1)
          : null}
        {values.selector === 'words' ? number('scopeFrom', 'From word', 1) : null}
        {values.selector === 'words' ? number('scopeTo', 'To word', 1) : null}
        {values.selector === 'range' || values.selector === 'all' ? number('scopeFrom', 'From character', 0) : null}
        {values.selector === 'range' || values.selector === 'all' ? number('scopeTo', 'To character', 1) : null}

        {values.selector === 'text' ? (
          <div className={styles.field}>
            <label className={styles.label} htmlFor={id('selectorText')}>
              The words themselves
            </label>
            <input
              id={id('selectorText')}
              name="selectorText"
              className={styles.input}
              value={values.selectorText}
              onChange={onChange}
            />
          </div>
        ) : null}

        {values.selector === 'text' ? (
          <div className={styles.field}>
            <label className={styles.label} htmlFor={id('selectorOccurrence')}>
              Which occurrence
            </label>
            <select
              id={id('selectorOccurrence')}
              name="selectorOccurrence"
              className={styles.input}
              value={values.selectorOccurrence}
              onChange={onChange}
            >
              <option value="all">Wherever it appears</option>
              {[1, 2, 3, 4, 5].map((entry) => (
                <option key={entry} value={String(entry)}>
                  Occurrence {entry}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {values.selector === 'word' ||
        values.selector === 'words' ||
        values.selector === 'sentence' ||
        values.selector === 'text' ||
        values.selector === 'range'
          ? number('selectorParagraph', 'In paragraph', 1)
          : null}
      </div>

      <p className={styles.hint}>
        {values.selector === 'all' && values.scopeFrom === '' && values.scopeTo === ''
          ? 'The whole first paragraph — what most questions are about. The character boxes are for a question that names one wrapped line, whose offsets are measured against the rendered page.'
          : resolved.length === 0
            ? 'This names nothing in the English passage — the question could not be marked as written.'
            : resolved.length === 1
              ? `Lands on “${preview}”.`
              : `Lands on ${resolved.length} places, the first being “${preview}”.`}
      </p>
    </>
  );
}

/** The form's selection fields as the selection they describe. */
function selectionFromFields(values: EditorState): SelectionSpec | null {
  const index = Number.parseInt(values.selectorIndex, 10);
  const paragraph = Number.parseInt(values.selectorParagraph, 10);
  const from = Number.parseInt(values.scopeFrom, 10);
  const to = Number.parseInt(values.scopeTo, 10);
  const inParagraph = Number.isFinite(paragraph) && paragraph > 1 ? { paragraph } : {};

  switch (values.selector) {
    case 'all':
      if (!Number.isFinite(from) || !Number.isFinite(to)) return 'all';
      return { from, to };
    case 'paragraph':
      return Number.isFinite(index) ? { select: 'paragraph', index } : null;
    case 'word':
      return Number.isFinite(index) ? { select: 'word', index, ...inParagraph } : null;
    case 'sentence':
      return Number.isFinite(index) ? { select: 'sentence', index, ...inParagraph } : null;
    case 'words':
      return Number.isFinite(from) && Number.isFinite(to) ? { select: 'words', from, to, ...inParagraph } : null;
    case 'range':
      return Number.isFinite(from) && Number.isFinite(to) ? { select: 'range', from, to, ...inParagraph } : null;
    case 'text': {
      if (values.selectorText.trim() === '') return null;
      const occurrence =
        values.selectorOccurrence === 'all' ? ('all' as const) : Number.parseInt(values.selectorOccurrence, 10);
      return {
        select: 'text',
        text: values.selectorText,
        ...(occurrence === 'all' || Number.isFinite(occurrence) ? { occurrence } : {}),
        ...inParagraph,
      };
    }
    default:
      return null;
  }
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

/**
 * One parameter of a Word function, as the control its type calls for.
 *
 * The admin form has no list of Word fields any more: the catalog says a
 * function takes a colour called "Underline colour" and a choice between eight
 * styles, and this renders exactly that. Adding a function to the catalog adds
 * its fields here.
 */
function ParamField({
  param,
  value,
  onChange,
}: {
  param: ParamSpec;
  value: string;
  onChange: (value: string) => void;
}) {
  switch (param.type) {
    case 'colour':
      return (
        <Field label={param.label}>
          <input
            type="color"
            className={styles.colorInput}
            value={value || param.default}
            onChange={(event) => onChange(event.target.value)}
          />
        </Field>
      );

    case 'number':
      return (
        <Field label={param.unit ? `${param.label} (${param.unit})` : param.label}>
          <input
            type="number"
            className={styles.input}
            min={param.min}
            max={param.max}
            step={param.step ?? 1}
            value={value}
            onChange={(event) => onChange(event.target.value)}
          />
        </Field>
      );

    case 'enum':
      return (
        <Field label={param.label}>
          <select className={styles.input} value={value} onChange={(event) => onChange(event.target.value)}>
            {param.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
      );

    case 'text':
      return (
        <Field label={param.label}>
          <input
            className={styles.input}
            maxLength={param.maxLength}
            list={param.suggestions ? `suggestions-${param.name}` : undefined}
            value={value}
            onChange={(event) => onChange(event.target.value)}
          />
          {param.suggestions ? (
            <datalist id={`suggestions-${param.name}`}>
              {param.suggestions.map((entry) => (
                <option key={entry} value={entry} />
              ))}
            </datalist>
          ) : null}
        </Field>
      );

    case 'boolean':
      return (
        <Field label={param.label}>
          <input
            type="checkbox"
            checked={value === 'true'}
            onChange={(event) => onChange(String(event.target.checked))}
          />
        </Field>
      );
  }
}

function OperationFields({
  operation,
  onChange,
}: {
  operation: OperationDraft;
  onChange: (changes: Partial<OperationDraft>) => void;
}) {
  // Word functions render themselves from the catalog; the Excel half below
  // still names its fields, because its operations address cells rather than
  // taking a list of scalars.
  if (isWordFunctionId(operation.kind)) {
    const spec = WORD_FUNCTIONS[operation.kind];
    if (spec.params.length === 0) return null;

    return (
      <div className={styles.grid2}>
        {spec.params.map((param) => (
          <ParamField
            key={param.name}
            param={param}
            value={operation.args[param.name] ?? ''}
            onChange={(value) => onChange({ args: { ...operation.args, [param.name]: value } })}
          />
        ))}
      </div>
    );
  }

  switch (operation.kind) {
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
