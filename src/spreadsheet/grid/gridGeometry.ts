import {
  MAX_COLUMNS,
  MAX_ROWS,
  type CellAddress,
  type RangeAddress,
} from '../model/address';
import {
  DEFAULT_COLUMN_WIDTH,
  DEFAULT_ROW_HEIGHT,
  type Worksheet,
} from '../model/Worksheet';

/**
 * Where every row and column sits, in pixels.
 *
 * The grid is nominally 1,048,576 rows, so the one thing this must never do is
 * walk them. Almost every row is the default height and only a handful are
 * resized, which is what makes the arithmetic cheap:
 *
 *     offset(row) = row * DEFAULT + (sum of the deltas of every resized row above it)
 *
 * The resized rows are kept sorted with a running total beside them, so that
 * sum is one binary search rather than a scan. A sheet with no resized rows
 * costs a single multiply.
 *
 * Rebuilt whenever a row or column is resized. That is a rare event — a resize
 * is a drag that ends — whereas `offsetOfRow` runs for every visible row of
 * every frame, so the cost belongs on the rebuild side.
 */

interface SizeIndex {
  /** Indexes with a non-default size, ascending. */
  readonly at: number[];
  /**
   * Running total of `size - default` for every entry up to and including the
   * one at the same position, so a prefix sum is one lookup after the search.
   */
  readonly cumulative: number[];
  readonly sizes: number[];
  readonly defaultSize: number;
}

function buildIndex(
  overrides: Iterable<number>,
  defaultSize: number,
  sizeOf: (index: number) => number,
): SizeIndex {
  const at = [...overrides].sort((a, b) => a - b);

  const cumulative: number[] = [];
  const sizes: number[] = [];
  let running = 0;

  for (const index of at) {
    const size = sizeOf(index);
    running += size - defaultSize;
    sizes.push(size);
    cumulative.push(running);
  }

  return { at, cumulative, sizes, defaultSize };
}

/** Total delta contributed by every override strictly below `index`. */
function deltaBefore(index: SizeIndex, before: number): number {
  const { at, cumulative } = index;
  if (at.length === 0) return 0;

  // Largest position whose `at` value is < `before`.
  let low = 0;
  let high = at.length - 1;
  let found = -1;

  while (low <= high) {
    const mid = (low + high) >> 1;
    if (at[mid]! < before) {
      found = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return found === -1 ? 0 : cumulative[found]!;
}

function sizeAt(index: SizeIndex, position: number): number {
  const found = binarySearchExact(index.at, position);
  return found === -1 ? index.defaultSize : index.sizes[found]!;
}

function binarySearchExact(values: number[], target: number): number {
  let low = 0;
  let high = values.length - 1;

  while (low <= high) {
    const mid = (low + high) >> 1;
    const value = values[mid]!;
    if (value === target) return mid;
    if (value < target) low = mid + 1;
    else high = mid - 1;
  }

  return -1;
}

function offsetOf(index: SizeIndex, position: number): number {
  return position * index.defaultSize + deltaBefore(index, position);
}

/**
 * The last index whose offset is <= `pixels`.
 *
 * Binary search over the offset function rather than over an array: there is no
 * array of a million offsets to search, which is the entire point.
 */
function indexAtOffset(index: SizeIndex, pixels: number, limit: number): number {
  if (pixels <= 0) return 0;

  let low = 0;
  let high = limit - 1;
  let best = 0;

  while (low <= high) {
    const mid = (low + high) >> 1;
    if (offsetOf(index, mid) <= pixels) {
      best = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return best;
}

/**
 * How many rows the scrollable area covers.
 *
 * Not all 1,048,576. Two reasons, and both are real rather than a shortcut:
 *
 * 1. Every browser caps how tall an element may be — Firefox at roughly
 *    17.9 million CSS pixels — and 1,048,576 default rows is 21 million. Past
 *    the cap the scrollbar silently stops mapping to content, so the bottom of
 *    the sheet becomes unreachable *and* the position under the thumb is wrong.
 * 2. Excel does the same thing. Its scrollbar spans the used range, not the
 *    whole grid; row 900,000 is reached with Ctrl+Down or the Name Box, and the
 *    scrollbar re-scales once you are there.
 */
export const MAX_SCROLL_PX = 15_000_000;

/** Rows kept scrollable past the furthest one in use, so there is somewhere to go. */
export const SCROLL_BUFFER_ROWS = 200;
export const SCROLL_BUFFER_COLUMNS = 20;

/** Never fewer than this, so a blank sheet still scrolls like a spreadsheet. */
export const MIN_SCROLL_ROWS = 100;
export const MIN_SCROLL_COLUMNS = 30;

export interface VisibleWindow {
  firstRow: number;
  lastRow: number;
  firstColumn: number;
  lastColumn: number;
}

export class GridGeometry {
  private readonly rowIndex: SizeIndex;
  private readonly columnIndex: SizeIndex;

  /** How far the sheet scrolls, in rows and columns. See `MAX_SCROLL_PX`. */
  readonly scrollRows: number;
  readonly scrollColumns: number;

  /**
   * @param reach The furthest cell the user has actually gone to, which extends
   *   the scrollable area beyond the used range. Without it, jumping to Z5000
   *   from the Name Box would land somewhere the scrollbar cannot represent.
   */
  constructor(sheet: Worksheet, reach: CellAddress = { row: 0, col: 0 }) {
    this.rowIndex = buildIndex(sheet.rows.keys(), DEFAULT_ROW_HEIGHT, (row) =>
      sheet.rowHeight(row),
    );
    this.columnIndex = buildIndex(sheet.columns.keys(), DEFAULT_COLUMN_WIDTH, (col) =>
      sheet.columnWidth(col),
    );

    const used = sheet.usedRange();
    this.scrollRows = clamp(
      Math.max(used?.end.row ?? 0, reach.row) + SCROLL_BUFFER_ROWS,
      MIN_SCROLL_ROWS,
      Math.min(MAX_ROWS, Math.floor(MAX_SCROLL_PX / DEFAULT_ROW_HEIGHT)),
    );
    this.scrollColumns = clamp(
      Math.max(used?.end.col ?? 0, reach.col) + SCROLL_BUFFER_COLUMNS,
      MIN_SCROLL_COLUMNS,
      MAX_COLUMNS,
    );
  }

  rowHeight(row: number): number {
    return sizeAt(this.rowIndex, row);
  }

  columnWidth(col: number): number {
    return sizeAt(this.columnIndex, col);
  }

  offsetOfRow(row: number): number {
    return offsetOf(this.rowIndex, row);
  }

  offsetOfColumn(col: number): number {
    return offsetOf(this.columnIndex, col);
  }

  /** Total scrollable height, which is the height the spacer element gets. */
  totalHeight(): number {
    return this.offsetOfRow(this.scrollRows);
  }

  totalWidth(): number {
    return this.offsetOfColumn(this.scrollColumns);
  }

  rowAt(y: number): number {
    return Math.min(indexAtOffset(this.rowIndex, y, this.scrollRows), this.scrollRows - 1);
  }

  columnAt(x: number): number {
    return Math.min(
      indexAtOffset(this.columnIndex, x, this.scrollColumns),
      this.scrollColumns - 1,
    );
  }

  cellAt(x: number, y: number): CellAddress {
    return { row: this.rowAt(y), col: this.columnAt(x) };
  }

  /**
   * The rows and columns a viewport covers, plus an overscan margin.
   *
   * The margin is what stops a blank band appearing at the leading edge during
   * a fast scroll: the browser can paint a frame between the scroll event and
   * React's re-render, and the overscan rows are already there when it does.
   */
  visibleWindow(
    scrollLeft: number,
    scrollTop: number,
    width: number,
    height: number,
    overscan = 3,
  ): VisibleWindow {
    const firstRow = Math.max(0, this.rowAt(scrollTop) - overscan);
    const lastRow = Math.min(this.scrollRows - 1, this.rowAt(scrollTop + height) + overscan);
    const firstColumn = Math.max(0, this.columnAt(scrollLeft) - overscan);
    const lastColumn = Math.min(
      this.scrollColumns - 1,
      this.columnAt(scrollLeft + width) + overscan,
    );

    return { firstRow, lastRow, firstColumn, lastColumn };
  }

  /** The pixel rectangle a range occupies, for drawing the selection outline. */
  rectOf(range: RangeAddress): { left: number; top: number; width: number; height: number } {
    const left = this.offsetOfColumn(range.start.col);
    const top = this.offsetOfRow(range.start.row);

    return {
      left,
      top,
      width: this.offsetOfColumn(range.end.col + 1) - left,
      height: this.offsetOfRow(range.end.row + 1) - top,
    };
  }

  /**
   * The scroll position that brings a cell fully into view, or null when it
   * already is — so callers can skip a pointless scroll that would fight a drag.
   */
  scrollToShow(
    address: CellAddress,
    scrollLeft: number,
    scrollTop: number,
    width: number,
    height: number,
  ): { left: number; top: number } | null {
    const cellLeft = this.offsetOfColumn(address.col);
    const cellRight = cellLeft + this.columnWidth(address.col);
    const cellTop = this.offsetOfRow(address.row);
    const cellBottom = cellTop + this.rowHeight(address.row);

    let left = scrollLeft;
    let top = scrollTop;

    if (cellLeft < scrollLeft) left = cellLeft;
    else if (cellRight > scrollLeft + width) left = cellRight - width;

    if (cellTop < scrollTop) top = cellTop;
    else if (cellBottom > scrollTop + height) top = cellBottom - height;

    return left === scrollLeft && top === scrollTop ? null : { left, top };
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
