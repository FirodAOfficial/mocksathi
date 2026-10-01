import type { FlatBlock, FlatDocument } from '@/exam/marking/flatten';
import { EMPTY_PARAGRAPH_FORMATTING, type ParagraphFormatting } from '@/services/document/types';
import type {
  CharacterChange,
  CharacterProperty,
  CharacterStep,
  CharacterValue,
  DocumentStep,
  ParagraphChange,
  ParagraphProperty,
  ParagraphStep,
} from './types';

/**
 * Reading what someone did to a document from a before and an after.
 *
 * This is the "identify the operation" half of the single-document flow. The
 * admin performs a question's operation in the editor instead of describing it
 * in a form, and this works out what that operation was: which characters
 * gained or lost which formatting, and which paragraphs changed which
 * properties. The result is stored as the question.
 *
 * It runs on the marking projection (`flatten.ts`) rather than on editor JSON,
 * for the reason that projection exists: the same visible result has many
 * ProseMirror spellings — text nodes split anywhere, marks in any order, a
 * `textStyle` holding only nulls — and none of that is a change. Comparing the
 * canonical form means a question is detected as exactly what it looks like.
 *
 * Pure and dependency-free, so the authoring screen can show the admin what is
 * being detected as they work, and the server can detect it again — from the
 * document it is sent, never from the client's reading of it — before storing.
 */

/** Every character property the projection carries. */
export const CHARACTER_PROPERTIES: readonly CharacterProperty[] = [
  'bold',
  'italic',
  'underline',
  'underlineStyle',
  'underlineColor',
  'strike',
  'doubleStrike',
  'caps',
  'hidden',
  'vertAlign',
  'fontFamily',
  'fontSize',
  'color',
  'highlight',
  'effect',
  'charScale',
  'charSpacing',
];

/** Every paragraph property, read off the empty formatting so a new one cannot be missed. */
export const PARAGRAPH_ATTRIBUTES = Object.keys(EMPTY_PARAGRAPH_FORMATTING) as (keyof ParagraphFormatting)[];

export interface Detection {
  steps: DocumentStep[];
  /**
   * Why this cannot be stored as a question, in the admin's terms.
   *
   * Non-empty means refuse: a question whose wording changed would move every
   * later question's character offsets, which is the one thing this whole flow
   * depends on not happening.
   */
  problems: string[];
}

/** Equality for property values: primitives directly, objects (`borders`) structurally. */
export function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

function charValue(document: FlatDocument, index: number, property: CharacterProperty): CharacterValue {
  const value = document.chars[index]?.marks[property];
  return value === undefined ? null : (value as CharacterValue);
}

function isSpace(char: string | undefined): boolean {
  return char !== undefined && /\s/.test(char);
}

/*
 * Offsets count characters as `flatten` does — code points, not UTF-16 units —
 * so text is read through `chars` rather than by slicing `block.text`, which
 * would drift on the first character outside the Basic Multilingual Plane.
 */
function charAt(document: FlatDocument, block: FlatBlock, offset: number): string | undefined {
  return document.chars[block.start + offset]?.char;
}

function textBetween(document: FlatDocument, block: FlatBlock, from: number, to: number): string {
  return document.chars
    .slice(block.start + from, block.start + to)
    .map((entry) => entry.char)
    .join('');
}

/** Why the two documents cannot be compared character by character, if they cannot. */
function structuralProblems(before: FlatDocument, after: FlatDocument): string[] {
  if (before.blocks.length !== after.blocks.length) {
    return [
      'Paragraphs were added, removed or split. Questions in this paper may only change formatting — the passage itself is fixed once questions exist.',
    ];
  }

  for (let index = 0; index < before.blocks.length; index += 1) {
    const was = before.blocks[index]!;
    const now = after.blocks[index]!;
    if (was.text !== now.text) {
      return [
        `The wording of paragraph ${index + 1} changed. Questions in this paper may only change formatting — undo the typing and apply the formatting instead.`,
      ];
    }
    if (!sameValue(was.table, now.table)) {
      return ['The table layout changed. Questions in this paper may only change formatting.'];
    }
  }

  return [];
}

interface CharacterRun {
  block: number;
  change: CharacterChange;
}

/** Runs of consecutive characters in one block that took the same new value of one property. */
function characterRuns(before: FlatDocument, after: FlatDocument, block: FlatBlock): CharacterRun[] {
  const runs: CharacterRun[] = [];
  const length = block.end - block.start;

  for (const property of CHARACTER_PROPERTIES) {
    let offset = 0;
    while (offset < length) {
      const index = block.start + offset;
      const was = charValue(before, index, property);
      const now = charValue(after, index, property);
      if (sameValue(was, now)) {
        offset += 1;
        continue;
      }

      // Extend while the next character changed to the same value.
      let end = offset + 1;
      while (end < length) {
        const at = block.start + end;
        const nextWas = charValue(before, at, property);
        const nextNow = charValue(after, at, property);
        if (sameValue(nextWas, nextNow) || !sameValue(nextNow, now)) break;
        end += 1;
      }

      runs.push({
        block: block.index,
        change: {
          property,
          value: now,
          previous: was,
          range: { from: offset, to: end },
          licence: licenceFor(after, block, property, now, offset, end),
        },
      });
      offset = end;
    }
  }

  return runs;
}

/**
 * How far a change may reach without counting as "something else changed".
 *
 * A value being *set* runs on through neighbours that already carry it — see
 * `CharacterChange.licence`. A value being *taken off* does not: "remove the
 * highlight from the third word" must not license highlighting the rest of the
 * paragraph, which a plain neighbour would otherwise extend it over.
 */
function licenceFor(
  after: FlatDocument,
  block: FlatBlock,
  property: CharacterProperty,
  value: CharacterValue,
  from: number,
  to: number,
): { from: number; to: number } {
  if (value === null || value === false) return { from, to };

  const length = block.end - block.start;
  let start = from;
  let end = to;
  while (start > 0 && sameValue(charValue(after, block.start + start - 1, property), value)) start -= 1;
  while (end < length && sameValue(charValue(after, block.start + end, property), value)) end += 1;
  return { from: start, to: end };
}

/**
 * The runs, grouped into steps by the text they cover.
 *
 * Bold and italic applied to the same words is one step with two changes —
 * one selection, two buttons — which is how the admin would describe it and
 * how the candidate is told about it.
 */
function characterSteps(before: FlatDocument, after: FlatDocument): CharacterStep[] {
  const steps = new Map<string, CharacterStep>();

  for (const block of after.blocks) {
    for (const run of characterRuns(before, after, block)) {
      // Trimmed for the criterion: a candidate who selects the word without
      // its trailing space has done what was asked.
      const raw = run.change.range;
      let from = raw.from;
      let to = raw.to;
      while (from < to && isSpace(charAt(after, block, from))) from += 1;
      while (to > from && isSpace(charAt(after, block, to - 1))) to -= 1;

      const licenceOnly = from >= to;
      const range = licenceOnly ? raw : { from, to };
      const key = `${run.block}:${range.from}:${range.to}:${licenceOnly ? 'l' : ''}`;

      const existing = steps.get(key);
      if (existing) {
        existing.changes.push(run.change);
        continue;
      }

      steps.set(key, {
        level: 'character',
        block: run.block,
        from: range.from,
        to: range.to,
        text: textBetween(after, block, range.from, range.to),
        changes: [run.change],
        ...(licenceOnly ? { licenceOnly: true } : {}),
      });
    }
  }

  return [...steps.values()].sort((a, b) => a.block - b.block || a.from - b.from);
}

function paragraphValue(block: FlatBlock, property: ParagraphProperty): unknown {
  if (property === 'styleId') return block.styleId;
  if (property === 'list') return block.list?.kind ?? null;
  return block.paragraph[property] ?? null;
}

const PARAGRAPH_PROPERTIES: readonly ParagraphProperty[] = [...PARAGRAPH_ATTRIBUTES, 'styleId', 'list'];

function paragraphSteps(before: FlatDocument, after: FlatDocument, problems: string[]): ParagraphStep[] {
  const steps = new Map<string, ParagraphStep>();

  for (const block of after.blocks) {
    const was = before.blocks[block.index]!;
    const changes: ParagraphChange[] = [];

    for (const property of PARAGRAPH_PROPERTIES) {
      const previous = paragraphValue(was, property);
      const value = paragraphValue(block, property);
      if (!sameValue(previous, value)) changes.push({ property, value, previous });
    }

    // A list item moved in or out a level, without changing what kind of list
    // it is. The marker only ever asks what kind of list a paragraph is in, so
    // a question built on this would ask for nothing it could check.
    if (was.list && block.list && was.list.kind === block.list.kind && was.list.level !== block.list.level) {
      problems.push(
        `Paragraph ${block.index + 1} changed list level. Changing a list's level cannot be marked yet — undo it and record a different operation.`,
      );
    }

    if (changes.length === 0) continue;

    const licenceOnly = block.text.trim() === '';
    // Paragraphs that received the same changes are one step: "centre the
    // second to fourth paragraphs" is one instruction, not three.
    const key = `${licenceOnly ? 'l' : ''}${JSON.stringify(changes.map((change) => [change.property, change.value]))}`;
    const existing = steps.get(key);
    if (existing) existing.blocks.push(block.index);
    else steps.set(key, { level: 'paragraph', blocks: [block.index], changes, ...(licenceOnly ? { licenceOnly: true } : {}) });
  }

  return [...steps.values()];
}

/** What changed between two projections of the same passage. */
export function detectChanges(before: FlatDocument, after: FlatDocument): Detection {
  const problems = structuralProblems(before, after);
  if (problems.length > 0) return { steps: [], problems };

  const paragraph = paragraphSteps(before, after, problems);
  return { steps: [...characterSteps(before, after), ...paragraph], problems };
}

/** True when at least one change is something a candidate could see, and so be asked for. */
export function hasVisibleChange(steps: readonly DocumentStep[]): boolean {
  return steps.some((step) => !step.licenceOnly);
}
