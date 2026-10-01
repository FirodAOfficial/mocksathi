import type { JSONContent } from '@tiptap/core';
import { documentToProseMirror } from '@/editor/documentToProseMirror';
import { proseMirrorToDocument } from '@/editor/proseMirrorToDocument';
import { isUnderlineStyle } from '@/editor/functions/underline';
import { flatten, type FlatDocument } from '@/exam/marking/flatten';
import {
  paragraphsOf,
  type DocumentMetadata,
  type DocumentModel,
  type NormalizedStyleId,
  type ParagraphBlock,
  type ParagraphFormatting,
  type RunFormatting,
  type TextRun,
} from '@/services/document/types';
import { detectChanges } from './detect';
import type { CharacterChange, DocumentStep, ParagraphChange } from './types';

/**
 * Putting a question's changes back onto a document.
 *
 * The inverse of `detect.ts`, and the reason a single-document paper stores no
 * snapshots. The document the admin records question 8 on is the passage with
 * questions 1–7 replayed onto it; the worked answer a candidate is shown for
 * question 8 is the passage with question 8 alone replayed. Both are derived,
 * so deleting question 3 cannot leave its bold baked into a stored copy of the
 * document that question 4 was recorded on.
 *
 * Replay goes through the normalised model rather than editing ProseMirror
 * JSON, because that model is what the marker reads: a change is put back in
 * the same vocabulary it was read out in. `faithful` is the guard on the whole
 * idea — a question is only stored if replaying it reproduces exactly what the
 * admin's editor produced.
 */

const NO_METADATA: DocumentMetadata = { title: '', format: 'blank', sourceUrl: null, unsupportedFeatures: [] };

/** A document as the marker sees it. */
export function project(document: JSONContent): FlatDocument {
  return flatten(proseMirrorToDocument(document, NO_METADATA));
}

/** True when two documents are the same to the marker: same text, same formatting everywhere. */
export function sameProjection(a: FlatDocument, b: FlatDocument): boolean {
  const detection = detectChanges(a, b);
  return detection.problems.length === 0 && detection.steps.length === 0;
}

/* -- Sanitising ------------------------------------------------------------ */

const HEX = /^#[0-9a-f]{6}$/i;
const ALIGNMENTS = new Set(['left', 'center', 'right', 'justify']);
const SPACING_MODES = new Set(['multiple', 'atLeast', 'exactly']);

function finiteIn(value: unknown, min: number, max: number): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? value : null;
}

function colour(value: unknown): string | undefined {
  return typeof value === 'string' && HEX.test(value) ? value.toLowerCase() : undefined;
}

/**
 * Run formatting with every value checked.
 *
 * The passage is sent by the admin's browser and then installed into every
 * candidate's editor, so it is rebuilt from known-good values rather than
 * stored as received — the same instinct as `parseOperations`.
 */
function cleanMarks(marks: RunFormatting): RunFormatting {
  const clean: RunFormatting = {};
  if (marks.bold) clean.bold = true;
  if (marks.italic) clean.italic = true;
  if (marks.underline) clean.underline = true;
  if (isUnderlineStyle(marks.underlineStyle)) clean.underlineStyle = marks.underlineStyle;
  const underlineColor = colour(marks.underlineColor);
  if (underlineColor) clean.underlineColor = underlineColor;
  if (marks.strike) clean.strike = true;
  if (marks.doubleStrike) clean.doubleStrike = true;
  if (marks.caps === 'small' || marks.caps === 'all') clean.caps = marks.caps;
  if (marks.hidden) clean.hidden = true;
  if (marks.vertAlign === 'sub' || marks.vertAlign === 'super') clean.vertAlign = marks.vertAlign;
  if (typeof marks.fontFamily === 'string' && marks.fontFamily.trim() !== '' && marks.fontFamily.length <= 100) {
    clean.fontFamily = marks.fontFamily.trim();
  }
  const fontSize = finiteIn(marks.fontSize, 1, 1638);
  if (fontSize !== null) clean.fontSize = fontSize;
  const color = colour(marks.color);
  if (color) clean.color = color;
  const highlight = colour(marks.highlight);
  if (highlight) clean.highlight = highlight;
  if (marks.effect === 'emboss' || marks.effect === 'engrave') clean.effect = marks.effect;
  const charScale = finiteIn(marks.charScale, 1, 600);
  if (charScale !== null) clean.charScale = charScale;
  const charSpacing = finiteIn(marks.charSpacing, -100, 100);
  if (charSpacing !== null) clean.charSpacing = charSpacing;
  return clean;
}

function cleanParagraph(paragraph: ParagraphFormatting): ParagraphFormatting {
  const length = (value: unknown) => finiteIn(value, -5000, 5000);
  const borders = paragraph.borders;

  return {
    align: typeof paragraph.align === 'string' && ALIGNMENTS.has(paragraph.align) ? paragraph.align : null,
    indentLeft: length(paragraph.indentLeft),
    indentRight: length(paragraph.indentRight),
    indentFirstLine: length(paragraph.indentFirstLine),
    lineHeight: finiteIn(paragraph.lineHeight, 0.1, 20),
    lineSpacingMode:
      typeof paragraph.lineSpacingMode === 'string' && SPACING_MODES.has(paragraph.lineSpacingMode)
        ? paragraph.lineSpacingMode
        : null,
    lineSpacingPt: finiteIn(paragraph.lineSpacingPt, 0, 1600),
    spaceBefore: length(paragraph.spaceBefore),
    spaceAfter: length(paragraph.spaceAfter),
    contextualSpacing: paragraph.contextualSpacing === true ? true : null,
    borders:
      borders && typeof borders === 'object'
        ? {
            top: borders.top === true,
            bottom: borders.bottom === true,
            left: borders.left === true,
            right: borders.right === true,
            ...(colour(borders.color) ? { color: colour(borders.color) } : {}),
          }
        : null,
  };
}

function cleanBlock(block: ParagraphBlock): void {
  block.paragraph = cleanParagraph(block.paragraph);
  block.runs = block.runs.map((run) =>
    run.lineBreak ? { text: '', marks: {}, lineBreak: true } : { text: run.text, marks: cleanMarks(run.marks) },
  );
}

/**
 * A document reduced to what this app can represent, with every value checked.
 *
 * Read into the normalised model and written back out, so what is stored is
 * exactly what `documentToProseMirror` — the path every `.docx` takes into the
 * editor — produces. Anything the model has no place for is dropped here, at
 * the admin's save, rather than surprising a candidate later.
 */
export function normaliseDocument(document: JSONContent): JSONContent {
  const model = proseMirrorToDocument(document, NO_METADATA);
  for (const block of model.body.flatMap(paragraphsOf)) cleanBlock(block);
  return documentToProseMirror(model);
}

/* -- Replaying ------------------------------------------------------------- */

/** One character of a paragraph, with its own formatting. A hard break is one character, as in `flatten`. */
interface Char {
  text: string;
  marks: RunFormatting;
  lineBreak: boolean;
}

function explode(runs: readonly TextRun[]): Char[] {
  const chars: Char[] = [];
  for (const run of runs) {
    if (run.lineBreak) {
      chars.push({ text: '', marks: {}, lineBreak: true });
      continue;
    }
    for (const char of run.text) chars.push({ text: char, marks: { ...run.marks }, lineBreak: false });
  }
  return chars;
}

function implode(chars: readonly Char[]): TextRun[] {
  const runs: TextRun[] = [];
  for (const char of chars) {
    if (char.lineBreak) {
      runs.push({ text: '', marks: {}, lineBreak: true });
      continue;
    }
    const last = runs[runs.length - 1];
    if (last && !last.lineBreak && JSON.stringify(last.marks) === JSON.stringify(char.marks)) last.text += char.text;
    else runs.push({ text: char.text, marks: char.marks });
  }
  return runs;
}

function setCharacter(chars: Char[], change: CharacterChange): void {
  const property = change.property;
  for (let index = change.range.from; index < change.range.to && index < chars.length; index += 1) {
    const char = chars[index]!;
    if (char.lineBreak) continue;
    const marks = { ...char.marks } as Record<string, unknown>;
    if (change.value === null || change.value === false) delete marks[property];
    else marks[property] = change.value;
    char.marks = marks as RunFormatting;
  }
}

function setParagraph(block: ParagraphBlock, change: ParagraphChange): void {
  if (change.property === 'styleId') {
    const styleId = (typeof change.value === 'string' ? change.value : 'Normal') as NormalizedStyleId;
    block.styleId = styleId;
    block.headingLevel = styleId === 'Heading1' ? 1 : styleId === 'Heading2' ? 2 : styleId === 'Heading3' ? 3 : null;
    return;
  }

  if (change.property === 'list') {
    block.list =
      change.value === 'bullet' || change.value === 'ordered'
        ? { kind: change.value, level: block.list?.level ?? 0 }
        : null;
    return;
  }

  (block.paragraph as unknown as Record<string, unknown>)[change.property] = change.value ?? null;
}

function applyToModel(model: DocumentModel, steps: readonly DocumentStep[]): void {
  const paragraphs = model.body.flatMap(paragraphsOf);

  for (const step of steps) {
    if (step.level === 'paragraph') {
      for (const index of step.blocks) {
        const block = paragraphs[index];
        if (!block) continue;
        for (const change of step.changes) setParagraph(block, change);
      }
      continue;
    }

    const block = paragraphs[step.block];
    if (!block) continue;
    const chars = explode(block.runs);
    for (const change of step.changes) setCharacter(chars, change);
    block.runs = implode(chars);
  }
}

/** The document with these steps replayed onto it, in order. */
export function applySteps(document: JSONContent, steps: readonly DocumentStep[]): JSONContent {
  const model = proseMirrorToDocument(document, NO_METADATA);
  applyToModel(model, steps);
  return documentToProseMirror(model);
}

/**
 * The document after a run of questions, each replayed in turn.
 *
 * What the admin records the next question on, and — with the list cut short —
 * what they re-record an earlier one on.
 */
export function replay(document: JSONContent, questions: readonly { steps: readonly DocumentStep[] }[]): JSONContent {
  const model = proseMirrorToDocument(document, NO_METADATA);
  for (const question of questions) applyToModel(model, question.steps);
  return documentToProseMirror(model);
}

/**
 * True when replaying `steps` onto `before` gives exactly `after`.
 *
 * Stored questions are replayed to build the next question's starting point
 * and every worked answer, so a change this module cannot put back — a list
 * level, an attribute the model has no slot for — has to be refused when it is
 * recorded rather than silently lost on the way to the next question.
 */
export function faithful(before: JSONContent, steps: readonly DocumentStep[], after: JSONContent): boolean {
  return sameProjection(project(applySteps(before, steps)), project(after));
}
