/**
 * How a question names the text it is about.
 *
 * "Make the third word bold" and "make the paragraph bold" are the same
 * question with a different selection, and until now only the second could be
 * written: a scope was the whole first paragraph or a pair of character offsets
 * someone had measured by hand. Offsets are unreadable in a form, silently
 * wrong when the passage is edited by a word, and impossible to check.
 *
 * A selection is therefore *named* — the 3rd word, the 2nd sentence, the first
 * occurrence of "monsoon" — and resolved against the passage text by the one
 * function here. The same resolution feeds all three consumers, which is what
 * keeps them honest: the model answer formats exactly the characters the
 * marking key looks at, and the editor can select exactly those characters to
 * demonstrate the answer.
 *
 * Resolution is against the passage's *text*, so a selection cannot name a
 * rendered line: where a line wraps depends on the page width and the font, and
 * neither is knowable here. A question about a wrapped line still uses explicit
 * character offsets (`{ from, to }`), measured as `seedAttempt.ts` describes.
 */

/** Which text a question's operations apply to. */
export type SelectionSpec =
  /** The whole passage's first paragraph — what most questions ask about. */
  | 'all'
  /** Character offsets into the first paragraph, for a question naming a wrapped line. */
  | { from: number; to: number }
  /** A whole paragraph, 1-based as the candidate counts them. */
  | { select: 'paragraph'; index: number }
  /** One word, 1-based, of the given paragraph (default the first). */
  | { select: 'word'; index: number; paragraph?: number }
  /** A run of words, 1-based and inclusive: "the second to the fourth word". */
  | { select: 'words'; from: number; to: number; paragraph?: number }
  /** One sentence, 1-based, of the given paragraph. */
  | { select: 'sentence'; index: number; paragraph?: number }
  /**
   * A phrase, by its text.
   *
   * `occurrence` is 1-based and defaults to the first; `'all'` is "wherever it
   * appears in the document", which is how half the Word papers phrase it, and
   * then the selection is every match rather than one range.
   */
  | { select: 'text'; text: string; occurrence?: number | 'all'; paragraph?: number }
  /** Explicit character offsets into a named paragraph. */
  | { select: 'range'; from: number; to: number; paragraph?: number };

/** Every named selector, for a picker and for validation. */
export const SELECTORS = [
  { value: 'all', label: 'The whole paragraph' },
  { value: 'paragraph', label: 'A whole paragraph' },
  { value: 'word', label: 'One word' },
  { value: 'words', label: 'A run of words' },
  { value: 'sentence', label: 'One sentence' },
  { value: 'text', label: 'A phrase, by its text' },
  { value: 'range', label: 'Character offsets' },
] as const;

export type SelectorName = (typeof SELECTORS)[number]['value'];

/** Where a selection lands: a character range within one block. */
export interface ResolvedSelection {
  /** 0-based index into the passage's paragraphs. */
  block: number;
  /** Character offsets within that block, or `whole` for the entire block. */
  from: number;
  to: number;
  /** True when the selection is the block in its entirety. */
  whole: boolean;
}

/** The paragraph a selection is about, 0-based. */
export function selectionBlock(spec: SelectionSpec): number {
  if (spec === 'all' || !('select' in spec)) return 0;
  if (spec.select === 'paragraph') return Math.max(0, spec.index - 1);
  return Math.max(0, (spec.paragraph ?? 1) - 1);
}

/** Word boundaries, as a reader counts words: runs of non-space. */
function words(text: string): { from: number; to: number }[] {
  const found: { from: number; to: number }[] = [];
  const pattern = /\S+/g;
  let match = pattern.exec(text);
  while (match !== null) {
    found.push({ from: match.index, to: match.index + match[0].length });
    match = pattern.exec(text);
  }
  return found;
}

/**
 * Sentence boundaries.
 *
 * A sentence ends at `.`, `!`, `?` or the Devanagari danda `।` — the passages
 * are offered in English and Hindi, and a full stop is not how Hindi ends a
 * sentence. The terminator belongs to the sentence it closes, which is what a
 * candidate selects when asked to select one; trailing space does not.
 */
function sentences(text: string): { from: number; to: number }[] {
  const found: { from: number; to: number }[] = [];
  let start: number | null = null;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]!;
    if (start === null && char.trim() !== '') start = index;
    if (start !== null && (char === '.' || char === '!' || char === '?' || char === '।')) {
      // Run on through a closing quote or bracket, and through "?!".
      let end = index + 1;
      while (end < text.length && /["'”’)\]}.!?।]/.test(text[end]!)) end += 1;
      found.push({ from: start, to: end });
      start = null;
      index = end - 1;
    }
  }

  // Text after the last terminator is still a sentence to a reader.
  if (start !== null) found.push({ from: start, to: text.length });
  return found;
}

/**
 * Where a selection lands in a passage, or null when it names nothing.
 *
 * `lines` is the passage as plain text, one entry per paragraph. Null is a real
 * answer, not a failure to handle: "the 9th word" of a six-word paragraph is a
 * question that cannot be marked, and the admin form refuses it on that basis
 * rather than storing a question whose key addresses no characters.
 */
export function resolveSelection(spec: SelectionSpec, lines: readonly string[]): ResolvedSelection | null {
  return resolveSelections(spec, lines)[0] ?? null;
}

/**
 * Every range a selection names.
 *
 * One for all but `{ select: 'text', occurrence: 'all' }`, which is a phrase
 * wherever it appears — in every paragraph, not just the one the selection
 * would otherwise be pinned to. Callers that can only act on one range use
 * `resolveSelection` and get the first.
 */
export function resolveSelections(spec: SelectionSpec, lines: readonly string[]): ResolvedSelection[] {
  if (typeof spec === 'object' && 'select' in spec && spec.select === 'text' && spec.occurrence === 'all') {
    const found: ResolvedSelection[] = [];

    lines.forEach((line, block) => {
      let at = line.indexOf(spec.text);
      while (at !== -1 && spec.text !== '') {
        found.push({ block, from: at, to: at + spec.text.length, whole: false });
        at = line.indexOf(spec.text, at + spec.text.length);
      }
    });

    return found;
  }

  const one = resolveOne(spec, lines);
  return one ? [one] : [];
}

function resolveOne(spec: SelectionSpec, lines: readonly string[]): ResolvedSelection | null {
  const block = selectionBlock(spec);
  const text = lines[block];
  if (text === undefined) return null;

  const whole = (): ResolvedSelection => ({ block, from: 0, to: text.length, whole: true });
  const range = (from: number, to: number): ResolvedSelection | null =>
    from < 0 || to > text.length || to <= from
      ? null
      : { block, from, to, whole: from === 0 && to === text.length };

  if (spec === 'all') return whole();
  if (!('select' in spec)) return range(spec.from, spec.to);

  switch (spec.select) {
    case 'paragraph':
      return whole();

    case 'word': {
      const found = words(text)[spec.index - 1];
      return found ? range(found.from, found.to) : null;
    }

    case 'words': {
      const all = words(text);
      const first = all[spec.from - 1];
      const last = all[spec.to - 1];
      return first && last && last.to > first.from ? range(first.from, last.to) : null;
    }

    case 'sentence': {
      const found = sentences(text)[spec.index - 1];
      return found ? range(found.from, found.to) : null;
    }

    case 'text': {
      const needle = spec.text;
      if (needle === '') return null;
      let at = -1;
      const wanted = spec.occurrence === 'all' ? 1 : (spec.occurrence ?? 1);
      for (let count = 0; count < wanted; count += 1) {
        at = text.indexOf(needle, at + 1);
        if (at === -1) return null;
      }
      return range(at, at + needle.length);
    }

    case 'range':
      return range(spec.from, spec.to);
  }
}

const ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];

/** "the third word", for a solution step or a criterion label. */
export function ordinal(index: number): string {
  return ORDINALS[index - 1] ?? `${index}th`;
}

/** How the criterion labels and solution steps name the selected text. */
export function describeSelection(spec: SelectionSpec): string {
  if (spec === 'all') return 'The paragraph';
  if (!('select' in spec)) return 'The named line';

  const inParagraph = spec.select !== 'paragraph' && spec.paragraph && spec.paragraph > 1
    ? ` of the ${ordinal(spec.paragraph)} paragraph`
    : '';

  switch (spec.select) {
    case 'paragraph':
      return spec.index === 1 ? 'The paragraph' : `The ${ordinal(spec.index)} paragraph`;
    case 'word':
      return `The ${ordinal(spec.index)} word${inParagraph}`;
    case 'words':
      return `The ${ordinal(spec.from)} to ${ordinal(spec.to)} words${inParagraph}`;
    case 'sentence':
      return `The ${ordinal(spec.index)} sentence${inParagraph}`;
    case 'text':
      return spec.occurrence === 'all' ? `Every "${spec.text}"` : `"${spec.text}"`;
    case 'range':
      return `The named line${inParagraph}`;
  }
}

