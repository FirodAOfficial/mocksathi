import { colourName } from '@/editor/functions/colours';
import { ordinal } from '@/editor/functions/selection';
import { underlineStyleLabel } from '@/editor/functions/underline';
import type { FlatDocument } from '@/exam/marking/flatten';
import { pxToCm, pxToPoints } from '@/utils/units';
import type { CharacterChange, CharacterStep, DocumentStep, ParagraphChange } from './types';

/**
 * Saying what a detected change is, in the words of the ribbon.
 *
 * Read by three audiences: the admin, who needs to see that what was detected
 * is what they meant to do; the candidate, whose feedback names each thing the
 * question checked; and the solution steps, which default to these sentences
 * when the admin writes none. All three read the same function, so the
 * feedback a candidate gets cannot describe a different operation from the one
 * the admin saw being recorded.
 */

const STYLE_LABELS: Record<string, string> = {
  Normal: 'Normal',
  NoSpacing: 'No Spacing',
  Heading1: 'Heading 1',
  Heading2: 'Heading 2',
  Heading3: 'Heading 3',
  Title: 'Title',
  Subtitle: 'Subtitle',
  Quote: 'Quote',
};

const ALIGN_LABELS: Record<string, string> = {
  left: 'Align left',
  center: 'Centre',
  right: 'Align right',
  justify: 'Justify',
};

function removed(value: unknown): boolean {
  return value === null || value === false || value === undefined;
}

/** One character change: "Bold", "Highlight yellow", "Remove font colour". */
export function describeCharacterChange(change: Pick<CharacterChange, 'property' | 'value' | 'previous'>): string {
  const { property, value, previous } = change;
  const off = removed(value);

  switch (property) {
    case 'bold':
      return off ? 'Remove bold' : 'Bold';
    case 'italic':
      return off ? 'Remove italic' : 'Italic';
    case 'underline':
      return off ? 'Remove underline' : 'Underline';
    case 'underlineStyle':
      return off ? 'Single underline' : `${underlineStyleLabel(value as never)} underline`;
    case 'underlineColor':
      return off ? 'Automatic underline colour' : `Underline colour ${colourName(String(value))}`;
    case 'strike':
      return off ? 'Remove strikethrough' : 'Strikethrough';
    case 'doubleStrike':
      return off ? 'Remove double strikethrough' : 'Double strikethrough';
    case 'caps':
      return off ? 'Remove caps' : value === 'small' ? 'Small caps' : 'All caps';
    case 'hidden':
      return off ? 'Unhide' : 'Hidden';
    case 'vertAlign':
      if (off) return previous === 'sub' ? 'Remove subscript' : 'Remove superscript';
      return value === 'sub' ? 'Subscript' : 'Superscript';
    case 'fontFamily':
      return off ? 'Default font' : `Font ${String(value)}`;
    case 'fontSize':
      return off ? 'Default font size' : `Font size ${String(value)} pt`;
    case 'color':
      return off ? 'Remove font colour' : `Font colour ${colourName(String(value))}`;
    case 'highlight':
      return off ? 'Remove highlight' : `Highlight ${colourName(String(value))}`;
    case 'effect':
      if (off) return previous === 'engrave' ? 'Remove engrave' : 'Remove emboss';
      return value === 'engrave' ? 'Engrave' : 'Emboss';
    case 'charScale':
      return off ? 'Scale 100%' : `Scale ${String(value)}%`;
    case 'charSpacing': {
      if (off) return 'Normal character spacing';
      const points = Number(value);
      return points > 0 ? `Character spacing expanded by ${points} pt` : `Character spacing condensed by ${-points} pt`;
    }
    default:
      return String(property);
  }
}

function cm(value: unknown): string {
  return `${pxToCm(Number(value))} cm`;
}

function pt(value: unknown): string {
  return `${pxToPoints(Number(value))} pt`;
}

/** One paragraph change: "Centre", "Left indent 1.27 cm", "Bulleted list". */
export function describeParagraphChange(change: Pick<ParagraphChange, 'property' | 'value' | 'previous'>): string {
  const { property, value } = change;
  const off = removed(value);

  switch (property) {
    case 'styleId':
      return `Style ${STYLE_LABELS[String(value)] ?? String(value)}`;
    case 'list':
      if (off) return 'Remove list';
      return value === 'ordered' ? 'Numbered list' : 'Bulleted list';
    case 'align':
      return off ? 'Default alignment' : (ALIGN_LABELS[String(value)] ?? `Align ${String(value)}`);
    case 'indentLeft':
      return off ? 'Remove left indent' : `Left indent ${cm(value)}`;
    case 'indentRight':
      return off ? 'Remove right indent' : `Right indent ${cm(value)}`;
    case 'indentFirstLine': {
      if (off) return 'Remove first-line indent';
      const amount = Number(value);
      return amount < 0 ? `Hanging indent ${cm(-amount)}` : `First-line indent ${cm(amount)}`;
    }
    case 'lineHeight':
      return off ? 'Default line spacing' : `Line spacing ${String(value)}`;
    case 'lineSpacingMode':
      if (off) return 'Default line spacing rule';
      return value === 'atLeast' ? 'Line spacing "At least"' : value === 'exactly' ? 'Line spacing "Exactly"' : 'Line spacing "Multiple"';
    case 'lineSpacingPt':
      return off ? 'Default line spacing measurement' : `Line spacing at ${String(value)} pt`;
    case 'spaceBefore':
      return off ? 'Default space before' : `Space before ${pt(value)}`;
    case 'spaceAfter':
      return off ? 'Default space after' : `Space after ${pt(value)}`;
    case 'contextualSpacing':
      return off
        ? 'Add space between paragraphs of the same style'
        : "Don't add space between paragraphs of the same style";
    case 'borders': {
      const borders = value as { top?: boolean; bottom?: boolean; left?: boolean; right?: boolean; color?: string } | null;
      const edges = borders ? (['top', 'bottom', 'left', 'right'] as const).filter((edge) => borders[edge]) : [];
      if (edges.length === 0) return 'No border';
      const which = edges.length === 4 ? 'Outside borders' : `Border ${edges.join(', ')}`;
      return borders?.color ? `${which} in ${colourName(borders.color)}` : which;
    }
    default:
      return String(property);
  }
}

/* -- Naming the text ------------------------------------------------------- */

const PUNCTUATION = /["'“”‘’()[\]{}.,;:!?।]/;

/** Word spans in code points, as a reader counts words: runs of non-space. */
function wordSpans(chars: readonly string[]): { from: number; to: number }[] {
  const spans: { from: number; to: number }[] = [];
  let start: number | null = null;
  chars.forEach((char, index) => {
    const space = /\s/.test(char);
    if (!space && start === null) start = index;
    if (space && start !== null) {
      spans.push({ from: start, to: index });
      start = null;
    }
  });
  if (start !== null) spans.push({ from: start, to: chars.length });
  return spans;
}

function blockChars(document: FlatDocument, block: number): string[] {
  const entry = document.blocks[block];
  if (!entry) return [];
  return document.chars.slice(entry.start, entry.end).map((char) => char.char);
}

/** "paragraph 3", or the table cell it sits in. */
export function describeBlock(document: FlatDocument | null, block: number): string {
  const table = document?.blocks[block]?.table;
  if (table) return `the table cell at row ${table.row + 1}, column ${table.column + 1}`;
  return `paragraph ${block + 1}`;
}

/** How a step names its text: "the 3rd word of paragraph 2 (“monsoon”)". */
export function describeRange(document: FlatDocument | null, step: Pick<CharacterStep, 'block' | 'from' | 'to' | 'text'>): string {
  const where = describeBlock(document, step.block);
  if (!document) return `“${step.text}” in ${where}`;

  const chars = blockChars(document, step.block);
  const content = wordSpans(chars);
  const first = content[0];
  const last = content[content.length - 1];
  if (first && last && step.from <= first.from && step.to >= last.to) return `the whole of ${where}`;

  // A word's edges, with and without the punctuation stuck to it: "dog." is
  // the ninth word whether or not the candidate selected the full stop.
  const words = content.map((span, index) => {
    let core = span.to;
    while (core > span.from + 1 && PUNCTUATION.test(chars[core - 1]!)) core -= 1;
    let lead = span.from;
    while (lead < core - 1 && PUNCTUATION.test(chars[lead]!)) lead += 1;
    return { ...span, core, lead, index: index + 1 };
  });
  const start = words.find((word) => word.from === step.from || word.lead === step.from);
  const end = words.find((word) => word.to === step.to || word.core === step.to);
  const quoted = step.text.length > 60 ? `“${step.text.slice(0, 57)}…”` : `“${step.text}”`;

  if (start && end && start.index === end.index) return `the ${ordinal(start.index)} word of ${where} (${quoted})`;
  if (start && end) return `the ${ordinal(start.index)} to ${ordinal(end.index)} words of ${where} (${quoted})`;
  return `${quoted} in ${where}`;
}

function describeBlocks(document: FlatDocument | null, blocks: readonly number[]): string {
  if (blocks.length === 1) return describeBlock(document, blocks[0]!);
  const sorted = [...blocks].sort((a, b) => a - b);
  const consecutive = sorted.every((block, index) => index === 0 || block === sorted[index - 1]! + 1);
  if (consecutive && !sorted.some((block) => document?.blocks[block]?.table)) {
    return `paragraphs ${sorted[0]! + 1}–${sorted[sorted.length - 1]! + 1}`;
  }
  return `paragraphs ${sorted.map((block) => block + 1).join(', ')}`;
}

/** The text a step is about. */
export function describeTarget(document: FlatDocument | null, step: DocumentStep): string {
  return step.level === 'character' ? describeRange(document, step) : describeBlocks(document, step.blocks);
}

/** What a step does: "Bold + Italic". */
export function describeChanges(step: DocumentStep): string {
  return step.level === 'character'
    ? step.changes.map(describeCharacterChange).join(' + ')
    : step.changes.map(describeParagraphChange).join(' + ');
}

/** One line per step: "Bold + Italic — the 3rd word of paragraph 2 (“monsoon”)". */
export function describeStep(document: FlatDocument | null, step: DocumentStep): string {
  return `${describeChanges(step)} — ${describeTarget(document, step)}`;
}

/**
 * A draft instruction for the admin to edit.
 *
 * Never used as-is: the admin writes the question, and this is only a starting
 * point so the instruction and the recorded operation begin in agreement.
 */
export function suggestInstruction(document: FlatDocument | null, steps: readonly DocumentStep[]): string {
  const visible = steps.filter((step) => !step.licenceOnly);
  return visible
    .map((step) => `Apply ${describeChanges(step).toLowerCase()} to ${describeTarget(document, step)}.`)
    .join(' ');
}

/** Solution steps when the admin writes none: select the text, then apply each change. */
export function defaultSolution(document: FlatDocument | null, steps: readonly DocumentStep[]): string[] {
  return steps
    .filter((step) => !step.licenceOnly)
    .flatMap((step) => [`Select ${describeTarget(document, step)}.`, `Apply: ${describeChanges(step)}.`]);
}
