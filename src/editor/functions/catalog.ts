import type { WordOperation } from '@/exam/authoring/types';
import type { Criterion } from '@/exam/marking/criteria';
import type { MarkName } from '@/exam/marking/flatten';
import type { NormalizedStyleId, ParagraphBorders } from '@/services/document/types';
import { INDENT_STEP_PX } from '@/utils/indent';
import { lengthToPx, pointsToPx, type LengthUnit } from '@/utils/units';
import { acceptedColours, colourName } from './colours';
import type { AnswerContribution, CriterionContext, DocFunction, FunctionCategory } from './types';
import { UNDERLINE_STYLES, underlineStyleLabel, type UnderlineStyle } from './underline';

/**
 * Every formatting function the app knows about, declared once.
 *
 * This is the file the ribbon, the Font and Paragraph dialogs, the admin
 * question form, the request parser, the model answer and the answer key all
 * read. A function that is here is offered by the question form, validated on
 * arrival, applied by the editor, shown in the worked answer and marked —
 * without any of those needing to be edited. `SKILL.md` in
 * `.claude/skills/editor-functions/` is the procedure for adding one.
 *
 * The catalog is typed as one entry per member of `WordOperation`, so a new
 * operation that has no entry — or an entry for an operation that does not
 * exist — is a compile error rather than a question that silently does nothing.
 */

/* -- Shorthands ------------------------------------------------------------ */

type Op<K extends WordOperation['kind']> = Extract<WordOperation, { kind: K }>;

/** A plain on/off mark: bold, italic, hidden. */
function toggle<K extends WordOperation['kind']>(
  id: K,
  label: string,
  category: FunctionCategory,
  mark: MarkName,
  answer: AnswerContribution,
  described: string,
): DocFunction<Op<K>> {
  return {
    // The narrowing `Op<K>['kind']` cannot be proven equal to `K` for a generic
    // K, though it is for every concrete one. The call sites are all literals.
    id: id as Op<K>['kind'],
    label,
    category,
    level: 'character',
    params: [],
    answer: () => answer,
    criteria: (_operation, { target, subject }) => [
      { kind: 'marked', label: `${subject} is ${described}`, target, mark },
    ],
    licences: () => ({ marks: [mark] }),
    describe: () => label,
  };
}

/* -- Font ------------------------------------------------------------------ */

const bold = toggle('bold', 'Bold', 'font', 'bold', { marks: [{ type: 'bold' }] }, 'bold');
const italic = toggle('italic', 'Italic', 'font', 'italic', { marks: [{ type: 'italic' }] }, 'italic');
const strike = toggle(
  'strike',
  'Strikethrough',
  'font',
  'strike',
  { marks: [{ type: 'strike' }] },
  'struck through',
);
const doubleStrike = toggle(
  'doubleStrike',
  'Double strikethrough',
  'font',
  'doubleStrike',
  { textStyle: { doubleStrike: true } },
  'struck through twice',
);
const superscript = toggle(
  'superscript',
  'Superscript',
  'font',
  'superscript',
  { marks: [{ type: 'superscript' }] },
  'superscript',
);
const subscript = toggle(
  'subscript',
  'Subscript',
  'font',
  'subscript',
  { marks: [{ type: 'subscript' }] },
  'subscript',
);
const hidden = toggle('hidden', 'Hidden', 'font', 'hidden', { textStyle: { hidden: true } }, 'hidden');

/**
 * Plain underline — the button itself.
 *
 * Applied as the `single` style rather than as a bare mark, so "underline it"
 * and "underline it with a single line" are the same document and the same key.
 */
const underline: DocFunction<Op<'underline'>> = {
  id: 'underline',
  label: 'Underline',
  category: 'font',
  level: 'character',
  params: [],
  // A bare mark: `single` is what an underline is when nothing else is said,
  // and the schema fills the attribute in. Writing it out would make "underline
  // it" and "underline it, single" two different documents.
  answer: () => ({ marks: [{ type: 'underline' }] }),
  criteria: (_operation, { target, subject }) => [
    { kind: 'marked', label: `${subject} is underlined`, target, mark: 'underline' },
  ],
  /*
   * Only the underline itself. A candidate who reached for a wavy line, or
   * coloured it, did something the question did not ask for — which is what the
   * closing `unchanged` criterion is there to catch.
   */
  licences: () => ({ marks: ['underline'] }),
  describe: () => 'Underline',
};

/** The underline drop-down: a style, and optionally a colour. */
const underlineStyle: DocFunction<Op<'underlineStyle'>> = {
  id: 'underlineStyle',
  label: 'Underline style',
  category: 'font',
  level: 'character',
  params: [
    {
      name: 'style',
      label: 'Style',
      type: 'enum',
      options: UNDERLINE_STYLES.map((entry) => ({ value: entry.value, label: entry.label })),
      default: 'double',
    },
    { name: 'color', label: 'Underline colour', type: 'colour', default: '#000000' },
  ],
  answer: (operation) => ({
    marks: [{ type: 'underline', attrs: { style: operation.style, color: operation.color ?? null } }],
  }),
  criteria: (operation, { target, subject }) => {
    const style = underlineStyleLabel(operation.style).toLowerCase();
    const criteria: Criterion[] = [
      {
        kind: 'marked',
        label: `${subject} has a ${style} underline`,
        target,
        mark: 'underlineStyle',
        value: operation.style,
      },
    ];

    if (operation.color) {
      criteria.push({
        kind: 'marked',
        label: `The underline is ${colourName(operation.color)}`,
        target,
        mark: 'underlineColor',
        value: acceptedColours(operation.color),
      });
    }
    return criteria;
  },
  licences: () => ({ marks: ['underline', 'underlineStyle', 'underlineColor'] }),
  describe: (operation) =>
    `${underlineStyleLabel(operation.style)} underline${operation.color ? ` in ${colourName(operation.color)}` : ''}`,
};

const highlight: DocFunction<Op<'highlight'>> = {
  id: 'highlight',
  label: 'Highlight colour',
  category: 'font',
  level: 'character',
  params: [{ name: 'color', label: 'Colour', type: 'colour', default: '#ffff00' }],
  answer: (operation) => ({ marks: [{ type: 'highlight', attrs: { color: operation.color } }] }),
  criteria: (operation, { target, subject }) => [
    {
      kind: 'marked',
      label: `${subject} is highlighted ${colourName(operation.color)}`,
      target,
      mark: 'highlight',
      value: acceptedColours(operation.color),
    },
  ],
  licences: () => ({ marks: ['highlight'] }),
  describe: (operation) => `Highlight ${colourName(operation.color)}`,
};

const fontColor: DocFunction<Op<'fontColor'>> = {
  id: 'fontColor',
  label: 'Font colour',
  category: 'font',
  level: 'character',
  params: [{ name: 'color', label: 'Colour', type: 'colour', default: '#ff0000' }],
  answer: (operation) => ({ textStyle: { color: operation.color } }),
  criteria: (operation, { target, subject }) => [
    {
      kind: 'marked',
      label: `${subject} is ${colourName(operation.color)}`,
      target,
      // The editor calls it `color`; the ribbon calls it Font Colour.
      mark: 'color',
      value: acceptedColours(operation.color),
    },
  ],
  licences: () => ({ marks: ['color'] }),
  describe: (operation) => `Font colour ${colourName(operation.color)}`,
};

const fontFamily: DocFunction<Op<'fontFamily'>> = {
  id: 'fontFamily',
  label: 'Font',
  category: 'font',
  level: 'character',
  params: [{ name: 'family', label: 'Font', type: 'text', maxLength: 100, default: '' }],
  answer: (operation) => ({ textStyle: { fontFamily: operation.family } }),
  criteria: (operation, { target, subject }) => [
    {
      kind: 'marked',
      label: `${subject} is in ${operation.family}`,
      target,
      mark: 'fontFamily',
      value: operation.family,
    },
  ],
  licences: () => ({ marks: ['fontFamily'] }),
  describe: (operation) => `Font ${operation.family}`,
};

const fontSize: DocFunction<Op<'fontSize'>> = {
  id: 'fontSize',
  label: 'Font size',
  category: 'font',
  level: 'character',
  params: [{ name: 'size', label: 'Size', type: 'number', min: 1, max: 1638, step: 0.5, unit: 'pt', default: 14 }],
  // The editor stores a size with its unit; the ribbon box shows the number.
  answer: (operation) => ({ textStyle: { fontSize: `${operation.size}pt` } }),
  criteria: (operation, { target, subject }) => [
    {
      kind: 'marked',
      label: `${subject} is ${operation.size} pt`,
      target,
      // A number, not "15pt": the projection canonicalises sizes to points.
      mark: 'fontSize',
      value: operation.size,
    },
  ],
  licences: () => ({ marks: ['fontSize'] }),
  describe: (operation) => `Font size ${operation.size} pt`,
};

const caps: DocFunction<Op<'caps'>> = {
  id: 'caps',
  label: 'Small caps / All caps',
  category: 'font',
  level: 'character',
  params: [
    {
      name: 'caps',
      label: 'Capitals',
      type: 'enum',
      options: [
        { value: 'small', label: 'Small caps' },
        { value: 'all', label: 'All caps' },
      ],
      default: 'small',
    },
  ],
  answer: (operation) => ({ textStyle: { caps: operation.caps } }),
  criteria: (operation, { target, subject }) => [
    {
      kind: 'marked',
      label: `${subject} is in ${operation.caps === 'small' ? 'small capitals' : 'all capitals'}`,
      target,
      mark: 'caps',
      value: operation.caps,
    },
  ],
  licences: () => ({ marks: ['caps'] }),
  describe: (operation) => (operation.caps === 'small' ? 'Small caps' : 'All caps'),
};

const effect: DocFunction<Op<'effect'>> = {
  id: 'effect',
  label: 'Emboss / Engrave',
  category: 'font',
  level: 'character',
  params: [
    {
      name: 'effect',
      label: 'Effect',
      type: 'enum',
      options: [
        { value: 'emboss', label: 'Emboss' },
        { value: 'engrave', label: 'Engrave' },
      ],
      default: 'emboss',
    },
  ],
  answer: (operation) => ({ textStyle: { effect: operation.effect } }),
  criteria: (operation, { target, subject }) => [
    {
      kind: 'marked',
      label: `${subject} is ${operation.effect}ed`,
      target,
      mark: operation.effect,
    },
  ],
  licences: (operation) => ({ marks: [operation.effect] }),
  describe: (operation) => (operation.effect === 'emboss' ? 'Emboss' : 'Engrave'),
};

const charScale: DocFunction<Op<'charScale'>> = {
  id: 'charScale',
  label: 'Character scale',
  category: 'font',
  level: 'character',
  params: [{ name: 'scale', label: 'Scale', type: 'number', min: 1, max: 600, step: 1, unit: '%', default: 150 }],
  answer: (operation) => ({ textStyle: { charScale: operation.scale } }),
  criteria: (operation, { target, subject }) => [
    {
      kind: 'marked',
      label: `${subject} is scaled to ${operation.scale}%`,
      target,
      mark: 'charScale',
      value: operation.scale,
    },
  ],
  licences: () => ({ marks: ['charScale'] }),
  describe: (operation) => `Scale ${operation.scale}%`,
};

const charSpacing: DocFunction<Op<'charSpacing'>> = {
  id: 'charSpacing',
  label: 'Character spacing',
  category: 'font',
  level: 'character',
  params: [
    { name: 'points', label: 'Spacing', type: 'number', min: -20, max: 20, step: 0.1, unit: 'pt', default: 1 },
  ],
  answer: (operation) => ({ textStyle: { charSpacing: operation.points } }),
  criteria: (operation, { target, subject }) => [
    {
      kind: 'marked',
      label: `${subject} is ${operation.points < 0 ? 'condensed' : 'expanded'} by ${Math.abs(operation.points)} pt`,
      target,
      mark: 'charSpacing',
      value: operation.points,
    },
  ],
  licences: () => ({ marks: ['charSpacing'] }),
  describe: (operation) =>
    `${operation.points < 0 ? 'Condensed' : 'Expanded'} by ${Math.abs(operation.points)} pt`,
};

/* -- Paragraph ------------------------------------------------------------- */

const align: DocFunction<Op<'align'>> = {
  id: 'align',
  label: 'Alignment',
  category: 'paragraph',
  level: 'paragraph',
  params: [
    {
      name: 'align',
      label: 'Alignment',
      type: 'enum',
      options: [
        { value: 'left', label: 'Left' },
        { value: 'center', label: 'Centre' },
        { value: 'right', label: 'Right' },
        { value: 'justify', label: 'Justified' },
      ],
      default: 'center',
    },
  ],
  answer: (operation) => ({ attrs: { textAlign: operation.align } }),
  criteria: (operation, { block }) => [
    {
      kind: 'blockAttr',
      label: `The paragraph is ${operation.align === 'justify' ? 'justified' : `${operation.align}-aligned`}`,
      block,
      attr: 'align',
      value: operation.align,
    },
  ],
  licences: () => ({ paragraph: ['align'] }),
  describe: (operation) => `Align ${operation.align}`,
};

const lineHeight: DocFunction<Op<'lineHeight'>> = {
  id: 'lineHeight',
  label: 'Line spacing',
  category: 'paragraph',
  level: 'paragraph',
  params: [{ name: 'value', label: 'Multiple', type: 'number', min: 0.5, max: 10, step: 0.05, default: 2 }],
  answer: (operation) => ({ attrs: { lineHeight: operation.value } }),
  criteria: (operation, { block }) => [
    {
      kind: 'blockAttr',
      label: `The line spacing is ${operation.value.toFixed(1)}`,
      block,
      attr: 'lineHeight',
      value: operation.value,
    },
  ],
  licences: () => ({ paragraph: ['lineHeight', 'lineSpacingMode'] }),
  describe: (operation) => `Line spacing ${operation.value.toFixed(2).replace(/\.?0+$/, '')}`,
};

/**
 * The Paragraph dialog's At least / Exactly.
 *
 * Two properties move together — the mode and the measurement — so this is one
 * function rather than two that could be stored in a combination the dialog
 * cannot produce.
 */
const lineSpacingAt: DocFunction<Op<'lineSpacingAt'>> = {
  id: 'lineSpacingAt',
  label: 'Line spacing (at least / exactly)',
  category: 'paragraph',
  level: 'paragraph',
  params: [
    {
      name: 'mode',
      label: 'Line spacing',
      type: 'enum',
      options: [
        { value: 'atLeast', label: 'At least' },
        { value: 'exactly', label: 'Exactly' },
      ],
      default: 'exactly',
    },
    { name: 'points', label: 'At', type: 'number', min: 1, max: 1584, step: 0.5, unit: 'pt', default: 18 },
  ],
  answer: (operation) => ({
    attrs: { lineSpacingMode: operation.mode, lineSpacingPt: operation.points, lineHeight: null },
  }),
  criteria: (operation, { block }) => [
    {
      kind: 'blockAttr',
      label: `The line spacing is ${operation.mode === 'atLeast' ? 'at least' : 'exactly'} ${operation.points} pt`,
      block,
      attr: 'lineSpacingPt',
      value: operation.points,
    },
    {
      kind: 'blockAttr',
      label: `The line spacing is set to "${operation.mode === 'atLeast' ? 'At least' : 'Exactly'}"`,
      block,
      attr: 'lineSpacingMode',
      value: operation.mode,
    },
  ],
  licences: () => ({ paragraph: ['lineSpacingMode', 'lineSpacingPt', 'lineHeight'] }),
  describe: (operation) =>
    `Line spacing ${operation.mode === 'atLeast' ? 'at least' : 'exactly'} ${operation.points} pt`,
};

const indent: DocFunction<Op<'indent'>> = {
  id: 'indent',
  label: 'Indent (levels)',
  category: 'paragraph',
  level: 'paragraph',
  params: [{ name: 'levels', label: 'Levels', type: 'number', min: 1, max: 10, step: 1, default: 1 }],
  answer: (operation) => ({ attrs: { indentLeft: operation.levels * INDENT_STEP_PX } }),
  criteria: (operation, { block }) => [
    {
      kind: 'blockAttr',
      label: `The paragraph is indented by ${operation.levels} level${operation.levels === 1 ? '' : 's'}`,
      block,
      attr: 'indentLeft',
      value: operation.levels * INDENT_STEP_PX,
    },
  ],
  licences: () => ({ paragraph: ['indentLeft'] }),
  describe: (operation) => `Indent ${operation.levels} level${operation.levels === 1 ? '' : 's'}`,
};

/**
 * An indent, in whichever unit the question was written in.
 *
 * Word's boxes show centimetres in most of the world and inches in some of it,
 * and the papers are written both ways — "set the left indent to 1.1 inches".
 * The measurement is stored as the question states it and converted once, here,
 * so the number the admin typed is the number the feedback quotes back.
 */
const indentLeft: DocFunction<Op<'indentLeft'>> = {
  id: 'indentLeft',
  label: 'Left indent',
  category: 'paragraph',
  level: 'paragraph',
  params: [
    { name: 'cm', label: 'Left', type: 'number', min: 0, max: 20, step: 0.05, unit: 'cm / in', default: 1 },
    {
      name: 'unit',
      label: 'Unit',
      type: 'enum',
      options: [
        { value: 'cm', label: 'Centimetres' },
        { value: 'inch', label: 'Inches' },
      ],
      default: 'cm',
    },
  ],
  answer: (operation) => ({ attrs: { indentLeft: lengthToPx(operation.cm, operation.unit ?? 'cm') } }),
  criteria: (operation, { block }) => [
    {
      kind: 'blockAttr',
      label: `The left indent is ${measure(operation.cm, operation.unit)}`,
      block,
      attr: 'indentLeft',
      value: lengthToPx(operation.cm, operation.unit ?? 'cm'),
    },
  ],
  licences: () => ({ paragraph: ['indentLeft'] }),
  describe: (operation) => `Left indent ${measure(operation.cm, operation.unit)}`,
};

/** "1.1 inches", "2.5 cm" — the measurement as the question stated it. */
function measure(value: number, unit: LengthUnit | undefined): string {
  return unit === 'inch' ? `${value}"` : `${value} cm`;
}

const indentRight: DocFunction<Op<'indentRight'>> = {
  id: 'indentRight',
  label: 'Right indent',
  category: 'paragraph',
  level: 'paragraph',
  params: [
    { name: 'cm', label: 'Right', type: 'number', min: 0, max: 20, step: 0.05, unit: 'cm / in', default: 1 },
    {
      name: 'unit',
      label: 'Unit',
      type: 'enum',
      options: [
        { value: 'cm', label: 'Centimetres' },
        { value: 'inch', label: 'Inches' },
      ],
      default: 'cm',
    },
  ],
  answer: (operation) => ({ attrs: { indentRight: lengthToPx(operation.cm, operation.unit ?? 'cm') } }),
  criteria: (operation, { block }) => [
    {
      kind: 'blockAttr',
      label: `The right indent is ${measure(operation.cm, operation.unit)}`,
      block,
      attr: 'indentRight',
      value: lengthToPx(operation.cm, operation.unit ?? 'cm'),
    },
  ],
  licences: () => ({ paragraph: ['indentRight'] }),
  describe: (operation) => `Right indent ${measure(operation.cm, operation.unit)}`,
};

/** First line / Hanging: one control in Word, and one function here. */
const firstLineIndent: DocFunction<Op<'firstLineIndent'>> = {
  id: 'firstLineIndent',
  label: 'Special indent (first line / hanging)',
  category: 'paragraph',
  level: 'paragraph',
  params: [
    {
      name: 'special',
      label: 'Special',
      type: 'enum',
      options: [
        { value: 'firstLine', label: 'First line' },
        { value: 'hanging', label: 'Hanging' },
      ],
      default: 'firstLine',
    },
    { name: 'cm', label: 'By', type: 'number', min: 0, max: 20, step: 0.05, unit: 'cm / in', default: 1.27 },
    {
      name: 'unit',
      label: 'Unit',
      type: 'enum',
      options: [
        { value: 'cm', label: 'Centimetres' },
        { value: 'inch', label: 'Inches' },
      ],
      default: 'cm',
    },
  ],
  // A hanging indent is a negative first-line indent, which is how the model
  // and CSS both express it.
  answer: (operation) => ({ attrs: { indentFirstLine: firstLinePx(operation) } }),
  criteria: (operation, { block }) => [
    {
      kind: 'blockAttr',
      label: `The paragraph has a ${operation.special === 'hanging' ? 'hanging' : 'first-line'} indent of ${measure(operation.cm, operation.unit)}`,
      block,
      attr: 'indentFirstLine',
      value: firstLinePx(operation),
    },
  ],
  licences: () => ({ paragraph: ['indentFirstLine'] }),
  describe: (operation) =>
    `${operation.special === 'hanging' ? 'Hanging' : 'First line'} indent ${measure(operation.cm, operation.unit)}`,
};

function firstLinePx(operation: Op<'firstLineIndent'>): number {
  const px = lengthToPx(operation.cm, operation.unit ?? 'cm');
  return operation.special === 'hanging' ? -px : px;
}

const spaceBefore: DocFunction<Op<'spaceBefore'>> = {
  id: 'spaceBefore',
  label: 'Space before',
  category: 'paragraph',
  level: 'paragraph',
  params: [{ name: 'points', label: 'Before', type: 'number', min: 0, max: 1584, step: 1, unit: 'pt', default: 12 }],
  answer: (operation) => ({ attrs: { spaceBefore: pointsToPx(operation.points) } }),
  criteria: (operation, { block }) => [
    {
      kind: 'blockAttr',
      label: `There is ${operation.points} pt of space before the paragraph`,
      block,
      attr: 'spaceBefore',
      value: pointsToPx(operation.points),
    },
  ],
  licences: () => ({ paragraph: ['spaceBefore'] }),
  describe: (operation) => `Space before ${operation.points} pt`,
};

const spaceAfter: DocFunction<Op<'spaceAfter'>> = {
  id: 'spaceAfter',
  label: 'Space after',
  category: 'paragraph',
  level: 'paragraph',
  params: [{ name: 'points', label: 'After', type: 'number', min: 0, max: 1584, step: 1, unit: 'pt', default: 12 }],
  answer: (operation) => ({ attrs: { spaceAfter: pointsToPx(operation.points) } }),
  criteria: (operation, { block }) => [
    {
      kind: 'blockAttr',
      label: `There is ${operation.points} pt of space after the paragraph`,
      block,
      attr: 'spaceAfter',
      value: pointsToPx(operation.points),
    },
  ],
  licences: () => ({ paragraph: ['spaceAfter'] }),
  describe: (operation) => `Space after ${operation.points} pt`,
};

const contextualSpacing: DocFunction<Op<'contextualSpacing'>> = {
  id: 'contextualSpacing',
  label: "Don't add space between paragraphs of the same style",
  category: 'paragraph',
  level: 'paragraph',
  params: [],
  answer: () => ({ attrs: { contextualSpacing: true } }),
  criteria: (_operation, { block }) => [
    {
      kind: 'blockAttr',
      label: 'Space between paragraphs of the same style is turned off',
      block,
      attr: 'contextualSpacing',
      value: true,
    },
  ],
  licences: () => ({ paragraph: ['contextualSpacing'] }),
  describe: () => 'No space between same-style paragraphs',
};

const EDGES: Record<Op<'border'>['edge'], ParagraphBorders> = {
  top: { top: true, bottom: false, left: false, right: false },
  bottom: { top: false, bottom: true, left: false, right: false },
  left: { top: false, bottom: false, left: true, right: false },
  right: { top: false, bottom: false, left: false, right: true },
  all: { top: true, bottom: true, left: true, right: true },
};

/**
 * Black is Word's automatic border colour, and an automatic border carries no
 * colour of its own — so it is left off rather than written out, and a question
 * that never mentions colour compares equal to a candidate who never set one.
 */
function borderValue(operation: Op<'border'>): ParagraphBorders {
  const edges = EDGES[operation.edge];
  return operation.color && operation.color !== '#000000' ? { ...edges, color: operation.color } : edges;
}

const border: DocFunction<Op<'border'>> = {
  id: 'border',
  label: 'Paragraph border',
  category: 'paragraph',
  level: 'paragraph',
  params: [
    {
      name: 'edge',
      label: 'Border',
      type: 'enum',
      options: [
        { value: 'all', label: 'All borders' },
        { value: 'top', label: 'Top border' },
        { value: 'bottom', label: 'Bottom border' },
        { value: 'left', label: 'Left border' },
        { value: 'right', label: 'Right border' },
      ],
      default: 'all',
    },
    { name: 'color', label: 'Border colour', type: 'colour', default: '#000000' },
  ],
  answer: (operation) => ({ attrs: { borders: borderValue(operation) } }),
  criteria: (operation, { block }) => [
    {
      kind: 'blockAttr',
      label:
        (operation.edge === 'all'
          ? 'The paragraph has a border on all four sides'
          : `The paragraph has a ${operation.edge} border`) +
        (operation.color && operation.color !== '#000000' ? `, in ${colourName(operation.color)}` : ''),
      block,
      attr: 'borders',
      value: borderValue(operation),
    },
  ],
  licences: () => ({ paragraph: ['borders'] }),
  describe: (operation) =>
    `${operation.edge === 'all' ? 'All borders' : `${operation.edge} border`}${
      operation.color && operation.color !== '#000000' ? ` in ${colourName(operation.color)}` : ''
    }`,
};

/* -- Styles and lists ------------------------------------------------------ */

const STYLE_LABELS: Record<NormalizedStyleId, string> = {
  Normal: 'Normal',
  NoSpacing: 'No Spacing',
  Heading1: 'Heading 1',
  Heading2: 'Heading 2',
  Heading3: 'Heading 3',
  Title: 'Title',
  Subtitle: 'Subtitle',
  Quote: 'Quote',
};

function styleLabel(style: NormalizedStyleId): string {
  return STYLE_LABELS[style] ?? style;
}

const paragraphStyle: DocFunction<Op<'paragraphStyle'>> = {
  id: 'paragraphStyle',
  label: 'Paragraph style',
  category: 'styles',
  level: 'paragraph',
  params: [
    {
      name: 'style',
      label: 'Style',
      type: 'enum',
      options: (Object.keys(STYLE_LABELS) as NormalizedStyleId[]).map((id) => ({
        value: id,
        label: styleLabel(id),
      })),
      default: 'Heading1',
    },
  ],
  /*
   * A style is a node type, not an attribute, so the model answer carries the
   * style id and `modelAnswerDocument` turns it into the heading, quote or
   * named paragraph it stands for — the same three representations
   * `setParagraphStyle` switches between in the editor.
   */
  answer: (operation) => ({ attrs: { styleId: operation.style } }),
  criteria: (operation, { block }) => [
    {
      kind: 'blockStyle',
      label: `The paragraph is in the ${styleLabel(operation.style)} style`,
      block,
      styleId: operation.style,
    },
  ],
  licences: () => ({ style: true }),
  describe: (operation) => `${styleLabel(operation.style)} style`,
};

const list: DocFunction<Op<'list'>> = {
  id: 'list',
  label: 'Bullets / Numbering',
  category: 'lists',
  level: 'paragraph',
  params: [
    {
      name: 'list',
      label: 'List',
      type: 'enum',
      options: [
        { value: 'bullet', label: 'Bulleted' },
        { value: 'ordered', label: 'Numbered' },
      ],
      default: 'bullet',
    },
  ],
  answer: (operation) => ({ attrs: { list: operation.list } }),
  criteria: (operation, { block }) => [
    {
      kind: 'listKind',
      label: `The paragraph is a ${operation.list === 'bullet' ? 'bulleted' : 'numbered'} list`,
      block,
      listKind: operation.list,
    },
  ],
  licences: () => ({ list: true }),
  describe: (operation) => (operation.list === 'bullet' ? 'Bulleted list' : 'Numbered list'),
};


/* -- Rewriting and removing ------------------------------------------------ */

/**
 * Replace a word wherever it appears.
 *
 * The only function that changes the passage's *wording*. That makes it the
 * only one whose question cannot close with "and nothing else changed" — the
 * comparison `unchanged` makes is character by character against the starting
 * document, and the starting document no longer exists once a word has been
 * replaced. `rewritesText` is how the rubric builder knows to leave it out, and
 * the criteria below are what stands in its place: the new word is there, the
 * old one is gone, and it happened the right number of times.
 */
const replaceText: DocFunction<Op<'replaceText'>> = {
  id: 'replaceText',
  label: 'Replace a word',
  category: 'font',
  level: 'paragraph',
  rewritesText: true,
  params: [
    { name: 'find', label: 'Replace', type: 'text', maxLength: 200, default: '' },
    { name: 'replacement', label: 'With', type: 'text', maxLength: 200, default: '' },
  ],
  // Carried to the renderer, which rewrites the passage before the formatting
  // of later steps is applied to it — the same order the candidate works in.
  answer: (operation) => ({
    attrs: { replaceFind: operation.find, replaceWith: operation.replacement },
  }),
  criteria: (operation) => [
    {
      kind: 'text',
      label: `"${operation.find}" has been replaced with "${operation.replacement}"`,
      expect: { contains: operation.replacement, notContains: operation.find },
    },
  ],
  licences: () => ({}),
  describe: (operation) => `Replace "${operation.find}" with "${operation.replacement}"`,
};

/** A formatting property taken off again. */
function removal<K extends WordOperation['kind']>(
  id: K,
  label: string,
  mark: MarkName,
  described: string,
  answer: AnswerContribution,
): DocFunction<Op<K>> {
  return {
    id: id as Op<K>['kind'],
    label,
    category: 'font',
    level: 'character',
    params: [],
    answer: () => answer,
    criteria: (_operation, { target, subject }) => [
      { kind: 'notMarked', label: `${subject} is no longer ${described}`, target, mark },
    ],
    // The property is licensed so removing it is not "a change that was not
    // asked for" — it is the change that was asked for.
    licences: () => ({ marks: [mark] }),
    describe: () => label,
  };
}

const removeFontColor = removal('removeFontColor', 'Remove the font colour', 'color', 'coloured', {
  textStyle: { color: null },
});

const removeHighlight = removal('removeHighlight', 'Remove the highlight', 'highlight', 'highlighted', {
  marks: [{ type: 'highlight', attrs: { color: null } }],
});

const removeUnderline = removal('removeUnderline', 'Remove the underline', 'underline', 'underlined', {
  marks: [{ type: 'underline', attrs: { remove: true } }],
});

const clearFormatting: DocFunction<Op<'clearFormatting'>> = {
  id: 'clearFormatting',
  label: 'Clear all formatting',
  category: 'font',
  level: 'character',
  params: [],
  answer: () => ({ marks: [] }),
  criteria: (_operation, { target, subject }) => [
    { kind: 'plain', label: `${subject} carries no formatting`, target },
  ],
  /*
   * Everything, because clearing is allowed to have removed anything. The
   * `plain` criterion above is what makes this strict rather than a free pass:
   * it fails on any formatting that is still there.
   */
  licences: () => ({
    marks: [
      'bold',
      'italic',
      'underline',
      'underlineStyle',
      'underlineColor',
      'strike',
      'doubleStrike',
      'caps',
      'hidden',
      'superscript',
      'subscript',
      'fontFamily',
      'fontSize',
      'color',
      'highlight',
      'emboss',
      'engrave',
      'charScale',
      'charSpacing',
    ],
  }),
  describe: () => 'Clear formatting',
};

/** "Highlight it in any colour, but not yellow." */
const highlightAny: DocFunction<Op<'highlightAny'>> = {
  id: 'highlightAny',
  label: 'Highlight, any colour',
  category: 'font',
  level: 'character',
  params: [{ name: 'except', label: 'But not', type: 'colour', default: '#ffff00' }],
  // The worked answer has to show *a* colour, and green is the one Word's
  // gallery offers next to yellow. Which one is shown is not what is marked.
  answer: (operation) => ({
    marks: [
      {
        type: 'highlight',
        attrs: { color: (operation.except ?? '').toLowerCase() === '#00ff00' ? '#00ffff' : '#00ff00' },
      },
    ],
  }),
  criteria: (operation, { target, subject }) => [
    {
      kind: 'marked',
      label: operation.except
        ? `${subject} is highlighted in a colour other than ${colourName(operation.except)}`
        : `${subject} is highlighted`,
      target,
      mark: 'highlight',
      ...(operation.except ? { not: [operation.except.toLowerCase()] } : {}),
    },
  ],
  licences: () => ({ marks: ['highlight'] }),
  describe: (operation) =>
    operation.except ? `Highlight, but not ${colourName(operation.except)}` : 'Highlight, any colour',
};

/* -- The catalog ----------------------------------------------------------- */


/**
 * Every Word function, by id.
 *
 * The mapped type is the guard rail: one entry per `WordOperation` member, no
 * more and no fewer, checked by the compiler.
 */
export const WORD_FUNCTIONS: { [K in WordOperation['kind']]: DocFunction<Op<K>> } = {
  bold,
  italic,
  underline,
  underlineStyle,
  strike,
  doubleStrike,
  superscript,
  subscript,
  highlight,
  fontColor,
  fontFamily,
  fontSize,
  caps,
  hidden,
  effect,
  charScale,
  charSpacing,
  align,
  lineHeight,
  lineSpacingAt,
  indent,
  indentLeft,
  indentRight,
  firstLineIndent,
  spaceBefore,
  spaceAfter,
  contextualSpacing,
  border,
  paragraphStyle,
  list,
  replaceText,
  removeFontColor,
  removeHighlight,
  removeUnderline,
  clearFormatting,
  highlightAny,
};

/** The catalog as a list, in declaration order, for a picker. */
export const WORD_FUNCTION_LIST: DocFunction<WordOperation>[] = Object.values(
  WORD_FUNCTIONS,
) as DocFunction<WordOperation>[];

export function wordFunction<K extends WordOperation['kind']>(kind: K): DocFunction<Op<K>> {
  return WORD_FUNCTIONS[kind];
}

export function isWordFunctionId(value: unknown): value is WordOperation['kind'] {
  return typeof value === 'string' && Object.hasOwn(WORD_FUNCTIONS, value);
}

/** Paragraph formatting reaches the whole block however the question was scoped. */
export function isBlockLevel(operation: WordOperation): boolean {
  return WORD_FUNCTIONS[operation.kind].level === 'paragraph';
}

/** What one operation contributes to the worked answer. */
export function answerOf(operation: WordOperation): AnswerContribution {
  return (WORD_FUNCTIONS[operation.kind].answer as (op: WordOperation) => AnswerContribution)(operation);
}

/** What one operation must have achieved, as the candidate reads it. */
export function criteriaOf(operation: WordOperation, context: CriterionContext): Criterion[] {
  return (WORD_FUNCTIONS[operation.kind].criteria as (op: WordOperation, c: CriterionContext) => Criterion[])(
    operation,
    context,
  );
}

/** The formatting one operation licenses, so `unchanged` allows exactly it. */
export function licencesOf(operation: WordOperation): ReturnType<DocFunction['licences']> {
  return (WORD_FUNCTIONS[operation.kind].licences as (op: WordOperation) => ReturnType<DocFunction['licences']>)(
    operation,
  );
}

/** One line of English naming what the operation does. */
export function describeOperation(operation: WordOperation): string {
  return (WORD_FUNCTIONS[operation.kind].describe as (op: WordOperation) => string)(operation);
}

export type { UnderlineStyle };
