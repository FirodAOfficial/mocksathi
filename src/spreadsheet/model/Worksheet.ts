import {
  MAX_COLUMNS,
  MAX_ROWS,
  cellKey,
  keyToAddress,
  rangeCellCount,
  type CellAddress,
  type RangeAddress,
} from './address';
import { isBlank, type Cell, type CellValue } from './Cell';
import { DEFAULT_STYLE_ID, type StyleId } from './styles';

/**
 * One sheet's data, stored sparsely.
 *
 * The grid is nominally 1,048,576 x 16,384 — seventeen billion cells — and a
 * real workbook fills a few thousand of them. So cells live in a `Map` keyed by
 * a packed integer, and everything that walks the sheet walks what exists
 * rather than what could exist. A dense array here would not merely be slow; it
 * would not allocate.
 */

export interface RowProps {
  /** CSS pixels. Absent means the sheet default. */
  height?: number;
  hidden?: boolean;
  styleId?: StyleId;
}

export interface ColumnProps {
  /** CSS pixels. Absent means the sheet default. */
  width?: number;
  hidden?: boolean;
  styleId?: StyleId;
}

/** Excel's defaults at 96dpi: 20px rows, 64px columns. */
export const DEFAULT_ROW_HEIGHT = 20;
export const DEFAULT_COLUMN_WIDTH = 64;

/**
 * A merge is stored once, on its anchor, plus a lookup for every covered cell.
 *
 * Rendering and hit-testing ask "is this cell covered?" once per visible cell
 * per frame. Scanning a list of merges to answer that is O(merges) per cell;
 * the index makes it O(1) at the cost of one entry per covered cell, which is
 * bounded by the guard below.
 */
export interface MergedRange extends RangeAddress {
  /** Index into the sheet's merge list. */
  id: number;
}

/**
 * A malicious or broken workbook can declare `A1:XFD1048576` as merged. Building
 * a covered-cell index for that would exhaust memory before anything rendered,
 * so an implausible merge is refused and reported rather than honoured.
 */
export const MAX_MERGE_CELLS = 1_000_000;

/**
 * What the sheet itself says about how it is displayed.
 *
 * These live on the worksheet, not in the app's chrome, because that is where
 * Excel keeps them: `sheetView` in the file format carries `showGridLines` and
 * `showRowColHeaders` per sheet. It also makes them part of a submitted answer,
 * which a question asking to show the headings needs them to be.
 */
export interface SheetView {
  showGridlines: boolean;
  showHeadings: boolean;
}

export const DEFAULT_SHEET_VIEW: SheetView = { showGridlines: true, showHeadings: true };

export interface FrozenPanes {
  /** Number of rows frozen at the top. */
  rows: number;
  /** Number of columns frozen at the left. */
  columns: number;
}

export class Worksheet {
  readonly cells = new Map<number, Cell>();

  /** Row -> the columns occupied in it, so a viewport scan touches only real cells. */
  private readonly occupiedByRow = new Map<number, Set<number>>();

  readonly rows = new Map<number, RowProps>();
  readonly columns = new Map<number, ColumnProps>();

  private readonly merges: MergedRange[] = [];
  private readonly mergeAt = new Map<number, number>();

  frozen: FrozenPanes = { rows: 0, columns: 0 };

  view: SheetView = { ...DEFAULT_SHEET_VIEW };

  /**
   * The range Page Layout's Print Area names, or null for the whole sheet.
   *
   * Stored even though this build does not print. It is a real sheet property
   * that a paper asks a candidate to set, and the grid draws its boundary — so
   * setting it does something visible, rather than being a control that
   * remembers a value nobody can see.
   */
  printArea: RangeAddress | null = null;

  /**
   * The bounding box of everything written, grown on write.
   *
   * Deletes deliberately do not shrink it: clearing a large selection would
   * otherwise be O(cells) per cell as the box was recomputed. It is a hint for
   * sizing the scrollable area, not a precise answer, and `usedRange()`
   * recomputes lazily when the difference would be visible.
   */
  private bounds = { top: 0, left: 0, bottom: -1, right: -1 };
  private boundsStale = false;

  constructor(
    public id: string,
    public name: string,
    public visible: boolean = true,
  ) {}

  /* -- Cells ------------------------------------------------------------ */

  getCell(row: number, col: number): Cell | undefined {
    return this.cells.get(cellKey(row, col));
  }

  getValue(row: number, col: number): CellValue {
    return this.cells.get(cellKey(row, col))?.value ?? null;
  }

  /**
   * Writes a cell, or removes it when it becomes blank.
   *
   * Keeping a blank, unstyled cell in the map would make the sheet grow every
   * time someone pressed Delete, and `usedRange` would creep outwards for cells
   * that hold nothing.
   */
  setCell(row: number, col: number, cell: Cell | undefined): void {
    const key = cellKey(row, col);

    if (!cell || (isBlank(cell) && cell.styleId === DEFAULT_STYLE_ID)) {
      if (this.cells.delete(key)) {
        this.occupiedByRow.get(row)?.delete(col);
        this.boundsStale = true;
      }
      return;
    }

    this.cells.set(key, cell);

    let columnsInRow = this.occupiedByRow.get(row);
    if (!columnsInRow) {
      columnsInRow = new Set();
      this.occupiedByRow.set(row, columnsInRow);
    }
    columnsInRow.add(col);

    this.growBounds(row, col);
  }

  private growBounds(row: number, col: number): void {
    if (this.bounds.bottom < this.bounds.top) {
      this.bounds = { top: row, left: col, bottom: row, right: col };
      return;
    }
    if (row < this.bounds.top) this.bounds.top = row;
    if (row > this.bounds.bottom) this.bounds.bottom = row;
    if (col < this.bounds.left) this.bounds.left = col;
    if (col > this.bounds.right) this.bounds.right = col;
  }

  /** The rectangle containing every non-empty cell, or null for an empty sheet. */
  usedRange(): RangeAddress | null {
    if (this.boundsStale) this.recomputeBounds();
    if (this.bounds.bottom < this.bounds.top) return null;

    return {
      start: { row: this.bounds.top, col: this.bounds.left },
      end: { row: this.bounds.bottom, col: this.bounds.right },
    };
  }

  private recomputeBounds(): void {
    this.boundsStale = false;
    this.bounds = { top: 0, left: 0, bottom: -1, right: -1 };

    for (const key of this.cells.keys()) {
      const { row, col } = keyToAddress(key);
      this.growBounds(row, col);
    }
  }

  /**
   * The occupied cells of a row, in column order.
   *
   * This is what the grid uses to paint a row: it asks for what exists in the
   * visible column window rather than probing every column in it.
   */
  *cellsInRow(row: number, fromCol = 0, toCol = MAX_COLUMNS - 1): Generator<[number, Cell]> {
    const columns = this.occupiedByRow.get(row);
    if (!columns) return;

    // Sorted per call: a row holds tens of cells, and keeping a sorted
    // structure per row would cost more on every write than it saves here.
    for (const col of [...columns].sort((a, b) => a - b)) {
      if (col < fromCol || col > toCol) continue;
      const cell = this.cells.get(cellKey(row, col));
      if (cell) yield [col, cell];
    }
  }

  /* -- Rows and columns ------------------------------------------------- */

  rowHeight(row: number): number {
    const props = this.rows.get(row);
    if (props?.hidden) return 0;
    return props?.height ?? DEFAULT_ROW_HEIGHT;
  }

  columnWidth(col: number): number {
    const props = this.columns.get(col);
    if (props?.hidden) return 0;
    return props?.width ?? DEFAULT_COLUMN_WIDTH;
  }

  setRowProps(row: number, props: RowProps | undefined): void {
    if (!props || Object.keys(props).length === 0) this.rows.delete(row);
    else this.rows.set(row, props);
  }

  setColumnProps(col: number, props: ColumnProps | undefined): void {
    if (!props || Object.keys(props).length === 0) this.columns.delete(col);
    else this.columns.set(col, props);
  }

  /* -- Merges ----------------------------------------------------------- */

  /**
   * Merges a range, returning false if it is implausibly large or overlaps an
   * existing merge.
   *
   * Excel refuses overlapping merges too; allowing them would make "which merge
   * covers this cell" ambiguous and the index inconsistent.
   */
  mergeCells(range: RangeAddress): boolean {
    if (rangeCellCount(range) > MAX_MERGE_CELLS) return false;

    for (let row = range.start.row; row <= range.end.row; row += 1) {
      for (let col = range.start.col; col <= range.end.col; col += 1) {
        if (this.mergeAt.has(cellKey(row, col))) return false;
      }
    }

    const id = this.merges.length;
    this.merges.push({ ...range, id });

    for (let row = range.start.row; row <= range.end.row; row += 1) {
      for (let col = range.start.col; col <= range.end.col; col += 1) {
        this.mergeAt.set(cellKey(row, col), id);
      }
    }

    return true;
  }

  /** The merge covering a cell, if any. The anchor is `merge.start`. */
  mergeCovering(row: number, col: number): MergedRange | undefined {
    const id = this.mergeAt.get(cellKey(row, col));
    return id === undefined ? undefined : this.merges[id];
  }

  unmergeAt(row: number, col: number): boolean {
    const merge = this.mergeCovering(row, col);
    if (!merge) return false;

    for (let r = merge.start.row; r <= merge.end.row; r += 1) {
      for (let c = merge.start.col; c <= merge.end.col; c += 1) {
        this.mergeAt.delete(cellKey(r, c));
      }
    }

    // The slot is emptied rather than spliced out: ids are indexes, and
    // renumbering would invalidate every entry still in `mergeAt`.
    delete this.merges[merge.id];
    return true;
  }

  mergedRanges(): MergedRange[] {
    return this.merges.filter((merge): merge is MergedRange => merge !== undefined);
  }

  /** True when the cell is inside a merge but is not the cell holding its value. */
  isCovered(row: number, col: number): boolean {
    const merge = this.mergeCovering(row, col);
    if (!merge) return false;
    return merge.start.row !== row || merge.start.col !== col;
  }

  /* -- Freeze ----------------------------------------------------------- */

  freeze(rows: number, columns: number): void {
    this.frozen = {
      rows: Math.max(0, Math.min(rows, MAX_ROWS)),
      columns: Math.max(0, Math.min(columns, MAX_COLUMNS)),
    };
  }

  /* -- Bulk --------------------------------------------------------------- */

  /** Every non-empty cell, for serialisation and for the calculation engine. */
  *entries(): Generator<[CellAddress, Cell]> {
    for (const [key, cell] of this.cells) {
      yield [keyToAddress(key), cell];
    }
  }

  get cellCount(): number {
    return this.cells.size;
  }
}
