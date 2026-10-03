import {
  MAX_COLUMNS,
  MAX_ROWS,
  normaliseRange,
  rangeContains,
  type CellAddress,
  type RangeAddress,
} from '../model/address';

/**
 * What is selected, and where the cursor is.
 *
 * Deliberately a plain class with its own listeners rather than React state.
 * Dragging a marquee across a thousand cells fires a mousemove per frame; if
 * each one were a `setState`, the grid would re-render a thousand times and the
 * drag would visibly stutter. Instead the overlay subscribes and moves three
 * absolutely-positioned divs, and only the components that genuinely need a
 * value — the formula bar, the name box, the status bar's Sum/Count — read a
 * coalesced snapshot.
 *
 * The rule this file exists to enforce: **selection changes must not re-render
 * the grid.**
 */

export interface SelectionState {
  /** Where typing goes, and the cell the formula bar shows. */
  active: CellAddress;
  /** Where the current drag or shift-extend started. */
  anchor: CellAddress;
  /**
   * Selected rectangles, most recent last.
   *
   * More than one only after Ctrl-clicking, which Excel allows and formulas
   * like `SUM(A1:A5,C1:C5)` depend on.
   */
  ranges: RangeAddress[];
}

export type SelectionListener = (state: SelectionState) => void;

const ORIGIN: CellAddress = { row: 0, col: 0 };

function clampAddress(address: CellAddress): CellAddress {
  return {
    row: Math.max(0, Math.min(address.row, MAX_ROWS - 1)),
    col: Math.max(0, Math.min(address.col, MAX_COLUMNS - 1)),
  };
}

function single(address: CellAddress): RangeAddress {
  return { start: address, end: address };
}

/**
 * How the selection learns about merged cells, which belong to the sheet.
 *
 * Read through functions rather than handed over as data, because the active
 * sheet — and its merges — change underneath a selection that outlives them.
 */
export interface MergeLookup {
  /** The merge covering a cell, if any; its `start` is the anchor. */
  covering(row: number, col: number): RangeAddress | undefined;
  /** Every merge on the sheet. */
  all(): readonly RangeAddress[];
}

const NO_MERGES: MergeLookup = { covering: () => undefined, all: () => [] };

export class SelectionModel {
  /**
   * @param merges Excel treats a merged block as one cell: clicking anywhere
   *   in it selects all of it and makes its top-left cell the active one, so
   *   the formula bar shows the block's content and the headers light up
   *   across every column it spans.
   */
  constructor(private readonly merges: MergeLookup = NO_MERGES) {}

  private active: CellAddress = ORIGIN;
  private anchor: CellAddress = ORIGIN;
  private ranges: RangeAddress[] = [single(ORIGIN)];

  private readonly listeners = new Set<SelectionListener>();

  /** A snapshot safe to hand to React. Rebuilt only when something changed. */
  private snapshot: SelectionState = this.build();

  /**
   * Builds the snapshot, frozen.
   *
   * Frozen because it is handed to React and to anything that subscribes:
   * without it a consumer mutating `state.active.row` would silently corrupt
   * the model, and the corruption would surface far from its cause. Freezing
   * is done once per change, not per read, so it costs nothing on the hot path.
   */
  private build(): SelectionState {
    return Object.freeze({
      active: Object.freeze({ ...this.active }),
      anchor: Object.freeze({ ...this.anchor }),
      ranges: Object.freeze(
        this.ranges.map((range) =>
          Object.freeze({
            start: Object.freeze({ ...range.start }),
            end: Object.freeze({ ...range.end }),
          }),
        ),
      ) as RangeAddress[],
    }) as SelectionState;
  }

  /**
   * The current state.
   *
   * Returns the same object until something changes, so `useSyncExternalStore`
   * can compare by identity and skip a render — rebuilding on every read would
   * make every subscriber re-render on every mouse move.
   */
  getState(): SelectionState {
    return this.snapshot;
  }

  /**
   * An arrow property, not a method: `useSyncExternalStore` is handed this
   * function on its own, so a prototype method would lose its `this`.
   */
  subscribe = (listener: SelectionListener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): SelectionState => this.snapshot;

  private commit(): void {
    this.snapshot = this.build();
    for (const listener of this.listeners) listener(this.snapshot);
  }

  /** The cell itself, or the anchor of the merge it is hidden behind. */
  private snap(address: CellAddress): CellAddress {
    const merge = this.merges.covering(address.row, address.col);
    return merge ? { row: merge.start.row, col: merge.start.col } : address;
  }

  /** The block a single cell stands for: the whole merge when it is in one. */
  private blockAt(address: CellAddress): RangeAddress {
    const merge = this.merges.covering(address.row, address.col);
    return merge ? { start: { ...merge.start }, end: { ...merge.end } } : single(address);
  }

  /**
   * A range widened until no merge straddles its edge, as Excel's selection
   * is. Repeated until nothing changes, because taking in one merge can carry
   * the edge across another.
   */
  private growToMerges(range: RangeAddress): RangeAddress {
    const merges = this.merges.all();
    let { start, end } = range;
    let grown = merges.length > 0;

    while (grown) {
      grown = false;
      for (const merge of merges) {
        const overlaps =
          merge.start.row <= end.row &&
          merge.end.row >= start.row &&
          merge.start.col <= end.col &&
          merge.end.col >= start.col;
        const inside =
          merge.start.row >= start.row &&
          merge.end.row <= end.row &&
          merge.start.col >= start.col &&
          merge.end.col <= end.col;
        if (!overlaps || inside) continue;

        start = { row: Math.min(start.row, merge.start.row), col: Math.min(start.col, merge.start.col) };
        end = { row: Math.max(end.row, merge.end.row), col: Math.max(end.col, merge.end.col) };
        grown = true;
      }
    }

    return { start, end };
  }

  /** Clicking a cell: collapses the selection to it. */
  selectCell(address: CellAddress): void {
    const clicked = clampAddress(address);
    const at = this.snap(clicked);
    this.active = at;
    this.anchor = at;
    this.ranges = [this.blockAt(clicked)];
    this.commit();
  }

  /** Shift-click or a drag: extends from the anchor without moving it. */
  extendTo(address: CellAddress): void {
    const to = clampAddress(address);
    const extended = normaliseRange({
      start: { ...this.anchor, anchor: { colAbsolute: false, rowAbsolute: false } },
      end: { ...to, anchor: { colAbsolute: false, rowAbsolute: false } },
    });

    this.ranges = [
      ...this.ranges.slice(0, -1),
      this.growToMerges({
        start: { row: extended.start.row, col: extended.start.col },
        end: { row: extended.end.row, col: extended.end.col },
      }),
    ];
    this.active = this.snap(to);
    this.commit();
  }

  /** Ctrl-click: begins an additional rectangle, leaving the others intact. */
  addRange(address: CellAddress): void {
    const clicked = clampAddress(address);
    const at = this.snap(clicked);
    this.ranges = [...this.ranges, this.blockAt(clicked)];
    this.active = at;
    this.anchor = at;
    this.commit();
  }

  selectRange(range: RangeAddress): void {
    const start = clampAddress(range.start);
    const end = clampAddress(range.end);
    const ordered = this.growToMerges({
      start: { row: Math.min(start.row, end.row), col: Math.min(start.col, end.col) },
      end: { row: Math.max(start.row, end.row), col: Math.max(start.col, end.col) },
    });

    this.ranges = [ordered];
    this.anchor = ordered.start;
    this.active = ordered.start;
    this.commit();
  }

  /**
   * Arrow-key movement: moves the cursor and collapses the selection.
   *
   * Excel collapses on a plain arrow and extends on shift+arrow, which is why
   * `extend` is a parameter rather than two near-identical methods.
   */
  moveBy(rowDelta: number, colDelta: number, extend = false): void {
    // Out of a merge the step is taken from the block's far edge: Right from
    // a merged D4:I4 lands on J4, not on the hidden E4.
    const from = this.blockAt(this.active);
    const target = clampAddress({
      row: (rowDelta > 0 ? from.end.row : from.start.row) + rowDelta,
      col: (colDelta > 0 ? from.end.col : from.start.col) + colDelta,
    });

    if (extend) this.extendTo(target);
    else this.selectCell(target);
  }

  selectRow(row: number): void {
    this.selectRange({ start: { row, col: 0 }, end: { row, col: MAX_COLUMNS - 1 } });
  }

  selectColumn(col: number): void {
    this.selectRange({ start: { row: 0, col }, end: { row: MAX_ROWS - 1, col } });
  }

  selectAll(): void {
    this.selectRange({
      start: { row: 0, col: 0 },
      end: { row: MAX_ROWS - 1, col: MAX_COLUMNS - 1 },
    });
  }

  isSelected(address: CellAddress): boolean {
    return this.ranges.some((range) => rangeContains(range, address));
  }

  /**
   * Every selected address, in reading order, without duplicates.
   *
   * A generator because a whole-column selection is a million addresses, and
   * the commonest consumer — "apply this format to the selection" — wants to
   * walk them rather than hold them.
   */
  *addresses(): Generator<CellAddress> {
    const seen = new Set<number>();

    for (const range of this.ranges) {
      for (let row = range.start.row; row <= range.end.row; row += 1) {
        for (let col = range.start.col; col <= range.end.col; col += 1) {
          // Overlapping rectangles are legal after Ctrl-clicking, and applying
          // a format twice to one cell is wasteful rather than wrong — but a
          // duplicated cell in an operation log reads as two separate edits.
          const key = row * MAX_COLUMNS + col;
          if (seen.has(key)) continue;
          seen.add(key);
          yield { row, col };
        }
      }
    }
  }

  /** The rectangles, for the overlay to draw. */
  getRanges(): readonly RangeAddress[] {
    return this.snapshot.ranges;
  }

  getActive(): CellAddress {
    return this.snapshot.active;
  }
}
