import { eachAddress, type RangeAddress } from '../model/address';
import type { Cell } from '../model/Cell';
import type { Workbook } from '../model/Workbook';
import { Worksheet, type ColumnProps, type RowProps, type SheetView } from '../model/Worksheet';
import type { StyleId } from '../model/styles';
import type { CommandSource, Operation, Transaction } from './Operation';

/**
 * The only way the workbook changes.
 *
 * Components never touch a `Worksheet` directly. They open a transaction and
 * receive a `WorkbookMutator`, which records what it does as it does it. Undo
 * is then correct by construction: there is no path that mutates without being
 * recorded, so there is no change that undo can miss.
 *
 * The alternative — mutating freely and remembering to log — fails the first
 * time someone adds a feature and forgets, and it fails silently.
 */

/** Excel keeps a hundred; matching it keeps memory bounded and behaviour familiar. */
export const MAX_UNDO_DEPTH = 100;

export interface CommandMeta {
  label: string;
  source: CommandSource;
  control?: string;
}

/**
 * The write surface handed to a command.
 *
 * Every method records its own before-state before changing anything.
 */
export class WorkbookMutator {
  constructor(
    private readonly workbook: Workbook,
    private readonly operations: Operation[],
  ) {}

  setCell(sheetId: string, row: number, col: number, cell: Cell | undefined): void {
    const sheet = this.workbook.sheetById(sheetId);
    if (!sheet) return;

    const before = sheet.getCell(row, col);
    // Copied out: the sheet may hand back the same object it stores, and undo
    // needs the value as it was, not a live reference to what it became.
    this.operations.push({
      kind: 'setCell',
      sheetId,
      row,
      col,
      before: before ? { ...before } : undefined,
      after: cell ? { ...cell } : undefined,
    });
    sheet.setCell(row, col, cell);
  }

  setStyle(sheetId: string, row: number, col: number, styleId: StyleId): void {
    const sheet = this.workbook.sheetById(sheetId);
    if (!sheet) return;

    const existing = sheet.getCell(row, col);
    const before = existing?.styleId ?? 0;
    if (before === styleId) return;

    this.operations.push({ kind: 'setStyle', sheetId, row, col, before, after: styleId });
    sheet.setCell(row, col, { value: existing?.value ?? null, ...existing, styleId });
  }

  setRowProps(sheetId: string, row: number, props: RowProps | undefined): void {
    const sheet = this.workbook.sheetById(sheetId);
    if (!sheet) return;

    const before = sheet.rows.get(row);
    this.operations.push({
      kind: 'setRowProps',
      sheetId,
      row,
      before: before ? { ...before } : undefined,
      after: props ? { ...props } : undefined,
    });
    sheet.setRowProps(row, props);
  }

  setColumnProps(sheetId: string, col: number, props: ColumnProps | undefined): void {
    const sheet = this.workbook.sheetById(sheetId);
    if (!sheet) return;

    const before = sheet.columns.get(col);
    this.operations.push({
      kind: 'setColumnProps',
      sheetId,
      col,
      before: before ? { ...before } : undefined,
      after: props ? { ...props } : undefined,
    });
    sheet.setColumnProps(col, props);
  }

  /**
   * Merges a range, clearing all but the top-left value as Excel does.
   *
   * Returns false when the sheet refuses — an overlap, or an implausibly large
   * range — and records nothing in that case, so a refused merge leaves no
   * empty transaction on the undo stack.
   */
  mergeCells(sheetId: string, range: RangeAddress): boolean {
    const sheet = this.workbook.sheetById(sheetId);
    if (!sheet) return false;

    const cleared: Array<{ row: number; col: number; cell: Cell }> = [];
    for (const { row, col } of eachAddress(range)) {
      if (row === range.start.row && col === range.start.col) continue;
      const cell = sheet.getCell(row, col);
      if (cell) cleared.push({ row, col, cell: { ...cell } });
    }

    if (!sheet.mergeCells(range)) return false;

    for (const { row, col } of cleared) sheet.setCell(row, col, undefined);
    this.operations.push({ kind: 'merge', sheetId, range, clearedCells: cleared });
    return true;
  }

  unmergeAt(sheetId: string, row: number, col: number): boolean {
    const sheet = this.workbook.sheetById(sheetId);
    const merge = sheet?.mergeCovering(row, col);
    if (!sheet || !merge) return false;

    const range = { start: { ...merge.start }, end: { ...merge.end } };
    if (!sheet.unmergeAt(row, col)) return false;

    this.operations.push({ kind: 'unmerge', sheetId, range });
    return true;
  }

  addSheet(name: string, index?: number): string {
    const id = this.workbook.nextSheetId();
    const at = index ?? this.workbook.sheetCount;

    this.workbook.addSheet(new Worksheet(id, name), at);
    this.operations.push({ kind: 'addSheet', sheetId: id, name, index: at });
    return id;
  }

  removeSheet(sheetId: string): boolean {
    const sheet = this.workbook.sheetById(sheetId);
    if (!sheet) return false;

    const index = this.workbook.allSheets().indexOf(sheet);
    const snapshot = snapshotSheet(sheet);

    if (!this.workbook.removeSheet(sheetId)) return false;

    this.operations.push({
      kind: 'removeSheet',
      sheetId,
      name: sheet.name,
      index,
      ...snapshot,
    });
    return true;
  }

  renameSheet(sheetId: string, name: string): boolean {
    const sheet = this.workbook.sheetById(sheetId);
    if (!sheet || !this.workbook.canNameSheet(name, sheetId)) return false;

    this.operations.push({ kind: 'renameSheet', sheetId, before: sheet.name, after: name });
    sheet.name = name;
    return true;
  }

  moveSheet(sheetId: string, toIndex: number): boolean {
    const sheet = this.workbook.sheetById(sheetId);
    if (!sheet) return false;

    const from = this.workbook.allSheets().indexOf(sheet);
    if (!this.workbook.moveSheet(sheetId, toIndex)) return false;

    this.operations.push({ kind: 'moveSheet', sheetId, before: from, after: toIndex });
    return true;
  }

  /**
   * Hides or shows a sheet.
   *
   * A hidden sheet is still in the workbook and formulas still reach it — the
   * tab simply stops being drawn. That is Excel's behaviour, and it is why this
   * is a visibility flag rather than a removal.
   */
  setSheetVisible(sheetId: string, visible: boolean): boolean {
    const sheet = this.workbook.sheetById(sheetId);
    if (!sheet || sheet.visible === visible) return false;

    // Excel refuses to hide the last visible sheet: a workbook showing nothing
    // has no cell to select and no tab to bring it back with.
    if (!visible && this.workbook.visibleSheets().length <= 1) return false;

    this.operations.push({ kind: 'setSheetVisible', sheetId, before: sheet.visible, after: visible });
    sheet.visible = visible;
    return true;
  }

  /** Gridlines and headings, which Excel stores per sheet. */
  setSheetView(sheetId: string, view: Partial<SheetView>): void {
    const sheet = this.workbook.sheetById(sheetId);
    if (!sheet) return;

    const before = { ...sheet.view };
    const after = { ...before, ...view };
    if (before.showGridlines === after.showGridlines && before.showHeadings === after.showHeadings) return;

    this.operations.push({ kind: 'setSheetView', sheetId, before, after });
    sheet.view = after;
  }

  setPrintArea(sheetId: string, range: RangeAddress | null): void {
    const sheet = this.workbook.sheetById(sheetId);
    if (!sheet) return;

    const before = sheet.printArea;
    this.operations.push({
      kind: 'setPrintArea',
      sheetId,
      before: before ? { start: { ...before.start }, end: { ...before.end } } : null,
      after: range ? { start: { ...range.start }, end: { ...range.end } } : null,
    });
    sheet.printArea = range ? { start: { ...range.start }, end: { ...range.end } } : null;
  }

  setFrozen(sheetId: string, rows: number, columns: number): void {
    const sheet = this.workbook.sheetById(sheetId);
    if (!sheet) return;

    const before = { ...sheet.frozen };
    sheet.freeze(rows, columns);
    this.operations.push({ kind: 'setFrozen', sheetId, before, after: { ...sheet.frozen } });
  }
}

function snapshotSheet(sheet: Worksheet) {
  const cells: Array<{ row: number; col: number; cell: Cell }> = [];
  for (const [address, cell] of sheet.entries()) {
    cells.push({ row: address.row, col: address.col, cell: { ...cell } });
  }

  return {
    cells,
    rows: [...sheet.rows].map(([row, props]) => [row, { ...props }] as [number, RowProps]),
    columns: [...sheet.columns].map(
      ([col, props]) => [col, { ...props }] as [number, ColumnProps],
    ),
    merges: sheet.mergedRanges().map((merge) => ({ start: { ...merge.start }, end: { ...merge.end } })),
    frozen: { ...sheet.frozen },
  };
}

export type CommandListener = (transaction: Transaction) => void;

export class CommandBus {
  private readonly undoStack: Transaction[] = [];
  private readonly redoStack: Transaction[] = [];

  /**
   * Every committed transaction, including ones later undone.
   *
   * Separate from the undo stack and never truncated. A grader wants to know
   * the candidate used Merge & Center even if they undid it, and the undo
   * stack is capped, so it cannot be the record of what happened.
   */
  private readonly log: Transaction[] = [];

  private readonly listeners = new Set<CommandListener>();
  private nextId = 1;

  constructor(private readonly workbook: Workbook) {}

  /**
   * Runs a command as one undoable unit.
   *
   * A command that changes nothing — clicking Bold on already-bold text —
   * leaves no transaction, so Undo never appears to do nothing.
   */
  run(meta: CommandMeta, body: (mutator: WorkbookMutator) => void): Transaction | null {
    const operations: Operation[] = [];
    body(new WorkbookMutator(this.workbook, operations));

    if (operations.length === 0) return null;

    const transaction: Transaction = {
      id: this.nextId++,
      label: meta.label,
      source: meta.source,
      ...(meta.control === undefined ? {} : { control: meta.control }),
      timestamp: Date.now(),
      operations,
    };

    this.undoStack.push(transaction);
    if (this.undoStack.length > MAX_UNDO_DEPTH) this.undoStack.shift();

    // A new edit invalidates the redo branch, as every editor does.
    this.redoStack.length = 0;

    this.log.push(transaction);
    this.emit(transaction);
    return transaction;
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /** The label Undo would reverse, for the tooltip. */
  undoLabel(): string | null {
    return this.undoStack[this.undoStack.length - 1]?.label ?? null;
  }

  redoLabel(): string | null {
    return this.redoStack[this.redoStack.length - 1]?.label ?? null;
  }

  undo(): Transaction | null {
    const transaction = this.undoStack.pop();
    if (!transaction) return null;

    // Reversed: operations within a transaction are ordered, and undoing them
    // forwards would reapply an earlier one over a later one.
    for (let index = transaction.operations.length - 1; index >= 0; index -= 1) {
      this.revert(transaction.operations[index]!);
    }

    this.redoStack.push(transaction);
    this.emit(transaction);
    return transaction;
  }

  redo(): Transaction | null {
    const transaction = this.redoStack.pop();
    if (!transaction) return null;

    for (const operation of transaction.operations) this.apply(operation);

    this.undoStack.push(transaction);
    this.emit(transaction);
    return transaction;
  }

  /** The full history, for inspection. Never sent anywhere by this class. */
  operationLog(): readonly Transaction[] {
    return this.log;
  }

  subscribe(listener: CommandListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(transaction: Transaction): void {
    for (const listener of this.listeners) listener(transaction);
  }

  private apply(operation: Operation): void {
    this.move(operation, 'after');
  }

  private revert(operation: Operation): void {
    this.move(operation, 'before');
  }

  /**
   * Applies an operation in either direction.
   *
   * Undo and redo differ only in which recorded state they aim at, so they
   * share one implementation — two would drift, and the drift would show up as
   * a redo that does not match the original edit.
   */
  private move(operation: Operation, direction: 'before' | 'after'): void {
    const sheet = this.workbook.sheetById(operation.sheetId);

    switch (operation.kind) {
      case 'setCell':
        sheet?.setCell(operation.row, operation.col, operation[direction]);
        return;

      case 'setStyle': {
        if (!sheet) return;
        const existing = sheet.getCell(operation.row, operation.col);
        sheet.setCell(operation.row, operation.col, {
          value: existing?.value ?? null,
          ...existing,
          styleId: operation[direction],
        });
        return;
      }

      case 'setRowProps':
        sheet?.setRowProps(operation.row, operation[direction]);
        return;

      case 'setColumnProps':
        sheet?.setColumnProps(operation.col, operation[direction]);
        return;

      case 'merge':
        if (!sheet) return;
        if (direction === 'after') {
          sheet.mergeCells(operation.range);
          for (const { row, col } of operation.clearedCells) sheet.setCell(row, col, undefined);
        } else {
          sheet.unmergeAt(operation.range.start.row, operation.range.start.col);
          for (const { row, col, cell } of operation.clearedCells) sheet.setCell(row, col, cell);
        }
        return;

      case 'unmerge':
        if (!sheet) return;
        if (direction === 'after') sheet.unmergeAt(operation.range.start.row, operation.range.start.col);
        else sheet.mergeCells(operation.range);
        return;

      case 'addSheet':
        if (direction === 'after') {
          if (!this.workbook.sheetById(operation.sheetId)) {
            this.workbook.addSheet(new Worksheet(operation.sheetId, operation.name), operation.index);
          }
        } else {
          this.workbook.removeSheet(operation.sheetId);
        }
        return;

      case 'removeSheet':
        if (direction === 'after') {
          this.workbook.removeSheet(operation.sheetId);
        } else if (!this.workbook.sheetById(operation.sheetId)) {
          const restored = new Worksheet(operation.sheetId, operation.name);
          for (const { row, col, cell } of operation.cells) restored.setCell(row, col, cell);
          for (const [row, props] of operation.rows) restored.setRowProps(row, props);
          for (const [col, props] of operation.columns) restored.setColumnProps(col, props);
          for (const range of operation.merges) restored.mergeCells(range);
          restored.freeze(operation.frozen.rows, operation.frozen.columns);
          this.workbook.addSheet(restored, operation.index);
        }
        return;

      case 'renameSheet': {
        const target = this.workbook.sheetById(operation.sheetId);
        if (target) target.name = operation[direction];
        return;
      }

      case 'moveSheet':
        this.workbook.moveSheet(operation.sheetId, operation[direction]);
        return;

      case 'setSheetVisible': {
        const target = this.workbook.sheetById(operation.sheetId);
        if (target) target.visible = operation[direction];
        return;
      }

      case 'setSheetView':
        if (sheet) sheet.view = { ...operation[direction] };
        return;

      case 'setPrintArea':
        if (sheet) {
          const range = operation[direction];
          sheet.printArea = range ? { start: { ...range.start }, end: { ...range.end } } : null;
        }
        return;

      case 'setFrozen':
        sheet?.freeze(operation[direction].rows, operation[direction].columns);
        return;
    }
  }
}
