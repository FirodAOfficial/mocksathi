import type { ParagraphFormatting } from '@/services/document/types';
import type { BlockSelector, Criterion, CriterionResult, Target, TextExpectation } from './criteria';
import { applyCase } from '@/utils/letterCase';
import { hasMark, isPlain, marksEqual, normaliseText, type FlatDocument } from './flatten';

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
        (block) => !valuesEqual(block.paragraph[criterion.attr as keyof ParagraphFormatting], criterion.value),
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
      let seen = 0;

      for (const block of doc.blocks) {
        let at = block.text.indexOf(target.text);
        while (at !== -1) {
          seen += 1;
          if (seen === wanted) {
            return indicesBetween(block.start + at, block.start + at + target.text.length);
          }
          at = block.text.indexOf(target.text, at + 1);
        }
      }
      return null;
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
 * Nothing changed outside the named targets.
 *
 * Compares character text and formatting only — block-level properties are left
 * alone, because a question that legitimately changes alignment or spacing
 * asserts that with `blockAttr` instead. Since this is used on formatting
 * questions, where the wording is not meant to change at all, any text
 * difference fails outright.
 */
function checkUnchanged(
  except: Target[],
  submitted: FlatDocument,
  start: FlatDocument,
  fail: (detail: string) => CriterionResult,
  pass: () => CriterionResult,
): CriterionResult {
  if (submitted.chars.length !== start.chars.length) {
    return fail('The wording of the passage was changed.');
  }

  const exempt = new Set<number>();
  for (const target of except) {
    for (const index of resolveTarget(target, submitted) ?? []) exempt.add(index);
  }

  // Word selects the trailing space with a double-click, so a space touching an
  // exempt span is forgiven. Formatting one extra space is not a wrong answer.
  for (const index of [...exempt]) {
    for (const neighbour of [index - 1, index + 1]) {
      const char = submitted.chars[neighbour];
      if (char && /\s/.test(char.char)) exempt.add(neighbour);
    }
  }

  for (let index = 0; index < submitted.chars.length; index += 1) {
    if (exempt.has(index)) continue;
    const after = submitted.chars[index]!;
    const before = start.chars[index]!;

    if (after.char !== before.char) return fail('The wording of the passage was changed.');
    if (!marksEqual(after.marks, before.marks)) {
      return fail('Formatting was applied to text that should have been left alone.');
    }
  }

  return pass();
}
