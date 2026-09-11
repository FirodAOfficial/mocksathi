import { formatAddress, parseCellReference, type CellReference } from './address';

/**
 * Rewrites the references in a formula after rows or columns were inserted or
 * deleted somewhere else on the sheet.
 *
 * Different from `translateFormula`, which moves *every* reference by a fixed
 * delta because the formula itself moved. Here the formula may not have moved
 * at all; what changed is the sheet underneath it, so each reference shifts
 * only if it sat at or after the edit:
 *
 * - `=B7` with a row inserted at row 3 becomes `=B8`.
 * - `=B2` with the same edit stays `=B2`.
 * - `=B7` with row 7 deleted becomes `#REF!` — the cell it named is gone, and
 *   silently repointing it at whatever moved up would produce a plausible
 *   wrong number.
 *
 * The text-rewrite approach and the string-literal skipping are inherited from
 * `translateFormula` for the same reason: a formula the parser does not fully
 * understand must still survive the round trip intact.
 */

export interface SheetEdit {
  axis: 'row' | 'column';
  /** Where the insertion or deletion starts, zero-based. */
  at: number;
  /** How many were inserted (positive) or deleted (negative). */
  delta: number;
}

const REFERENCE =
  /(?<![A-Za-z0-9_.$])(?:(?:'[^']+'|[A-Za-z_][A-Za-z0-9_.]*)!)?\$?[A-Za-z]{1,3}\$?[0-9]{1,7}(?![A-Za-z0-9_(])/g;

export function shiftFormula(formula: string, edit: SheetEdit): string {
  if (edit.delta === 0) return formula;

  let output = '';
  let index = 0;

  for (const segment of segments(formula)) {
    output += formula.slice(index, segment.start);
    index = segment.end;

    const text = formula.slice(segment.start, segment.end);
    output += segment.quoted ? text : shiftSegment(text, edit);
  }

  return output + formula.slice(index);
}

function shiftSegment(text: string, edit: SheetEdit): string {
  return text.replace(REFERENCE, (match) => {
    const bang = match.lastIndexOf('!');
    const prefix = bang === -1 ? '' : match.slice(0, bang + 1);
    const body = bang === -1 ? match : match.slice(bang + 1);

    const reference = parseCellReference(body);
    if (!reference) return match;

    const shifted = shiftReference(reference, edit);
    if (!shifted) return '#REF!';

    return prefix + formatAddress(shifted, shifted.anchor);
  });
}

/**
 * One reference after the edit, or `null` when the cell it named was deleted.
 *
 * An absolute reference shifts too. `$B$7` means "row 7 whatever I copy this
 * to", not "row 7 whatever happens to the sheet" — Excel moves it, and a build
 * that did not would break every anchored total the moment a row was added.
 */
function shiftReference(reference: CellReference, edit: SheetEdit): CellReference | null {
  const position = edit.axis === 'row' ? reference.row : reference.col;

  if (position < edit.at) return reference;

  if (edit.delta < 0) {
    const removedThrough = edit.at - edit.delta - 1;
    if (position <= removedThrough) return null;
  }

  const moved = position + edit.delta;
  if (moved < 0) return null;

  return edit.axis === 'row' ? { ...reference, row: moved } : { ...reference, col: moved };
}

/** The stretches of a formula that are *not* inside a string literal. */
function segments(formula: string): Array<{ start: number; end: number; quoted: boolean }> {
  const found: Array<{ start: number; end: number; quoted: boolean }> = [];
  let cursor = 0;
  let inString = false;
  let start = 0;

  while (cursor < formula.length) {
    if (formula[cursor] === '"') {
      found.push({ start, end: inString ? cursor + 1 : cursor, quoted: inString });
      inString = !inString;
      start = cursor;
      if (!inString) start = cursor + 1;
    }

    cursor += 1;
  }

  found.push({ start, end: formula.length, quoted: inString });
  return found;
}
