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

export class SelectionModel {
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

  /** Clicking a cell: collapses the selection to it. */
  selectCell(address: CellAddress): void {
    const at = clampAddress(address);
    this.active = at;
    this.anchor = at;
    this.ranges = [single(at)];
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
      { start: { row: extended.start.row, col: extended.start.col }, end: { row: extended.end.row, col: extended.end.col } },
    ];
    this.active = to;
    this.commit();
  }

  /** Ctrl-click: begins an additional rectangle, leaving the others intact. */
  addRange(address: CellAddress): void {
    const at = clampAddress(address);
    this.ranges = [...this.ranges, single(at)];
    this.active = at;
    this.anchor = at;
    this.commit();
  }

  selectRange(range: RangeAddress): void {
    const start = clampAddress(range.start);
    const end = clampAddress(range.end);
    const ordered = {
      start: { row: Math.min(start.row, end.row), col: Math.min(start.col, end.col) },
      end: { row: Math.max(start.row, end.row), col: Math.max(start.col, end.col) },
    };

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
    const target = clampAddress({
      row: this.active.row + rowDelta,
      col: this.active.col + colDelta,
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
