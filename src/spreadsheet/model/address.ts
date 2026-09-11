/**
 * Cell and range addressing.
 *
 * Everything in the engine speaks in zero-based `{ row, col }`; only the A1
 * strings at the edges are one-based. Converting at the boundary rather than
 * carrying both conventions inward is what keeps the off-by-one errors in one
 * file instead of scattered through the grid, the parser and the formula
 * engine.
 *
 * `fast-formula-parser` is the one exception: its callbacks are one-based, so
 * the adapter converts there and nowhere else.
 */

/** Excel's grid: 1,048,576 rows by 16,384 columns (A..XFD). */
export const MAX_ROWS = 1_048_576;
export const MAX_COLUMNS = 16_384;

export interface CellAddress {
  /** Zero-based. */
  row: number;
  /** Zero-based. */
  col: number;
}

/**
 * Which parts of a reference survive being copied elsewhere.
 *
 * `$A$1` is absolute in both; `A$1` pins the row only. The fill handle and
 * paste both need this, so it travels with the address rather than being
 * re-derived from the original text.
 */
export interface ReferenceAnchor {
  colAbsolute: boolean;
  rowAbsolute: boolean;
}

export const RELATIVE: ReferenceAnchor = { colAbsolute: false, rowAbsolute: false };

export interface CellReference extends CellAddress {
  anchor: ReferenceAnchor;
  /** Unqualified references belong to whichever sheet is being evaluated. */
  sheet?: string;
}

export interface RangeAddress {
  start: CellAddress;
  end: CellAddress;
}

export interface RangeReference {
  start: CellReference;
  end: CellReference;
  sheet?: string;
  /**
   * `A:A` and `5:5` select a whole column or row.
   *
   * Stored as a flag rather than as a range ending at row 1,048,575 so that
   * "is this the whole column" stays a cheap question — the alternative makes
   * every consumer compare against MAX_ROWS to find out.
   */
  spans?: 'column' | 'row';
}

/* -- Column labels ------------------------------------------------------- */

const A = 'A'.charCodeAt(0);
const ALPHABET = 26;

/** `0 -> "A"`, `25 -> "Z"`, `26 -> "AA"`, `16383 -> "XFD"`. */
export function columnToLabel(col: number): string {
  if (!Number.isInteger(col) || col < 0 || col >= MAX_COLUMNS) {
    throw new RangeError(`Column ${col} is outside the grid.`);
  }

  // Bijective base-26: there is no zero digit, so each step subtracts one
  // before taking the remainder. Plain base-26 would produce "A@" for 26.
  let label = '';
  let remaining = col;
  while (remaining >= 0) {
    label = String.fromCharCode(A + (remaining % ALPHABET)) + label;
    remaining = Math.floor(remaining / ALPHABET) - 1;
  }
  return label;
}

/** `"A" -> 0`, `"aa" -> 26`. Returns null for anything that is not a label. */
export function labelToColumn(label: string): number | null {
  if (label.length === 0 || label.length > 3) return null;

  let col = 0;
  for (const character of label.toUpperCase()) {
    const digit = character.charCodeAt(0) - A;
    if (digit < 0 || digit >= ALPHABET) return null;
    col = col * ALPHABET + digit + 1;
  }

  const zeroBased = col - 1;
  return zeroBased < MAX_COLUMNS ? zeroBased : null;
}

/* -- Cell addresses ------------------------------------------------------ */

/** `{ row: 0, col: 0 } -> "A1"`. Anchors add the `$` signs back. */
export function formatAddress(address: CellAddress, anchor: ReferenceAnchor = RELATIVE): string {
  const col = `${anchor.colAbsolute ? '$' : ''}${columnToLabel(address.col)}`;
  const row = `${anchor.rowAbsolute ? '$' : ''}${address.row + 1}`;
  return `${col}${row}`;
}

const CELL_PATTERN = /^(\$?)([A-Za-z]{1,3})(\$?)([0-9]{1,7})$/;

/**
 * `"$B$4"` -> `{ row: 3, col: 1, anchor: { colAbsolute: true, rowAbsolute: true } }`.
 *
 * Returns null rather than throwing: this runs against user input on every
 * keystroke in the name box, where "not an address yet" is the normal case and
 * not an error worth an exception.
 */
export function parseCellReference(text: string): CellReference | null {
  const match = CELL_PATTERN.exec(text.trim());
  if (!match) return null;

  const [, colDollar, colLabel, rowDollar, rowDigits] = match;
  const col = labelToColumn(colLabel ?? '');
  if (col === null) return null;

  const row = Number(rowDigits) - 1;
  if (!Number.isInteger(row) || row < 0 || row >= MAX_ROWS) return null;

  return {
    row,
    col,
    anchor: { colAbsolute: colDollar === '$', rowAbsolute: rowDollar === '$' },
  };
}

/* -- Sheet qualification ------------------------------------------------- */

/**
 * Splits `Sheet2!A1` or `'My Sheet'!A1` into its parts.
 *
 * A quoted sheet name escapes its own quote by doubling it, as Excel does:
 * `'Bob''s Sheet'!A1`.
 */
export function splitSheetReference(text: string): { sheet?: string; rest: string } {
  const trimmed = text.trim();

  if (trimmed.startsWith("'")) {
    // Scan for the closing quote, skipping doubled quotes.
    for (let index = 1; index < trimmed.length; index += 1) {
      if (trimmed[index] !== "'") continue;
      if (trimmed[index + 1] === "'") {
        index += 1;
        continue;
      }
      if (trimmed[index + 1] !== '!') break;
      return {
        sheet: trimmed.slice(1, index).replace(/''/g, "'"),
        rest: trimmed.slice(index + 2),
      };
    }
    return { rest: trimmed };
  }

  const bang = trimmed.indexOf('!');
  if (bang === -1) return { rest: trimmed };
  return { sheet: trimmed.slice(0, bang), rest: trimmed.slice(bang + 1) };
}

/** The inverse: quotes the name only when it needs quoting, as Excel does. */
export function formatSheetPrefix(sheet: string): string {
  return /^[A-Za-z_][A-Za-z0-9_.]*$/.test(sheet)
    ? `${sheet}!`
    : `'${sheet.replace(/'/g, "''")}'!`;
}

/* -- Ranges -------------------------------------------------------------- */

const WHOLE_COLUMN = /^(\$?)([A-Za-z]{1,3}):(\$?)([A-Za-z]{1,3})$/;
const WHOLE_ROW = /^(\$?)([0-9]{1,7}):(\$?)([0-9]{1,7})$/;

/**
 * Parses `A1`, `A1:C10`, `A:A`, `5:5`, `Sheet2!A1:B2`.
 *
 * A single cell comes back as a one-cell range, so callers never have to branch
 * on "is this a cell or a range" — the grid, the status bar and the formula
 * engine all want a rectangle either way.
 */
export function parseRangeReference(text: string): RangeReference | null {
  const { sheet, rest } = splitSheetReference(text);
  if (rest.length === 0) return null;

  const wholeColumn = WHOLE_COLUMN.exec(rest);
  if (wholeColumn) {
    const [, startDollar, startLabel, endDollar, endLabel] = wholeColumn;
    const startCol = labelToColumn(startLabel ?? '');
    const endCol = labelToColumn(endLabel ?? '');
    if (startCol === null || endCol === null) return null;

    return normaliseRange({
      start: {
        row: 0,
        col: startCol,
        anchor: { colAbsolute: startDollar === '$', rowAbsolute: false },
      },
      end: {
        row: MAX_ROWS - 1,
        col: endCol,
        anchor: { colAbsolute: endDollar === '$', rowAbsolute: false },
      },
      sheet,
      spans: 'column',
    });
  }

  const wholeRow = WHOLE_ROW.exec(rest);
  if (wholeRow) {
    const [, startDollar, startDigits, endDollar, endDigits] = wholeRow;
    const startRow = Number(startDigits) - 1;
    const endRow = Number(endDigits) - 1;
    if (startRow < 0 || endRow < 0 || startRow >= MAX_ROWS || endRow >= MAX_ROWS) return null;

    return normaliseRange({
      start: {
        row: startRow,
        col: 0,
        anchor: { colAbsolute: false, rowAbsolute: startDollar === '$' },
      },
      end: {
        row: endRow,
        col: MAX_COLUMNS - 1,
        anchor: { colAbsolute: false, rowAbsolute: endDollar === '$' },
      },
      sheet,
      spans: 'row',
    });
  }

  const colon = rest.indexOf(':');
  if (colon === -1) {
    const cell = parseCellReference(rest);
    return cell ? { start: cell, end: cell, sheet } : null;
  }

  const start = parseCellReference(rest.slice(0, colon));
  const end = parseCellReference(rest.slice(colon + 1));
  if (!start || !end) return null;

  return normaliseRange({ start, end, sheet });
}

/**
 * Sorts a range's corners so `start` is always top-left.
 *
 * `C10:A1` is a range a user can legitimately type, and dragging a selection
 * upwards produces one internally. Everything downstream assumes ordered
 * corners, so they are ordered once, here.
 */
export function normaliseRange(range: RangeReference): RangeReference {
  const top = Math.min(range.start.row, range.end.row);
  const bottom = Math.max(range.start.row, range.end.row);
  const left = Math.min(range.start.col, range.end.col);
  const right = Math.max(range.start.col, range.end.col);

  return {
    ...range,
    start: { ...range.start, row: top, col: left },
    end: { ...range.end, row: bottom, col: right },
  };
}

export function formatRange(range: RangeReference): string {
  const prefix = range.sheet ? formatSheetPrefix(range.sheet) : '';

  if (range.spans === 'column') {
    const start = `${range.start.anchor.colAbsolute ? '$' : ''}${columnToLabel(range.start.col)}`;
    const end = `${range.end.anchor.colAbsolute ? '$' : ''}${columnToLabel(range.end.col)}`;
    return `${prefix}${start}:${end}`;
  }

  if (range.spans === 'row') {
    const start = `${range.start.anchor.rowAbsolute ? '$' : ''}${range.start.row + 1}`;
    const end = `${range.end.anchor.rowAbsolute ? '$' : ''}${range.end.row + 1}`;
    return `${prefix}${start}:${end}`;
  }

  const start = formatAddress(range.start, range.start.anchor);
  if (isSingleCell(range)) return `${prefix}${start}`;
  return `${prefix}${start}:${formatAddress(range.end, range.end.anchor)}`;
}

export function isSingleCell(range: RangeAddress): boolean {
  return range.start.row === range.end.row && range.start.col === range.end.col;
}

export function rangeContains(range: RangeAddress, address: CellAddress): boolean {
  return (
    address.row >= range.start.row &&
    address.row <= range.end.row &&
    address.col >= range.start.col &&
    address.col <= range.end.col
  );
}

export function rangeRowCount(range: RangeAddress): number {
  return range.end.row - range.start.row + 1;
}

export function rangeColumnCount(range: RangeAddress): number {
  return range.end.col - range.start.col + 1;
}

/** Cell count as a number that cannot overflow into nonsense for whole columns. */
export function rangeCellCount(range: RangeAddress): number {
  return rangeRowCount(range) * rangeColumnCount(range);
}

/**
 * Walks a range top-left to bottom-right.
 *
 * A generator rather than an array: `A:A` is a million cells, and materialising
 * that to iterate it would allocate for no reason.
 */
export function* eachAddress(range: RangeAddress): Generator<CellAddress> {
  for (let row = range.start.row; row <= range.end.row; row += 1) {
    for (let col = range.start.col; col <= range.end.col; col += 1) {
      yield { row, col };
    }
  }
}

/* -- Keys ---------------------------------------------------------------- */

/**
 * Packs an address into one number for use as a `Map` key.
 *
 * A string key (`"3,7"`) allocates on every lookup, and a sparse sheet is
 * looked up once per visible cell per frame. The column is 14 bits (16,384)
 * and the row 21 (1,048,576) — 35 bits total, comfortably inside the 53 a
 * double represents exactly, so this is lossless and stays a fast integer key.
 *
 * Precondition: `col` is inside the grid. The packing is only injective while
 * it is — `cellKey(0, MAX_COLUMNS)` would alias `cellKey(1, 0)`. Columns are
 * validated where addresses are parsed, and this is too hot a path to re-check.
 */
export function cellKey(row: number, col: number): number {
  return row * MAX_COLUMNS + col;
}

export function keyToAddress(key: number): CellAddress {
  return { row: Math.floor(key / MAX_COLUMNS), col: key % MAX_COLUMNS };
}

/* -- Reference translation ----------------------------------------------- */

/**
 * Shifts a reference by the distance a formula moved, honouring its anchors.
 *
 * This is the rule that makes copy/paste and the fill handle behave like a
 * spreadsheet: copying `=B1+$C$1` from A1 to A2 must produce `=B2+$C$1`.
 *
 * A reference pushed off the grid becomes `null`, which the caller renders as
 * `#REF!` — silently clamping it to row 0 would change the formula's meaning
 * without telling anyone.
 */
export function translateReference(
  reference: CellReference,
  rowDelta: number,
  colDelta: number,
): CellReference | null {
  const row = reference.anchor.rowAbsolute ? reference.row : reference.row + rowDelta;
  const col = reference.anchor.colAbsolute ? reference.col : reference.col + colDelta;

  if (row < 0 || row >= MAX_ROWS || col < 0 || col >= MAX_COLUMNS) return null;
  return { ...reference, row, col };
}
