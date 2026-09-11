import { formatAddress, parseCellReference, translateReference } from './address';

/**
 * Rewrites the references in a formula that has moved.
 *
 * Copying `=B1+$C$1` from A1 down to A2 must produce `=B2+$C$1`. That is the
 * behaviour every spreadsheet user relies on, and getting it wrong produces
 * numbers that are plausible and wrong — the worst failure mode available.
 *
 * This is a rewrite over the source text rather than a parse-and-print. The
 * reason is round-tripping: a formula the parser does not fully understand must
 * still come out the other side intact, and re-printing from a partial parse
 * would quietly reshape it. The cost is that the scanner has to know where
 * references are *not*, which is what the two skips below are for.
 */

/**
 * A1-style reference, optionally sheet-qualified and dollar-anchored.
 *
 * The two assertions around it are the whole difficulty. Without the
 * lookbehind, `LOG10(A1)` matches `LOG10` and becomes `LOG11` — a function
 * renamed into nonsense. Without the lookahead, any three-letter function with
 * a digit in its name would go the same way. Both were found by the tests
 * below rather than by reading the pattern, which is why they are pinned there.
 */
const REFERENCE =
  /(?<![A-Za-z0-9_.$])(?:(?:'[^']+'|[A-Za-z_][A-Za-z0-9_.]*)!)?\$?[A-Za-z]{1,3}\$?[0-9]{1,7}(?![A-Za-z0-9_(])/g;

export function translateFormula(formula: string, rowDelta: number, colDelta: number): string {
  if (rowDelta === 0 && colDelta === 0) return formula;

  let output = '';
  let index = 0;

  for (const segment of segments(formula)) {
    output += formula.slice(index, segment.start);
    index = segment.end;

    output += segment.quoted
      ? formula.slice(segment.start, segment.end)
      : translateSegment(formula.slice(segment.start, segment.end), rowDelta, colDelta);
  }

  return output + formula.slice(index);
}

function translateSegment(text: string, rowDelta: number, colDelta: number): string {
  return text.replace(REFERENCE, (match) => {
    // A function call — `SUM(` — never reaches here as a match, but a defined
    // name that happens to look like a reference would. `parseCellReference`
    // rejects anything that is not one, which is the guard.
    const bang = match.lastIndexOf('!');
    const prefix = bang === -1 ? '' : match.slice(0, bang + 1);
    const body = bang === -1 ? match : match.slice(bang + 1);

    const reference = parseCellReference(body);
    if (!reference) return match;

    const moved = translateReference(reference, rowDelta, colDelta);
    // Off the grid is `#REF!` in Excel too. Clamping would change the meaning
    // of the formula without saying so.
    if (!moved) return '#REF!';

    return prefix + formatAddress(moved, moved.anchor);
  });
}

/**
 * The stretches of a formula that are *not* inside a string literal.
 *
 * `="A1 is "&A1` must translate the second `A1` and leave the first alone.
 */
function segments(formula: string): Array<{ start: number; end: number; quoted: boolean }> {
  const found: Array<{ start: number; end: number; quoted: boolean }> = [];
  let cursor = 0;
  let inString = false;
  let start = 0;

  while (cursor < formula.length) {
    const char = formula[cursor];

    if (char === '"') {
      found.push({ start, end: inString ? cursor + 1 : cursor, quoted: inString });
      inString = !inString;
      start = inString ? cursor : cursor + 1;
      if (inString) start = cursor;
    }

    cursor += 1;
  }

  found.push({ start, end: formula.length, quoted: inString });
  return found;
}
