import type { JSONContent } from '@tiptap/core';
import { answerOf } from '@/editor/functions/catalog';
import { applyParts } from '@/exam/modelAnswerDocument';
import type { Localised, ModelAnswer, WordQuestion } from '@/exam/types';
import type { WordOperation, WordQuestionDraft, WordScope, WordStep } from './types';

/**
 * Turning a Word question's draft into the question the player renders.
 *
 * These are the helpers `seedAttempt.ts` used to keep to itself. They are
 * exported because a paper typed into the admin form has to be built the same
 * way the fixture is: one function deciding what "bold the paragraph" means,
 * rather than a fixture that formats one way and an authored question that
 * formats another.
 *
 * What each operation *means* is not decided here either — it is declared once
 * in the function catalog (`@/editor/functions/catalog`), which is also what
 * the answer key is derived from. This module's job is only to gather those
 * contributions into the shape the review screen renders.
 */

/** A passage from one paragraph per line. An empty line is an empty paragraph. */
export function passageDocument(...lines: string[]): JSONContent {
  return {
    type: 'doc',
    content: lines.map((line) => ({
      type: 'paragraph',
      content: line === '' ? [] : [{ type: 'text', text: line }],
    })),
  };
}

/** Formatting applied to the whole paragraph, which is most of a paper. */
export function wholeParagraph(marks?: ModelAnswer['marks'], attrs?: ModelAnswer['attrs']): ModelAnswer {
  return {
    scope: 'all',
    ...(marks ? { marks } : {}),
    ...(attrs ? { attrs } : {}),
  };
}

/**
 * Formatting applied to one character range of the paragraph.
 *
 * This is what a question naming a wrapped line ("underline the 2nd line")
 * produces. The offsets are measured against the rendered page, so they only
 * hold while the passage wording, the page width and the default font stay put
 * — see the note above `BOAT_LINE_TWO` in `seedAttempt.ts`. Every other way of
 * naming text — the third word, the second sentence, a phrase — is a named
 * selection instead, and is resolved from the passage rather than measured.
 */
export function characterRange(
  from: number,
  to: number,
  marks?: ModelAnswer['marks'],
  attrs?: ModelAnswer['attrs'],
): ModelAnswer {
  return {
    scope: { from, to },
    ...(marks ? { marks } : {}),
    ...(attrs ? { attrs } : {}),
  };
}

/** Builds a solution: the selection step, then the ribbon steps. */
export function steps(first: Localised<string>, ...rest: Localised<string>[]): Localised<string[]> {
  return {
    en: [first.en, ...rest.map((step) => step.en)],
    hi: [first.hi, ...rest.map((step) => step.hi)],
  };
}

/**
 * The character formatting a set of operations applies.
 *
 * Every `textStyle` operation lands in *one* mark rather than one mark each:
 * two `textStyle` marks on the same text is not a thing the editor produces,
 * and a model answer carrying two would render only the last one. Block-level
 * operations are skipped here and picked up by `paragraphAttrs`.
 */
export function characterMarks(operations: readonly WordOperation[]): ModelAnswer['marks'] {
  const marks: NonNullable<ModelAnswer['marks']> = [];
  const textStyle: Record<string, unknown> = {};

  for (const operation of operations) {
    const contribution = answerOf(operation);
    if (contribution.marks) marks.push(...contribution.marks);
    if (contribution.textStyle) Object.assign(textStyle, contribution.textStyle);
  }

  if (Object.keys(textStyle).length > 0) marks.push({ type: 'textStyle', attrs: textStyle });
  return marks.length > 0 ? marks : undefined;
}

/** The paragraph formatting a set of operations applies. */
export function paragraphAttrs(operations: readonly WordOperation[]): ModelAnswer['attrs'] {
  const attrs: Record<string, unknown> = {};

  for (const operation of operations) {
    const contribution = answerOf(operation);
    if (contribution.attrs) Object.assign(attrs, contribution.attrs);
  }

  return Object.keys(attrs).length > 0 ? attrs : undefined;
}

/** One selection and the formatting it receives. */
function part(operations: readonly WordOperation[], scope: WordScope): Omit<ModelAnswer, 'more'> {
  const marks = characterMarks(operations);
  const attrs = paragraphAttrs(operations);

  return {
    scope,
    ...(marks ? { marks } : {}),
    ...(attrs ? { attrs } : {}),
  };
}

/**
 * How the passage looks once the question has been answered correctly.
 *
 * A character range scopes the *marks* only. Alignment, line spacing and indent
 * are properties of a paragraph — Word has no way to centre half a line — so a
 * block-level operation applies to the block however the question was scoped.
 */
export function wordModelAnswer(operations: readonly WordOperation[], scope: WordScope): ModelAnswer {
  return part(operations, scope);
}

/**
 * The same, for a question that asks for more than one thing.
 *
 * The first step is the answer proper and the rest hang off `more`, so a
 * single-step question produces exactly the object it always did — which is
 * what lets the existing papers go through this path unchanged.
 */
export function wordModelAnswerFromSteps(list: readonly WordStep[]): ModelAnswer {
  const [first, ...rest] = list;
  if (!first) return { scope: 'all' };

  const answer = part(first.operations, first.scope);
  return rest.length === 0
    ? answer
    : { ...answer, more: rest.map((step) => part(step.operations, step.scope)) };
}

/**
 * A draft's steps, however it was written.
 *
 * A question states either one selection and its operations — which is most of
 * them — or a list of steps. Both arrive here as a list, so nothing downstream
 * has to know which form was used.
 */
export function stepsOf(draft: WordQuestionDraft): WordStep[] {
  if (draft.steps && draft.steps.length > 0) return draft.steps;
  return [{ scope: draft.scope, operations: draft.operations }];
}

/**
 * The passage as the candidate first sees it.
 *
 * Plain paragraphs, unless the question needs some of them to arrive already
 * formatted — which is what makes "remove the highlight" a question rather than
 * a no-op. The starting formatting goes through exactly the same renderer as
 * the worked answer, so a question cannot start in a state its own answer could
 * not describe.
 */
export function startingPassage(lines: readonly string[], initial: readonly WordStep[] = []): JSONContent {
  const document = passageDocument(...lines);
  if (initial.length === 0) return document;

  return applyParts(
    document,
    initial.map((step) => part(step.operations, step.scope)),
  );
}

/** The draft as the question the player renders. */
export function buildWordQuestion(draft: WordQuestionDraft): WordQuestion {
  return {
    subject: 'word',
    number: draft.number,
    topic: draft.topic,
    difficulty: draft.difficulty,
    instruction: draft.instruction,
    passage: {
      en: startingPassage(draft.lines.en, draft.initial),
      hi: startingPassage(draft.lines.hi, draft.initial),
    },
    solution: draft.solution,
    modelAnswer: wordModelAnswerFromSteps(stepsOf(draft)),
    marks: draft.marks,
    // Every question starts untouched: nothing is flagged for review until the
    // candidate flags it.
    bookmarked: false,
  };
}
