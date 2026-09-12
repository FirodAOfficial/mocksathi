import type { JSONContent } from '@tiptap/core';
import { INDENT_STEP_PX } from '@/utils/indent';
import type { Localised, ModelAnswer, WordQuestion } from '@/exam/types';
import type { WordOperation, WordQuestionDraft, WordScope } from './types';

/**
 * Turning a Word question's draft into the question the player renders.
 *
 * These are the helpers `seedAttempt.ts` used to keep to itself. They are
 * exported because a paper typed into the admin form has to be built the same
 * way the fixture is: one function deciding what "bold the paragraph" means,
 * rather than a fixture that formats one way and an authored question that
 * formats another.
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
 * — see the note above `BOAT_LINE_TWO` in `seedAttempt.ts`.
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
    switch (operation.kind) {
      case 'bold':
      case 'italic':
      case 'underline':
      case 'strike':
        marks.push({ type: operation.kind });
        break;
      case 'highlight':
        marks.push({ type: 'highlight', attrs: { color: operation.color } });
        break;
      case 'fontColor':
        textStyle.color = operation.color;
        break;
      case 'fontFamily':
        textStyle.fontFamily = operation.family;
        break;
      case 'fontSize':
        // The editor stores a size with its unit; the ribbon box shows the number.
        textStyle.fontSize = `${operation.size}pt`;
        break;
      default:
        break;
    }
  }

  if (Object.keys(textStyle).length > 0) marks.push({ type: 'textStyle', attrs: textStyle });
  return marks.length > 0 ? marks : undefined;
}

/** The paragraph formatting a set of operations applies. */
export function paragraphAttrs(operations: readonly WordOperation[]): ModelAnswer['attrs'] {
  const attrs: Record<string, unknown> = {};

  for (const operation of operations) {
    switch (operation.kind) {
      case 'align':
        attrs.textAlign = operation.align;
        break;
      case 'lineHeight':
        attrs.lineHeight = operation.value;
        break;
      case 'indent':
        attrs.indentLeft = operation.levels * INDENT_STEP_PX;
        break;
      default:
        break;
    }
  }

  return Object.keys(attrs).length > 0 ? attrs : undefined;
}

/**
 * How the passage looks once the question has been answered correctly.
 *
 * A character range scopes the *marks* only. Alignment, line spacing and indent
 * are properties of a paragraph — Word has no way to centre half a line — so a
 * block-level operation applies to the block however the question was scoped.
 */
export function wordModelAnswer(operations: readonly WordOperation[], scope: WordScope): ModelAnswer {
  const marks = characterMarks(operations);
  const attrs = paragraphAttrs(operations);

  return scope === 'all'
    ? wholeParagraph(marks, attrs)
    : characterRange(scope.from, scope.to, marks, attrs);
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
      en: passageDocument(...draft.lines.en),
      hi: passageDocument(...draft.lines.hi),
    },
    solution: draft.solution,
    modelAnswer: wordModelAnswer(draft.operations, draft.scope),
    marks: draft.marks,
    // Every question starts untouched: nothing is flagged for review until the
    // candidate flags it.
    bookmarked: false,
  };
}
