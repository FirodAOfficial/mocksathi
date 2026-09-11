import type { RangeAddress } from '../model/address';
import type { Cell } from '../model/Cell';
import type { ColumnProps, RowProps, SheetView } from '../model/Worksheet';
import type { StyleId } from '../model/styles';

/**
 * The vocabulary of workbook changes.
 *
 * Two properties matter and both are deliberate:
 *
 * 1. **Every operation carries its own before-state.** Undo inverts an
 *    operation from what it recorded, not by replaying a chain backwards. That
 *    is what lets the undo stack be capped at a hundred transactions and still
 *    be correct — dropping the oldest cannot corrupt the ones that remain.
 *
 * 2. **Every operation is plain, serialisable data.** No functions, no class
 *    instances, no references into the workbook. A future grading engine reads
 *    these as JSON, and a transaction that captured a closure would be
 *    unreadable to it.
 */

export interface SetCellOp {
  kind: 'setCell';
  sheetId: string;
  row: number;
  col: number;
  before: Cell | undefined;
  after: Cell | undefined;
}

export interface SetStyleOp {
  kind: 'setStyle';
  sheetId: string;
  row: number;
  col: number;
  before: StyleId;
  after: StyleId;
}

export interface SetRowPropsOp {
  kind: 'setRowProps';
  sheetId: string;
  row: number;
  before: RowProps | undefined;
  after: RowProps | undefined;
}

export interface SetColumnPropsOp {
  kind: 'setColumnProps';
  sheetId: string;
  col: number;
  before: ColumnProps | undefined;
  after: ColumnProps | undefined;
}

export interface MergeOp {
  kind: 'merge';
  sheetId: string;
  range: RangeAddress;
  /**
   * Cells cleared by the merge, so undo can put them back.
   *
   * Excel discards everything but the top-left value when merging and warns
   * first. We do the same, but the discarded values are recorded here so the
   * warning is undoable rather than final.
   */
  clearedCells: Array<{ row: number; col: number; cell: Cell }>;
}

export interface UnmergeOp {
  kind: 'unmerge';
  sheetId: string;
  range: RangeAddress;
}

export interface AddSheetOp {
  kind: 'addSheet';
  sheetId: string;
  name: string;
  index: number;
}

export interface RemoveSheetOp {
  kind: 'removeSheet';
  sheetId: string;
  name: string;
  index: number;
  /**
   * Everything the sheet held, so undo can restore it.
   *
   * A deleted sheet is the largest thing an operation can carry, and it is the
   * reason the undo stack is bounded by transaction count rather than by size.
   */
  cells: Array<{ row: number; col: number; cell: Cell }>;
  rows: Array<[number, RowProps]>;
  columns: Array<[number, ColumnProps]>;
  merges: RangeAddress[];
  frozen: { rows: number; columns: number };
}

export interface RenameSheetOp {
  kind: 'renameSheet';
  sheetId: string;
  before: string;
  after: string;
}

export interface MoveSheetOp {
  kind: 'moveSheet';
  sheetId: string;
  before: number;
  after: number;
}

export interface SetSheetVisibleOp {
  kind: 'setSheetVisible';
  sheetId: string;
  before: boolean;
  after: boolean;
}

export interface SetFrozenOp {
  kind: 'setFrozen';
  sheetId: string;
  before: { rows: number; columns: number };
  after: { rows: number; columns: number };
}

export interface SetSheetViewOp {
  kind: 'setSheetView';
  sheetId: string;
  before: SheetView;
  after: SheetView;
}

export interface SetPrintAreaOp {
  kind: 'setPrintArea';
  sheetId: string;
  before: RangeAddress | null;
  after: RangeAddress | null;
}

export type Operation =
  | SetCellOp
  | SetStyleOp
  | SetRowPropsOp
  | SetColumnPropsOp
  | MergeOp
  | UnmergeOp
  | AddSheetOp
  | RemoveSheetOp
  | RenameSheetOp
  | MoveSheetOp
  | SetSheetVisibleOp
  | SetSheetViewOp
  | SetPrintAreaOp
  | SetFrozenOp;

/**
 * Where a change came from.
 *
 * `ribbon` versus `keyboard` is not bookkeeping — it is the whole point of the
 * exam rule this editor is built around. A practical paper asks the candidate
 * to bold a range *using the ribbon*; without recording which control produced
 * the change, a grader can only see that the range ended up bold and the rule
 * becomes ungradeable.
 *
 * Recording it costs nothing now and cannot be added retroactively without
 * revisiting every action in the app.
 */
export type CommandSource = 'ribbon' | 'keyboard' | 'grid' | 'formulaBar' | 'sheetTabs' | 'load';

export interface Transaction {
  id: number;
  /** Shown verbatim in the Undo tooltip: "Undo Bold". Also the grading unit. */
  label: string;
  source: CommandSource;
  /** The control that ran it, e.g. `home.font.bold`. Absent for non-ribbon sources. */
  control?: string;
  timestamp: number;
  operations: Operation[];
}
