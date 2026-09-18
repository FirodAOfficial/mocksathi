import { resolveSelections } from '@/editor/functions/selection';
import { LENGTH_TOLERANCE_PX } from '@/utils/units';
import type { ParagraphFormatting, RunFormatting } from '@/services/document/types';
import type {
  BlockSelector,
  Criterion,
  CriterionResult,
  Exemption,
  Target,
  TextExpectation,
} from './criteria';
import { applyCase } from '@/utils/letterCase';
import {
  hasMark,
  isPlain,
  markProperty,
  marksEqualExcept,
  normaliseText,
  type FlatDocument,
} from './flatten';

/**
 * Evaluates one criterion against a submitted document.
 *
 * Every check runs on the canonical projection from `flatten`, so none of them
 * has to reason about how the editor happened to represent the result.
 */
export function evaluateCriterion(
  criterion: Criterion,
  submitted: FlatDocument,
  start: FlatDocument,
): CriterionResult {
  const pass = (): CriterionResult => ({ label: criterion.label, passed: true });
  const fail = (detail: string): CriterionResult => ({ label: criterion.label, passed: false, detail });

  switch (criterion.kind) {
    case 'marked': {
      const indices = resolveTarget(criterion.target, submitted);
      if (indices === null) return fail(`Could not find ${describeTarget(criterion.target)}.`);
      if (indices.length === 0) return fail(`${describeTarget(criterion.target)} is empty.`);

      const missing = indices.filter(
        (index) => !hasMark(submitted.chars[index]!.marks, criterion.mark, criterion.value),
      );

      // "Any colour except yellow": the formatting has to be there, and it has
      // to be something other than what the question ruled out.
      if (missing.length === 0 && criterion.not) {
        const excluded = indices.filter((index) =>
          hasMark(submitted.chars[index]!.marks, criterion.mark, criterion.not),
        );
        if (excluded.length > 0) {
          return fail(`${describeTarget(criterion.target)} uses a value the question ruled out.`);
        }
      }

      if (missing.length === 0) return pass();

      return fail(
        missing.length === indices.length
          ? `${criterion.mark} was not applied to ${describeTarget(criterion.target)}.`
          : `${criterion.mark} covers only part of ${describeTarget(criterion.target)}.`,
      );
    }

    case 'notMarked': {
      const indices = resolveTarget(criterion.target, submitted);
      if (indices === null) return pass(); // nothing there to be wrongly marked
      const offenders = indices.filter((index) => hasMark(submitted.chars[index]!.marks, criterion.mark));
      return offenders.length === 0
        ? pass()
        : fail(`${criterion.mark} should not be applied to ${describeTarget(criterion.target)}.`);
    }

    case 'plain': {
      const indices = resolveTarget(criterion.target, submitted);
      if (indices === null) return fail(`Could not find ${describeTarget(criterion.target)}.`);
      const formatted = indices.filter((index) => !isPlain(submitted.chars[index]!.marks));
      return formatted.length === 0
        ? pass()
        : fail(`Formatting is still applied to ${describeTarget(criterion.target)}.`);
    }

    case 'columnsMatch': {
      const table = criterion.table ?? 0;
      const rows = [
        ...new Set(
          submitted.blocks.filter((block) => block.table?.table === table).map((block) => block.table!.row),
        ),
      ].sort((a, b) => a - b);
      if (rows.length === 0) return fail('The table is missing.');

      const body = rows.slice(criterion.skipHeader === false ? 0 : 1);
      const cellText = (row: number, column: number): string =>
        normaliseText(
          cellBlocks(submitted, table, row, column)
            .map((block) => block.text)
            .join(' '),
        );

      const wrong = body.filter((row) => cellText(row, criterion.to) !== cellText(row, criterion.from));
      return wrong.length === 0
        ? pass()
        : fail(`${wrong.length} row(s) in column ${criterion.to + 1} do not match column ${criterion.from + 1}.`);
    }

    case 'blockAttr': {
      const blocks = selectBlocks(criterion.block, submitted);
      if (blocks.length === 0) return fail('The expected paragraph is missing.');

      const wrong = blocks.filter(
        (block) =>
          !attrEqual(criterion.attr, block.paragraph[criterion.attr as keyof ParagraphFormatting], criterion.value),
      );
      return wrong.length === 0 ? pass() : fail(`${criterion.attr} is not set as required.`);
    }

    case 'blockStyle': {
      const blocks = selectBlocks(criterion.block, submitted);
      if (blocks.length === 0) return fail('The expected paragraph is missing.');
      const wrong = blocks.filter((block) => block.styleId !== criterion.styleId);
      return wrong.length === 0 ? pass() : fail(`The ${criterion.styleId} style was not applied.`);
    }

    case 'listKind': {
      const blocks = selectBlocks(criterion.block, submitted);
      if (blocks.length === 0) return fail('The expected paragraph is missing.');
      const wrong = blocks.filter((block) => (block.list?.kind ?? null) !== criterion.listKind);
      return wrong.length === 0
        ? pass()
        : fail(
            criterion.listKind === null
              ? 'This should not be a list.'
              : `A ${criterion.listKind} list was not applied.`,
          );
    }

    case 'cellText': {
      const cells = cellBlocks(submitted, criterion.table ?? 0, criterion.row, criterion.column);
      if (cells.length === 0) {
        return fail(`There is no cell at row ${criterion.row + 1}, column ${criterion.column + 1}.`);
      }
      const startCells = cellBlocks(start, criterion.table ?? 0, criterion.row, criterion.column);
      return checkText(
        cells.map((block) => block.text).join('\n'),
        criterion.expect,
        fail,
        pass,
        startCells.map((block) => block.text).join('\n'),
      );
    }

    case 'columnAutoNumbered': {
      const table = criterion.table ?? 0;
      const rows = new Set(
        submitted.blocks
          .filter((block) => block.table?.table === table)
          .map((block) => block.table!.row),
      );
      if (rows.size === 0) return fail('The table is missing.');

      const target = [...rows].sort((a, b) => a - b).slice(criterion.skipHeader === false ? 0 : 1);
      const unnumbered = target.filter((row) =>
        cellBlocks(submitted, table, row, criterion.column).every(
          (block) => block.list?.kind !== 'ordered',
        ),
      );

      return unnumbered.length === 0
        ? pass()
        : fail(`${unnumbered.length} row(s) in the column are not numbered.`);
    }

    case 'text': {
      const scope = (doc: FlatDocument): string =>
        criterion.block === undefined ? doc.text : (doc.blocks[criterion.block]?.text ?? '');
      return checkText(scope(submitted), criterion.expect, fail, pass, scope(start));
    }

    case 'unchanged':
      return checkUnchanged(criterion.except, submitted, start, fail, pass);

    default:
      return fail('Unknown criterion.');
  }
}

/* ---------------------------------------------------------------------- */

/** Character indices a target covers, or null when it cannot be located. */
export function resolveTarget(target: Target, doc: FlatDocument): number[] | null {
  switch (target.by) {
    case 'document':
      return doc.chars.map((_, index) => index);

    case 'block': {
      const block = doc.blocks[target.block];
      if (!block) return null;
      return indicesBetween(block.start, block.end);
    }

    case 'selection': {
      // Resolved here, against the document as submitted: a selection names its
      // text ("the fourth paragraph") and the characters that is are whatever
      // the passage says in the language the paper was sat in.
      const resolved = resolveSelections(
        target.selection,
        doc.blocks.map((entry) => entry.text),
      );

      const indices: number[] = [];
      for (const range of resolved) {
        const block = doc.blocks[range.block];
        if (!block) continue;
        const from = block.start + range.from;
        const to = block.start + range.to;
        if (to <= from || to > block.end) continue;
        indices.push(...indicesBetween(from, to));
      }

      return indices.length > 0 ? indices : null;
    }

    case 'range': {
      const block = doc.blocks[target.block];
      if (!block) return null;
      const from = block.start + target.from;
      const to = block.start + target.to;
      if (from < block.start || to > block.end || from >= to) return null;
      return indicesBetween(from, to);
    }

    case 'text': {
      // Searched per block, so a match can never straddle a paragraph break.
      const wanted = target.occurrence ?? 1;
      const everywhere = wanted === 'all';
      const indices: number[] = [];
      let seen = 0;

      for (const block of doc.blocks) {
        let at = block.text.indexOf(target.text);
        while (at !== -1) {
          seen += 1;
          const span = indicesBetween(block.start + at, block.start + at + target.text.length);
          if (everywhere) indices.push(...span);
          else if (seen === wanted) return span;
          at = block.text.indexOf(target.text, at + 1);
        }
      }
      return everywhere && indices.length > 0 ? indices : null;
    }

    default:
      return null;
  }
}

/** Every paragraph inside one table cell. */
function cellBlocks(doc: FlatDocument, table: number, row: number, column: number) {
  return doc.blocks.filter(
    (block) =>
      block.table !== null &&
      block.table.table === table &&
      block.table.row === row &&
      block.table.column === column,
  );
}

function indicesBetween(from: number, to: number): number[] {
  const indices: number[] = [];
  for (let index = from; index < to; index += 1) indices.push(index);
  return indices;
}

function selectBlocks(selector: BlockSelector, doc: FlatDocument) {
  if (selector === 'all') return doc.blocks;
  const block = doc.blocks[selector];
  return block ? [block] : [];
}

/**
 * Paragraph lengths, in CSS pixels, where a pixel of rounding is not an answer.
 *
 * An indent asked for in inches and typed in centimetres lands a pixel away,
 * and the two are the same indent to anyone looking at the page. Everything
 * else — a line-spacing multiplier, an alignment, a border — is compared
 * exactly, because there is no rounding to forgive.
 */
const PIXEL_LENGTHS = new Set<keyof ParagraphFormatting>([
  'indentLeft',
  'indentRight',
  'indentFirstLine',
  'spaceBefore',
  'spaceAfter',
  'lineSpacingPt',
]);

function attrEqual(attr: keyof ParagraphFormatting, actual: unknown, expected: unknown): boolean {
  if (PIXEL_LENGTHS.has(attr) && typeof actual === 'number' && typeof expected === 'number') {
    return Math.abs(actual - expected) <= LENGTH_TOLERANCE_PX;
  }
  return valuesEqual(actual, expected);
}

function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  // `borders` is an object; everything else is a primitive or null.
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

function describeTarget(target: Target): string {
  switch (target.by) {
    case 'text':
      return `“${target.text}”`;
    case 'block':
      return `paragraph ${target.block + 1}`;
    case 'range':
      return `the required text in paragraph ${target.block + 1}`;
    case 'cell':
      return `the cell at row ${target.row + 1}, column ${target.column + 1}`;
    case 'document':
      return 'the document';
    default:
      return 'the target';
  }
}

function checkText(
  actual: string,
  expect: TextExpectation,
  fail: (detail: string) => CriterionResult,
  pass: () => CriterionResult,
  startText = '',
): CriterionResult {
  const normalised = normaliseText(actual);

  if (expect.matchesStart) {
    // Derived from the passage, so the same rubric marks every language it is
    // offered in without naming the expected words.
    const wanted =
      expect.matchesStart === 'same' ? startText : applyCase(startText, expect.matchesStart);
    if (normalised !== normaliseText(wanted)) {
      return fail('The text does not match what was asked for.');
    }
  }

  if (expect.equals !== undefined && normalised !== normaliseText(expect.equals)) {
    return fail('The wording does not match what was asked for.');
  }
  if (expect.contains !== undefined && !normalised.includes(normaliseText(expect.contains))) {
    return fail(`“${expect.contains}” is missing.`);
  }
  if (expect.notContains !== undefined && normalised.includes(normaliseText(expect.notContains))) {
    return fail(`“${expect.notContains}” is still present.`);
  }
  if (expect.occurrences) {
    const needle = normaliseText(expect.occurrences.of);
    const count = needle === '' ? 0 : normalised.split(needle).length - 1;
    if (count !== expect.occurrences.count) {
      return fail(`Expected “${expect.occurrences.of}” ${expect.occurrences.count} time(s), found ${count}.`);
    }
  }
  return pass();
}

/**
 * Nothing changed that the question did not ask for.
 *
 * Every difference between the starting document and the submitted one is a
 * change the candidate made. The exemptions say which of those were asked for;
 * anything else — a second mark alongside the right one, an alignment nobody
 * requested, a heading style — is a change too many, and fails.
 *
 * The wording is compared outright: these are formatting questions, so the text
 * is never meant to move.
 */
function checkUnchanged(
  except: Exemption[],
  submitted: FlatDocument,
  start: FlatDocument,
  fail: (detail: string) => CriterionResult,
  pass: () => CriterionResult,
): CriterionResult {
  if (submitted.chars.length !== start.chars.length || submitted.blocks.length !== start.blocks.length) {
    return fail('The wording of the passage was changed.');
  }

  /** Character index -> the formatting properties it was allowed to gain. */
  const allowedMarks = new Map<number, Set<keyof RunFormatting>>();
  /** Block index -> the paragraph properties it was allowed to gain. */
  const allowedParagraph = new Map<number, Set<keyof ParagraphFormatting>>();
  /** Blocks the question asked to restyle, or to make into a list. */
  const allowedStyle = new Set<number>();
  const allowedList = new Set<number>();

  const allowAt = (index: number, marks: (keyof RunFormatting)[]): void => {
    const existing = allowedMarks.get(index) ?? new Set<keyof RunFormatting>();
    for (const mark of marks) existing.add(mark);
    allowedMarks.set(index, existing);
  };

  for (const exemption of except) {
    const indices = resolveTarget(exemption.target, submitted) ?? [];
    const marks = (exemption.marks ?? []).map(markProperty);

    for (const index of indices) {
      allowAt(index, marks);
      // Word selects the trailing space with a double-click, so a space next to
      // an exempt span is forgiven — formatting one extra space is not a wrong
      // answer, and it gets exactly the same allowance, not a blanket pass.
      for (const neighbour of [index - 1, index + 1]) {
        const char = submitted.chars[neighbour];
        if (char && /\s/.test(char.char)) allowAt(neighbour, marks);
      }
    }

    for (const block of new Set(indices.map((index) => submitted.chars[index]!.block))) {
      const existing = allowedParagraph.get(block) ?? new Set<keyof ParagraphFormatting>();
      for (const attr of exemption.paragraph ?? []) existing.add(attr);
      allowedParagraph.set(block, existing);
      if (exemption.style) allowedStyle.add(block);
      if (exemption.list) allowedList.add(block);
    }
  }

  const none = new Set<never>();

  for (let index = 0; index < submitted.chars.length; index += 1) {
    const after = submitted.chars[index]!;
    const before = start.chars[index]!;

    if (after.char !== before.char) return fail('The wording of the passage was changed.');
    if (!marksEqualExcept(after.marks, before.marks, allowedMarks.get(index) ?? none)) {
      return fail('Formatting was applied that the question did not ask for.');
    }
  }

  for (let index = 0; index < submitted.blocks.length; index += 1) {
    const after = submitted.blocks[index]!;
    const before = start.blocks[index]!;
    const allowed = allowedParagraph.get(index) ?? none;

    if (after.styleId !== before.styleId && !allowedStyle.has(index)) {
      return fail('A paragraph style was applied that was not asked for.');
    }
    if ((after.list?.kind ?? null) !== (before.list?.kind ?? null) && !allowedList.has(index)) {
      return fail('A list was applied that was not asked for.');
    }

    for (const attr of Object.keys(after.paragraph) as (keyof ParagraphFormatting)[]) {
      if (allowed.has(attr)) continue;
      if (!valuesEqual(after.paragraph[attr], before.paragraph[attr])) {
        return fail('Paragraph formatting was applied that the question did not ask for.');
      }
    }
  }

  return pass();
}
