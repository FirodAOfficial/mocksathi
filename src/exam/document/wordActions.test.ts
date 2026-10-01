import type { JSONContent } from '@tiptap/core';
import { Editor } from '@tiptap/react';
import { afterEach, describe, expect, it } from 'vitest';
import { buildEditorExtensions } from '@/editor/extensions';
import {
  changeCase,
  changeIndent,
  changeListLevel,
  clearFormatting,
  setAlignment,
  setBorders,
  setCaps,
  setCharacterScale,
  setCharacterSpacing,
  setContextualSpacing,
  setDoubleStrike,
  setFontFamily,
  setFontSize,
  setHiddenText,
  setHighlightColor,
  setIndents,
  setLineSpacing,
  setLineSpacingAt,
  setParagraphSpacing,
  setParagraphStyle,
  setTextColor,
  setTextEffect,
  setUnderlineColor,
  setUnderlineStyle,
  sortParagraphs,
  stepFontSize,
  toggleBulletList,
  toggleOrderedList,
} from '@/editor/ribbonActions';
import { documentMarker, segmentsByQuestion } from '@/exam/marking/documentMarker';
import { markAttempt } from '@/exam/marking/markAttempt';
import type { AnswerPayload, ExamAttempt } from '@/exam/types';
import { documentRubricFor } from '@/server/marking/documentRubric';
import { cmToPx, pointsToPx } from '@/utils/units';
import { faithful, project } from './apply';
import { describeStep } from './describe';
import { detectChanges, hasVisibleChange } from './detect';
import { topicsFor } from './topics';
import type { DocumentStep } from './types';

/*
 * Every formatting action the editor offers, checked end to end in a real
 * editor through the same `ribbonActions` the ribbon and the dialogs call.
 *
 * For each one:
 *
 * 1. **Detected as the standard value.** The admin performs it; detection must
 *    read exactly the property Word would set, in Word's own units converted
 *    the way the model stores them (14 pt, 1.27 cm = 48 px, 12 pt = 16 px) —
 *    and nothing else alongside it.
 * 2. **Rendered as the standard markup.** The editor's HTML carries the
 *    element or CSS declaration that formatting means on the web.
 * 3. **Replays exactly.** Recording it as a question and replaying it gives
 *    back the admin's own document.
 * 4. **Marked right in any order.** A candidate who first answers a question
 *    on the same paragraph, then performs this action, is marked correct.
 * 5. **Marked wrong when it is not this.** A near-miss (another value, another
 *    button) and the right action plus an extra one are both incorrect.
 */

const P1 = 'Narendra Modi is the Prime Minister of India.';
const P2 = 'He promoted the "Gujarat Model" of development across the state.';
const P3 = 'Supporters credited him with economic growth.';

const PASSAGE: JSONContent = {
  type: 'doc',
  content: [P1, P2, P3].map((line) => ({ type: 'paragraph', content: [{ type: 'text', text: line }] })),
};

/* -- An editor, driven like the ribbon drives it ---------------------------- */

const editors: Editor[] = [];
afterEach(() => {
  while (editors.length > 0) editors.pop()!.destroy();
});

function open(document: JSONContent): Editor {
  const element = window.document.createElement('div');
  window.document.body.appendChild(element);
  const editor = new Editor({ element, extensions: buildEditorExtensions(), content: structuredClone(document) });
  editors.push(editor);
  return editor;
}

type Selection = { block: number; from: number; to: number };

/** "Gujarat Model" in paragraph 2. */
const WORD: Selection = { block: 1, from: P2.indexOf('Gujarat'), to: P2.indexOf('Gujarat') + 'Gujarat Model'.length };
/** All of paragraph 2. */
const PARAGRAPH: Selection = { block: 1, from: 0, to: P2.length };
/** "economic" in paragraph 3 — somewhere else entirely. */
const ELSEWHERE: Selection = { block: 2, from: P3.indexOf('economic'), to: P3.indexOf('economic') + 'economic'.length };

/** Selects characters of a paragraph, counted as the marker counts them. */
function select(editor: Editor, { block, from, to }: Selection): void {
  let index = 0;
  let start: number | null = null;
  editor.state.doc.descendants((node, pos) => {
    if (start !== null) return false;
    if (!node.isTextblock) return true;
    if (index === block) start = pos + 1;
    index += 1;
    return false;
  });
  if (start === null) throw new Error(`No paragraph ${block}`);
  editor.commands.setTextSelection({ from: start + from, to: start + to });
}

type Action = (editor: Editor) => void;

/** The document after performing `action` on `where`. */
function perform(document: JSONContent, where: Selection, action: Action): JSONContent {
  const editor = open(document);
  select(editor, where);
  action(editor);
  return editor.getJSON();
}

function html(document: JSONContent): string {
  return open(document).getHTML();
}

/* -- Marking a two-question paper ----------------------------------------- */

function attemptOf(passage: JSONContent): ExamAttempt {
  return {
    candidateName: 'Candidate',
    subject: 'word',
    durationSeconds: 600,
    sharedDocument: passage,
    sections: [
      {
        name: 'Word',
        questions: [1, 2].map((number) => ({
          subject: 'word' as const,
          number,
          topic: 'Formatting',
          difficulty: 'Easy' as const,
          instruction: { en: '', hi: '' },
          solution: { en: [], hi: [] },
          passage: { en: passage, hi: passage },
          modelAnswer: { scope: 'all' as const },
          marks: 1,
          bookmarked: false,
        })),
      },
    ],
  };
}

function mark(
  passage: JSONContent,
  questions: DocumentStep[][],
  timeline: { question: number; document: JSONContent }[],
): string[] {
  const answers: Record<number, AnswerPayload> = {};
  for (const [number, segments] of segmentsByQuestion(passage, timeline)) {
    answers[number] = { segments } as unknown as AnswerPayload;
  }
  const { marks } = markAttempt(
    attemptOf(passage),
    questions.map((steps, index) => documentRubricFor(index + 1, steps, project(passage))),
    { answers, language: 'en', totalTimeSeconds: 0 },
    { topper: {}, average: {}, topperTimePerQuestion: [], averageTimePerQuestion: [] } as never,
    documentMarker(),
    { testName: '', tagline: '', qualifyingMarks: 0 },
  );
  return marks.map((entry) => entry.outcome);
}

/* -- The actions ----------------------------------------------------------- */

interface ActionCase {
  /** What Word calls it. */
  name: string;
  where: Selection;
  action: Action;
  /** The changes detection must read — every one, and nothing else. */
  standard: Record<string, unknown>;
  /** What the editor must render, as HTML a browser understands. */
  renders: (string | RegExp)[];
  /** How the change is described to the admin and the candidate. */
  describes: RegExp;
  /** A plausible wrong answer. */
  nearMiss: Action;
  /** Formatting the passage starts with — what a "remove" action takes off. */
  starts?: { where: Selection; action: Action };
  /** Another question the candidate answers first. Default: italic over all of paragraph 2. */
  other?: { where: Selection; action: Action };
}

const bold: Action = (editor) => editor.chain().focus().toggleBold().run();
const italic: Action = (editor) => editor.chain().focus().toggleItalic().run();
const underline: Action = (editor) => editor.chain().focus().toggleUnderline().run();
const strike: Action = (editor) => editor.chain().focus().toggleStrike().run();
const subscript: Action = (editor) => editor.chain().focus().toggleSubscript().run();
const superscript: Action = (editor) => editor.chain().focus().toggleSuperscript().run();

const ON_ANOTHER_PARAGRAPH = { where: { block: 0, from: 0, to: P1.length }, action: italic };

const CHARACTER_ACTIONS: ActionCase[] = [
  { name: 'Bold', where: WORD, action: bold, standard: { bold: true }, renders: ['<strong>Gujarat Model</strong>'], describes: /^Bold — /, nearMiss: italic },
  { name: 'Italic', where: WORD, action: italic, standard: { italic: true }, renders: ['<em>Gujarat Model</em>'], describes: /^Italic — /, nearMiss: bold, other: { where: PARAGRAPH, action: bold } },
  { name: 'Underline', where: WORD, action: underline, standard: { underline: true }, renders: ['<u>Gujarat Model</u>'], describes: /^Underline — /, nearMiss: (editor) => setUnderlineStyle(editor, 'double') },
  ...(['double', 'thick', 'dotted', 'dashed', 'dashDot', 'dashDotDot', 'wavy'] as const).map(
    (style): ActionCase => ({
      name: `Underline style: ${style}`,
      where: WORD,
      action: (editor) => setUnderlineStyle(editor, style),
      standard: { underline: true, underlineStyle: style },
      renders: [`data-underline="${style}"`],
      describes: /underline/i,
      nearMiss: underline,
    }),
  ),
  {
    name: 'Underline colour',
    where: WORD,
    starts: { where: WORD, action: underline },
    action: (editor) => setUnderlineColor(editor, '#ff0000'),
    standard: { underlineColor: '#ff0000' },
    renders: ['data-underline-color="#ff0000"'],
    describes: /^Underline colour red — /,
    nearMiss: (editor) => setUnderlineColor(editor, '#0000ff'),
  },
  { name: 'Strikethrough', where: WORD, action: strike, standard: { strike: true }, renders: ['<s>Gujarat Model</s>'], describes: /^Strikethrough — /, nearMiss: (editor) => setDoubleStrike(editor, true) },
  { name: 'Double strikethrough', where: WORD, action: (editor) => setDoubleStrike(editor, true), standard: { doubleStrike: true }, renders: ['text-decoration-style: double'], describes: /^Double strikethrough — /, nearMiss: strike },
  { name: 'Subscript', where: WORD, action: subscript, standard: { vertAlign: 'sub' }, renders: ['<sub>Gujarat Model</sub>'], describes: /^Subscript — /, nearMiss: superscript },
  { name: 'Superscript', where: WORD, action: superscript, standard: { vertAlign: 'super' }, renders: ['<sup>Gujarat Model</sup>'], describes: /^Superscript — /, nearMiss: subscript },
  { name: 'Font colour', where: WORD, action: (editor) => setTextColor(editor, '#ff0000'), standard: { color: '#ff0000' }, renders: [/color: (#ff0000|rgb\(255, 0, 0\))/], describes: /^Font colour red — /, nearMiss: (editor) => setTextColor(editor, '#0000ff') },
  { name: 'Text highlight colour', where: WORD, action: (editor) => setHighlightColor(editor, '#ffff00'), standard: { highlight: '#ffff00' }, renders: ['<mark', /background-color: (#ffff00|rgb\(255, 255, 0\))/], describes: /^Highlight yellow — /, nearMiss: (editor) => setHighlightColor(editor, '#00ff00') },
  { name: 'Font', where: PARAGRAPH, action: (editor) => setFontFamily(editor, 'Times New Roman'), standard: { fontFamily: 'Times New Roman' }, renders: [/font-family: "?Times New Roman"?/], describes: /^Font Times New Roman — the whole of paragraph 2/, nearMiss: (editor) => setFontFamily(editor, 'Arial') },
  { name: 'Font size', where: PARAGRAPH, action: (editor) => setFontSize(editor, 14), standard: { fontSize: 14 }, renders: ['font-size: 14pt'], describes: /^Font size 14 pt — /, nearMiss: (editor) => setFontSize(editor, 12) },
  { name: 'Grow Font (11 → 12 pt)', where: WORD, action: (editor) => stepFontSize(editor, 1), standard: { fontSize: 12 }, renders: ['font-size: 12pt'], describes: /^Font size 12 pt — /, nearMiss: (editor) => stepFontSize(editor, -1) },
  { name: 'Shrink Font (11 → 10 pt)', where: WORD, action: (editor) => stepFontSize(editor, -1), standard: { fontSize: 10 }, renders: ['font-size: 10pt'], describes: /^Font size 10 pt — /, nearMiss: (editor) => stepFontSize(editor, 1) },
  { name: 'Small caps', where: WORD, action: (editor) => setCaps(editor, 'small'), standard: { caps: 'small' }, renders: ['small-caps'], describes: /^Small caps — /, nearMiss: (editor) => setCaps(editor, 'all') },
  { name: 'All caps', where: WORD, action: (editor) => setCaps(editor, 'all'), standard: { caps: 'all' }, renders: ['uppercase'], describes: /^All caps — /, nearMiss: (editor) => setCaps(editor, 'small') },
  { name: 'Hidden', where: WORD, action: (editor) => setHiddenText(editor, true), standard: { hidden: true }, renders: ['data-hidden="true"'], describes: /^Hidden — /, nearMiss: strike },
  { name: 'Emboss', where: WORD, action: (editor) => setTextEffect(editor, 'emboss'), standard: { effect: 'emboss' }, renders: ['data-effect="emboss"'], describes: /^Emboss — /, nearMiss: (editor) => setTextEffect(editor, 'engrave') },
  { name: 'Engrave', where: WORD, action: (editor) => setTextEffect(editor, 'engrave'), standard: { effect: 'engrave' }, renders: ['data-effect="engrave"'], describes: /^Engrave — /, nearMiss: (editor) => setTextEffect(editor, 'emboss') },
  { name: 'Character scale 200%', where: WORD, action: (editor) => setCharacterScale(editor, 200), standard: { charScale: 200 }, renders: ['scale'], describes: /^Scale 200% — /, nearMiss: (editor) => setCharacterScale(editor, 150) },
  { name: 'Character spacing expanded 2 pt', where: WORD, action: (editor) => setCharacterSpacing(editor, 2), standard: { charSpacing: 2 }, renders: ['letter-spacing: 2pt'], describes: /^Character spacing expanded by 2 pt — /, nearMiss: (editor) => setCharacterSpacing(editor, -2) },
  { name: 'Character spacing condensed 1 pt', where: WORD, action: (editor) => setCharacterSpacing(editor, -1), standard: { charSpacing: -1 }, renders: ['letter-spacing: -1pt'], describes: /^Character spacing condensed by 1 pt — /, nearMiss: (editor) => setCharacterSpacing(editor, 1) },

  /* Taking formatting off. The passage starts with it, so there is something to remove. */
  { name: 'Remove bold', where: WORD, starts: { where: WORD, action: bold }, action: bold, standard: { bold: null }, renders: [/(?<!<strong>)Gujarat Model/], describes: /^Remove bold — /, nearMiss: italic },
  { name: 'Remove underline', where: WORD, starts: { where: WORD, action: underline }, action: (editor) => setUnderlineStyle(editor, null), standard: { underline: null }, renders: [/(?<!<u>)Gujarat Model/], describes: /^Remove underline — /, nearMiss: bold },
  { name: 'Remove font colour (Automatic)', where: WORD, starts: { where: WORD, action: (editor) => setTextColor(editor, '#0000ff') }, action: (editor) => setTextColor(editor, null), standard: { color: null }, renders: [/(?<!color: [^"]*)Gujarat Model/], describes: /^Remove font colour — /, nearMiss: (editor) => setTextColor(editor, '#ff0000') },
  { name: 'Remove highlight (No Colour)', where: WORD, starts: { where: WORD, action: (editor) => setHighlightColor(editor, '#ffff00') }, action: (editor) => setHighlightColor(editor, null), standard: { highlight: null }, renders: [/^(?!.*<mark)/s], describes: /^Remove highlight — /, nearMiss: (editor) => setHighlightColor(editor, '#00ff00') },
  {
    name: 'Clear All Formatting',
    where: WORD,
    starts: { where: WORD, action: (editor) => (bold(editor), italic(editor), setTextColor(editor, '#ff0000')) },
    action: clearFormatting,
    standard: { bold: null, italic: null, color: null },
    renders: [/^(?!.*<(strong|em)>)/s],
    describes: /Remove bold \+ Remove italic \+ Remove font colour/,
    nearMiss: bold,
    other: ON_ANOTHER_PARAGRAPH,
  },
];

const PARAGRAPH_ACTIONS: ActionCase[] = [
  { name: 'Center', where: PARAGRAPH, action: (editor) => setAlignment(editor, 'center'), standard: { align: 'center' }, renders: ['text-align: center'], describes: /^Centre — paragraph 2/, nearMiss: (editor) => setAlignment(editor, 'right') },
  { name: 'Align Right', where: PARAGRAPH, action: (editor) => setAlignment(editor, 'right'), standard: { align: 'right' }, renders: ['text-align: right'], describes: /^Align right — /, nearMiss: (editor) => setAlignment(editor, 'center') },
  { name: 'Justify', where: PARAGRAPH, action: (editor) => setAlignment(editor, 'justify'), standard: { align: 'justify' }, renders: ['text-align: justify'], describes: /^Justify — /, nearMiss: (editor) => setAlignment(editor, 'left') },
  { name: 'Align Left (from centred)', where: PARAGRAPH, starts: { where: PARAGRAPH, action: (editor) => setAlignment(editor, 'center') }, action: (editor) => setAlignment(editor, 'left'), standard: { align: 'left' }, renders: ['text-align: left'], describes: /^Align left — /, nearMiss: (editor) => setAlignment(editor, 'right') },
  ...[1, 1.15, 1.5, 2, 2.5, 3].map(
    (value): ActionCase => ({
      name: `Line spacing ${value}`,
      where: PARAGRAPH,
      action: (editor) => setLineSpacing(editor, value),
      standard: { lineHeight: value },
      renders: [`line-height: ${value}`],
      describes: new RegExp(`^Line spacing ${String(value).replace('.', '\\.')} — `),
      nearMiss: (editor) => setLineSpacing(editor, value === 2 ? 1.5 : 2),
    }),
  ),
  { name: 'Line spacing Exactly 12 pt', where: PARAGRAPH, action: (editor) => setLineSpacingAt(editor, 'exactly', 12), standard: { lineSpacingMode: 'exactly', lineSpacingPt: 12 }, renders: ['line-height: 12pt'], describes: /Exactly.*12 pt/, nearMiss: (editor) => setLineSpacingAt(editor, 'atLeast', 12) },
  { name: 'Line spacing At least 18 pt', where: PARAGRAPH, action: (editor) => setLineSpacingAt(editor, 'atLeast', 18), standard: { lineSpacingMode: 'atLeast', lineSpacingPt: 18 }, renders: ['data-line-spacing-pt="18"'], describes: /At least.*18 pt/, nearMiss: (editor) => setLineSpacingAt(editor, 'exactly', 18) },
  { name: 'Spacing Before 12 pt', where: PARAGRAPH, action: (editor) => setParagraphSpacing(editor, { before: pointsToPx(12) }), standard: { spaceBefore: 16 }, renders: ['margin-top: 16px'], describes: /^Space before 12 pt — /, nearMiss: (editor) => setParagraphSpacing(editor, { after: pointsToPx(12) }) },
  { name: 'Spacing After 6 pt', where: PARAGRAPH, action: (editor) => setParagraphSpacing(editor, { after: pointsToPx(6) }), standard: { spaceAfter: 8 }, renders: ['margin-bottom: 8px'], describes: /^Space after 6 pt — /, nearMiss: (editor) => setParagraphSpacing(editor, { after: pointsToPx(12) }) },
  { name: "Don't add space between paragraphs of the same style", where: PARAGRAPH, action: (editor) => setContextualSpacing(editor, true), standard: { contextualSpacing: true }, renders: ['data-contextual-spacing="true"'], describes: /^Don't add space/, nearMiss: (editor) => setParagraphSpacing(editor, { after: 0 }) },
  { name: 'Increase Indent (0.5 inch)', where: PARAGRAPH, action: (editor) => changeIndent(editor, 1), standard: { indentLeft: 48 }, renders: ['margin-left: 48px'], describes: /^Left indent 1\.27 cm — /, nearMiss: (editor) => (changeIndent(editor, 1), changeIndent(editor, 1)) },
  { name: 'Decrease Indent', where: PARAGRAPH, starts: { where: PARAGRAPH, action: (editor) => (changeIndent(editor, 1), changeIndent(editor, 1)) }, action: (editor) => changeIndent(editor, -1), standard: { indentLeft: 48 }, renders: ['margin-left: 48px'], describes: /^Left indent 1\.27 cm — /, nearMiss: (editor) => changeIndent(editor, 1) },
  { name: 'Indent Left 2 cm', where: PARAGRAPH, action: (editor) => setIndents(editor, { left: cmToPx(2) }), standard: { indentLeft: 76 }, renders: ['margin-left: 76px'], describes: /^Left indent 2\.01 cm — |^Left indent 2 cm — /, nearMiss: (editor) => setIndents(editor, { right: cmToPx(2) }) },
  { name: 'Indent Right 2 cm', where: PARAGRAPH, action: (editor) => setIndents(editor, { right: cmToPx(2) }), standard: { indentRight: 76 }, renders: ['margin-right: 76px'], describes: /^Right indent/, nearMiss: (editor) => setIndents(editor, { left: cmToPx(2) }) },
  { name: 'Special: First line 1 cm', where: PARAGRAPH, action: (editor) => setIndents(editor, { firstLine: cmToPx(1) }), standard: { indentFirstLine: 38 }, renders: ['text-indent: 38px'], describes: /^First-line indent/, nearMiss: (editor) => setIndents(editor, { firstLine: -cmToPx(1) }) },
  { name: 'Special: Hanging 1 cm', where: PARAGRAPH, action: (editor) => setIndents(editor, { firstLine: -cmToPx(1) }), standard: { indentFirstLine: -38 }, renders: ['text-indent: -38px'], describes: /^Hanging indent/, nearMiss: (editor) => setIndents(editor, { firstLine: cmToPx(1) }) },
  { name: 'Bottom Border', where: PARAGRAPH, action: (editor) => setBorders(editor, { top: false, bottom: true, left: false, right: false }), standard: { borders: { top: false, bottom: true, left: false, right: false } }, renders: [/border-bottom: [^;"]*solid/], describes: /^Border bottom — /, nearMiss: (editor) => setBorders(editor, { top: true, bottom: false, left: false, right: false }) },
  { name: 'Outside Borders', where: PARAGRAPH, action: (editor) => setBorders(editor, { top: true, bottom: true, left: true, right: true }), standard: { borders: { top: true, bottom: true, left: true, right: true } }, renders: [/border-top: [^;"]*solid/, /border-left: [^;"]*solid/], describes: /^Outside borders — /, nearMiss: (editor) => setBorders(editor, { top: false, bottom: true, left: false, right: false }) },
  { name: 'No Border', where: PARAGRAPH, starts: { where: PARAGRAPH, action: (editor) => setBorders(editor, { top: true, bottom: true, left: true, right: true }) }, action: (editor) => setBorders(editor, null), standard: { borders: null }, renders: [/^(?!.*border-top)/s], describes: /^No border — /, nearMiss: (editor) => setBorders(editor, { top: false, bottom: true, left: false, right: false }) },
  { name: 'Style: Heading 1', where: PARAGRAPH, action: (editor) => setParagraphStyle(editor, 'Heading1'), standard: { styleId: 'Heading1' }, renders: ['<h1'], describes: /^Style Heading 1 — /, nearMiss: (editor) => setParagraphStyle(editor, 'Heading2') },
  { name: 'Style: Heading 2', where: PARAGRAPH, action: (editor) => setParagraphStyle(editor, 'Heading2'), standard: { styleId: 'Heading2' }, renders: ['<h2'], describes: /^Style Heading 2 — /, nearMiss: (editor) => setParagraphStyle(editor, 'Heading1') },
  { name: 'Style: Heading 3', where: PARAGRAPH, action: (editor) => setParagraphStyle(editor, 'Heading3'), standard: { styleId: 'Heading3' }, renders: ['<h3'], describes: /^Style Heading 3 — /, nearMiss: (editor) => setParagraphStyle(editor, 'Heading2') },
  { name: 'Style: Title', where: PARAGRAPH, action: (editor) => setParagraphStyle(editor, 'Title'), standard: { styleId: 'Title' }, renders: ['data-style="Title"'], describes: /^Style Title — /, nearMiss: (editor) => setParagraphStyle(editor, 'Subtitle') },
  { name: 'Style: Subtitle', where: PARAGRAPH, action: (editor) => setParagraphStyle(editor, 'Subtitle'), standard: { styleId: 'Subtitle' }, renders: ['data-style="Subtitle"'], describes: /^Style Subtitle — /, nearMiss: (editor) => setParagraphStyle(editor, 'Title') },
  { name: 'Style: No Spacing', where: PARAGRAPH, action: (editor) => setParagraphStyle(editor, 'NoSpacing'), standard: { styleId: 'NoSpacing' }, renders: ['data-style="NoSpacing"'], describes: /^Style No Spacing — /, nearMiss: (editor) => setParagraphStyle(editor, 'Title') },
  { name: 'Style: Quote', where: PARAGRAPH, action: (editor) => setParagraphStyle(editor, 'Quote'), standard: { styleId: 'Quote' }, renders: ['<blockquote'], describes: /^Style Quote — /, nearMiss: (editor) => setParagraphStyle(editor, 'Heading1') },
  { name: 'Style: Normal (from Heading 1)', where: PARAGRAPH, starts: { where: PARAGRAPH, action: (editor) => setParagraphStyle(editor, 'Heading1') }, action: (editor) => setParagraphStyle(editor, 'Normal'), standard: { styleId: 'Normal' }, renders: [/^(?!.*<h1)/s], describes: /^Style Normal — /, nearMiss: (editor) => setParagraphStyle(editor, 'Heading2') },
  { name: 'Bullets', where: PARAGRAPH, action: toggleBulletList, standard: { list: 'bullet' }, renders: ['<ul'], describes: /^Bulleted list — /, nearMiss: toggleOrderedList },
  { name: 'Numbering', where: PARAGRAPH, action: toggleOrderedList, standard: { list: 'ordered' }, renders: ['<ol'], describes: /^Numbered list — /, nearMiss: toggleBulletList },
  { name: 'Remove Bullets', where: PARAGRAPH, starts: { where: PARAGRAPH, action: toggleBulletList }, action: toggleBulletList, standard: { list: null }, renders: [/^(?!.*<ul)/s], describes: /^Remove list — /, nearMiss: toggleOrderedList },
  { name: 'Bullets to Numbering', where: PARAGRAPH, starts: { where: PARAGRAPH, action: toggleBulletList }, action: toggleOrderedList, standard: { list: 'ordered' }, renders: ['<ol'], describes: /^Numbered list — /, nearMiss: toggleBulletList },
];

/** Every visible change detected, as property → value. */
function detected(steps: readonly DocumentStep[]): Record<string, unknown> {
  const found: Record<string, unknown> = {};
  for (const step of steps) {
    if (step.licenceOnly) continue;
    for (const change of step.changes) found[change.property] = change.value;
  }
  return found;
}

describe.each([
  ['Character actions', CHARACTER_ACTIONS],
  ['Paragraph actions', PARAGRAPH_ACTIONS],
])('%s', (_group, cases) => {
  describe.each(cases.map((entry) => [entry.name, entry] as const))('%s', (_name, entry) => {
    const passage = () => (entry.starts ? perform(PASSAGE, entry.starts.where, entry.starts.action) : PASSAGE);

    /** What the admin records: the action, on the passage. */
    function record() {
      const before = passage();
      const after = perform(before, entry.where, entry.action);
      const detection = detectChanges(project(before), project(after));
      return { before, after, detection };
    }

    it('is detected as the standard value, and nothing else', () => {
      const { detection } = record();
      expect(detection.problems).toEqual([]);
      expect(hasVisibleChange(detection.steps)).toBe(true);
      expect(detected(detection.steps)).toEqual(entry.standard);
    });

    it('lands on the text that was selected', () => {
      const { detection } = record();
      for (const step of detection.steps.filter((candidate) => !candidate.licenceOnly)) {
        if (step.level === 'character') {
          expect(step.block).toBe(entry.where.block);
          expect(step.text).toBe(entry.where === WORD ? 'Gujarat Model' : P2);
        } else {
          expect(step.blocks).toEqual([entry.where.block]);
        }
      }
    });

    it('renders as the standard markup', () => {
      const { after } = record();
      const markup = html(after);
      for (const expected of entry.renders) {
        if (typeof expected === 'string') expect(markup).toContain(expected);
        else expect(markup).toMatch(expected);
      }
    });

    it('is described in the ribbon’s words', () => {
      const { before, detection } = record();
      const visible = detection.steps.filter((step) => !step.licenceOnly);
      expect(visible.map((step) => describeStep(project(before), step)).join(' | ')).toMatch(entry.describes);
    });

    it('selects a topic for the admin', () => {
      expect(topicsFor(record().detection.steps).length).toBeGreaterThan(0);
    });

    it('replays exactly', () => {
      const { before, after, detection } = record();
      expect(faithful(before, detection.steps, after)).toBe(true);
    });

    describe('marking', () => {
      const other = entry.other ?? { where: PARAGRAPH, action: italic };

      /** Question 1 is this action; question 2 is the other one, recorded after it. */
      function paper() {
        const { before, after, detection } = record();
        const second = perform(after, other.where, other.action);
        const otherSteps = detectChanges(project(after), project(second)).steps;
        return { start: before, questions: [detection.steps, otherSteps] };
      }

      it('is correct when done after another question on the same paragraph', () => {
        const { start, questions } = paper();
        const otherFirst = perform(start, other.where, other.action);
        const thenThis = perform(otherFirst, entry.where, entry.action);
        expect(
          mark(start, questions, [
            { question: 2, document: otherFirst },
            { question: 1, document: thenThis },
          ]),
        ).toEqual(['correct', 'correct']);
      });

      it('is correct when done first', () => {
        const { start, questions } = paper();
        const thisFirst = perform(start, entry.where, entry.action);
        const thenOther = perform(thisFirst, other.where, other.action);
        expect(
          mark(start, questions, [
            { question: 1, document: thisFirst },
            { question: 2, document: thenOther },
          ]),
        ).toEqual(['correct', 'correct']);
      });

      it('is incorrect for a near miss', () => {
        const { start, questions } = paper();
        const wrong = perform(start, entry.where, entry.nearMiss);
        expect(mark(start, questions, [{ question: 1, document: wrong }])[0]).toBe('incorrect');
      });

      it('is incorrect with an extra change made alongside it', () => {
        const { start, questions } = paper();
        const right = perform(start, entry.where, entry.action);
        const extra = perform(right, ELSEWHERE, entry.name === 'Bold' ? italic : bold);
        expect(mark(start, questions, [{ question: 1, document: extra }])[0]).toBe('incorrect');
      });
    });
  });
});

/*
 * Actions that change the wording or the structure rather than the formatting.
 * The passage is fixed in this flow, so recording one is refused with a reason.
 */
describe('actions refused as a question', () => {
  const refused: { name: string; where: Selection; action: Action; reason: RegExp; starts?: Action }[] = [
    { name: 'Change Case: UPPERCASE', where: WORD, action: (editor) => changeCase(editor, 'upper'), reason: /wording of paragraph 2 changed/ },
    { name: 'Change Case: lowercase', where: WORD, action: (editor) => changeCase(editor, 'lower'), reason: /wording of paragraph 2 changed/ },
    { name: 'Typing over the selection', where: WORD, action: (editor) => editor.chain().focus().insertContent('Kerala Model').run(), reason: /wording of paragraph 2 changed/ },
    { name: 'Sort paragraphs', where: { block: 0, from: 0, to: P3.length }, action: (editor) => (editor.commands.selectAll(), sortParagraphs(editor, -1)), reason: /wording of paragraph 1 changed/ },
    {
      name: 'Increase List Level',
      where: PARAGRAPH,
      // Paragraphs 1 and 2 bulleted, so the second has an item above it to nest under.
      starts: (editor) => {
        editor.commands.setTextSelection({ from: 1, to: editor.state.selection.to });
        toggleBulletList(editor);
      },
      action: (editor) => changeListLevel(editor, 1),
      reason: /changed list level/,
    },
  ];

  it.each(refused.map((entry) => [entry.name, entry] as const))('%s', (_name, entry) => {
    const before = entry.starts ? perform(PASSAGE, entry.where, entry.starts) : PASSAGE;
    const after = perform(before, entry.where, entry.action);
    const detection = detectChanges(project(before), project(after));
    expect(detection.problems.join(' ')).toMatch(entry.reason);
  });
});
