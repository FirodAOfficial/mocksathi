import { CommandBus, type CommandMeta, type WorkbookMutator } from './commands/CommandBus';
import type { CommandSource } from './commands/Operation';
import { DependencyGraph, nodeId, parseNodeId } from './calc/DependencyGraph';
import { loadFormulaEngine } from './calc/FastFormulaEngine';
import type { FormulaEngine } from './calc/FormulaEngine';
import type { Cell } from './model/Cell';
import { formatCellValue, isDateTimeFormat } from './model/format';
import { completeFormula, parseCellInput } from './model/parseInput';
import { DEFAULT_STYLE_ID, type CellStyle, type StyleId } from './model/styles';
import { formatAddress, isSingleCell, type CellAddress, type RangeAddress } from './model/address';
import {
  bodyRows,
  cloneFilter,
  columnValues,
  currentRegion,
  hiddenRows,
  isNumberColumn,
  type AutoFilter,
  type FilterCondition,
  type ReadCell,
} from './model/autoFilter';
import { autoSumTargets } from './model/autoSumRange';
import { fillSeries } from './model/fillSeries';
import { snapshotSheet } from './model/snapshot';
import {
  applySheetEdit,
  sortBlocker,
  sortSheetRange,
  type SheetEdit,
  type SortDirection,
} from './model/structuralEdit';
import { translateFormula } from './model/translateFormula';
import { Workbook } from './model/Workbook';
import type { Worksheet } from './model/Worksheet';
import { SelectionModel } from './grid/SelectionModel';

/**
 * The workbook, as the React tree reaches it.
 *
 * React does not own the cells. A sheet is a `Map` of a few thousand entries
 * behind an index and a dependency graph; putting that in `useState` would mean
 * either copying it on every keystroke or lying to React about immutability.
 * Instead the store is a plain object with a version counter, and components
 * subscribe through `useSyncExternalStore`.
 *
 * That version is deliberately a number rather than a snapshot object: the
 * grid re-reads the cells it is painting anyway, so building a snapshot would
 * be work with no reader.
 *
 * Everything that changes the workbook goes through `CommandBus`, so undo, the
 * operation log and (later) exam marking see every edit without any component
 * having to remember to record it.
 */

export type WorkbookListener = () => void;

/** The Paste menu's choices. */
export type PasteMode = 'all' | 'values' | 'formulas' | 'formats';

export type FillDirection = 'down' | 'right' | 'up' | 'left';

export interface FindOptions {
  matchCase: boolean;
  /** Excel's "Match entire cell contents". */
  entireCell: boolean;
}

const PASTE_LABELS: Record<PasteMode, string> = {
  all: 'Paste',
  values: 'Paste Values',
  formulas: 'Paste Formulas',
  formats: 'Paste Formatting',
};

const PASTE_CONTROLS: Record<PasteMode, string> = {
  all: 'home.clipboard.paste',
  values: 'home.clipboard.pasteValues',
  formulas: 'home.clipboard.pasteFormulas',
  formats: 'home.clipboard.pasteFormatting',
};

const FILL_LABELS: Record<FillDirection, string> = {
  down: 'Fill Down',
  right: 'Fill Right',
  up: 'Fill Up',
  left: 'Fill Left',
};

/** Where recalculation stands, for the status bar. */
export type CalcState = 'idle' | 'loading' | 'calculating' | 'unavailable';

export class WorkbookStore {
  /**
   * Reassigned by `load`, which is why these are not `readonly`.
   *
   * A sitting moves between questions and each question owns its own workbook,
   * so the store outlives the workbook it holds. Components read through the
   * store, so replacing what is behind it is invisible to them.
   */
  workbook: Workbook;
  commands: CommandBus;
  readonly selection = new SelectionModel({
    covering: (row, col) => this.activeSheet().mergeCovering(row, col),
    all: () => this.activeSheet().mergedRanges(),
  });

  private graph = new DependencyGraph();
  private readonly listeners = new Set<WorkbookListener>();

  private version = 0;
  private engine: FormulaEngine | null = null;
  private engineLoading: Promise<FormulaEngine | null> | null = null;
  private calcState: CalcState = 'idle';

  /** Cells in a circular reference, so the grid can show them as `#REF!`-ish. */
  private circular = new Set<string>();

  /**
   * The last copy or cut, kept in memory.
   *
   * Not the system clipboard. Reading that needs a permission prompt and gives
   * text, not styles; writing to it would put workbook contents somewhere the
   * user did not ask for them to go. Within-app copy/paste is what a practical
   * paper tests, and it is what this does — honestly labelled, since pasting
   * from another application is not supported.
   */
  private clipboard: ClipboardContents | null = null;

  /** The formatting Format Painter picked up, waiting for a selection to paint. */
  private formatBrush: FormatBrush | null = null;

  /**
   * The furthest cell reached, which extends the scrollable area.
   *
   * Held here rather than in the grid because jumping to `Z5000` from the Name
   * Box must survive the grid unmounting when a drawer opens on a phone.
   */
  reach: CellAddress = { row: 0, col: 0 };

  constructor(workbook: Workbook = Workbook.blank()) {
    this.workbook = workbook;
    this.commands = new CommandBus(workbook);
  }

  /**
   * Replaces the workbook wholesale.
   *
   * Used when the candidate moves to another question. Everything derived from
   * the old workbook goes with it — and the command bus most of all: an undo
   * stack that survived would let Undo on question 5 pull question 4's edits
   * back in, which is the spreadsheet version of the bug
   * `useQuestionAnswers.install` avoids by re-creating the editor state.
   */
  load(workbook: Workbook): void {
    this.workbook = workbook;
    this.commands = new CommandBus(workbook);
    this.graph = new DependencyGraph();
    this.circular = new Set();
    this.formatBrush = null;
    this.selection.selectCell({ row: 0, col: 0 });
    this.reach = { row: 0, col: 0 };

    // The engine belongs to the session, not to one workbook — but it resolves
    // cells through `this.workbook`, so it keeps working against the new one.
    if (this.engine) {
      this.rebuildDependencies();
      this.recalculateAll();
    }

    this.changed();
  }

  /* -- Subscription ------------------------------------------------------ */

  subscribe = (listener: WorkbookListener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getVersion = (): number => this.version;

  private changed(): void {
    this.version += 1;
    for (const listener of this.listeners) listener();
  }

  /* -- Reading ----------------------------------------------------------- */

  activeSheet() {
    const sheet = this.workbook.activeSheet();
    if (!sheet) throw new Error('A workbook always has at least one sheet.');
    return sheet;
  }

  getCalcState(): CalcState {
    return this.calcState;
  }

  isCircular(sheetId: string, row: number, col: number): boolean {
    return this.circular.has(nodeId(sheetId, row, col));
  }

  styleAt(row: number, col: number): CellStyle {
    const sheet = this.activeSheet();
    return this.workbook.styles.get(sheet.getCell(row, col)?.styleId ?? DEFAULT_STYLE_ID);
  }

  /** What the formula bar shows: the source for a formula, the value otherwise. */
  editText(row: number, col: number): string {
    const cell = this.activeSheet().getCell(row, col);
    if (!cell) return '';
    if (cell.formula !== undefined) return cell.formula;
    if (cell.value === null) return '';

    const style = this.workbook.styles.get(cell.styleId);

    // A date is a number, and the formula bar showing `46288` for a cell
    // reading `23-09-2026` would be true and useless — worse, re-committing
    // that text would turn the date into the number.
    if (typeof cell.value === 'number' && isDateTimeFormat(style.numberFormat)) {
      return formatCellValue(cell.value, style.numberFormat);
    }

    // The apostrophe is part of what was typed, not of the text, so it comes
    // back the way it went in: re-committing the cell must not re-read `007`
    // as a number.
    if (style.quotePrefix) return `'${String(cell.value)}`;

    return String(cell.value);
  }

  /* -- Writing ----------------------------------------------------------- */

  /**
   * Runs a command and recalculates what it affected.
   *
   * Every mutating method funnels through here, which is what keeps "changed
   * cells" and "recalculated cells" from drifting apart.
   */
  private commit(meta: CommandMeta, body: (mutator: WorkbookMutator) => void): void {
    const transaction = this.commands.run(meta, body);
    if (!transaction) return;

    const touched: Array<{ sheetId: string; address: CellAddress }> = [];
    for (const operation of transaction.operations) {
      if (operation.kind === 'setCell' || operation.kind === 'setStyle') {
        touched.push({
          sheetId: operation.sheetId,
          address: { row: operation.row, col: operation.col },
        });
      }
    }

    this.recalculate(touched);
    this.changed();
  }

  /**
   * Takes what the user typed into a cell.
   *
   * `=` makes it a formula; anything else is coerced the way Excel coerces it.
   * The formula's value is left null until the engine has loaded, and the cell
   * shows nothing rather than a stale or invented number.
   */
  setCellInput(row: number, col: number, input: string, source: CommandSource = 'grid'): void {
    const sheet = this.activeSheet();
    const existing = sheet.getCell(row, col);
    const baseStyleId = existing?.styleId ?? DEFAULT_STYLE_ID;

    const { cell, isFormula } = this.cellFromInput(input, baseStyleId);

    this.commit({ label: isFormula ? 'Enter Formula' : 'Type', source }, (mutator) => {
      mutator.setCell(sheet.id, row, col, cell);
    });

    if (isFormula) void this.ensureEngine();
    else this.graph.clear(nodeId(sheet.id, row, col));
  }

  /** What typing `input` over a cell styled `baseStyleId` leaves in it. */
  private cellFromInput(input: string, baseStyleId: StyleId): { cell: Cell | undefined; isFormula: boolean } {
    const isFormula = input.startsWith('=') && input.length > 1;
    return {
      cell: isFormula ? this.buildFormulaCell(input, baseStyleId) : this.buildValueCell(input, baseStyleId),
      isFormula,
    };
  }

  /** A formula replaces whatever the apostrophe said about the old text. */
  private buildFormulaCell(input: string, baseStyleId: StyleId): Cell {
    return {
      value: null,
      formula: completeFormula(input),
      styleId: this.workbook.styles.derive(baseStyleId, { quotePrefix: undefined }),
    };
  }

  /**
   * AutoSum, and its Average and Count siblings: totals where Excel would put
   * them for the current selection (see `autoSumTargets`), as one undoable
   * step. Returns false, writing nothing, when there is nothing to total.
   */
  autoSum(fn: 'SUM' | 'AVERAGE' | 'COUNT' | 'MAX' | 'MIN', control: string): boolean {
    const sheet = this.activeSheet();
    const selected = this.selection.getRanges()[0];
    if (!selected) return false;

    const writes = autoSumTargets(sheet, selected, this.selection.getActive());
    if (writes.length === 0) return false;

    this.commit({ label: 'AutoSum', source: 'ribbon', control }, (mutator) => {
      for (const { cell, range } of writes) {
        const reference = `${formatAddress(range.start)}:${formatAddress(range.end)}`;
        const baseStyleId = sheet.getCell(cell.row, cell.col)?.styleId ?? DEFAULT_STYLE_ID;
        mutator.setCell(sheet.id, cell.row, cell.col, this.buildFormulaCell(`=${fn}(${reference})`, baseStyleId));
      }
    });

    void this.ensureEngine();
    return true;
  }

  /**
   * A cell from a typed entry, with the format that entry implies.
   *
   * The style is derived rather than reused because typing `23/09/2026` into a
   * General cell has to *do* something visible: storing the serial 46288 and
   * leaving the format alone would show the candidate a five-digit number and
   * look like the date had been thrown away.
   */
  private buildValueCell(input: string, baseStyleId: StyleId): Cell | undefined {
    const parsed = parseCellInput(input, this.workbook.styles.get(baseStyleId).numberFormat);

    const styleId = this.workbook.styles.derive(baseStyleId, {
      quotePrefix: parsed.quotePrefix ? true : undefined,
      // Absent means "leave the cell's format alone", so it must not be spread
      // in as an explicit `undefined` — that would clear the format instead.
      ...(parsed.numberFormat === undefined ? {} : { numberFormat: parsed.numberFormat }),
    });

    if (parsed.value === null && styleId === DEFAULT_STYLE_ID) return undefined;
    return { value: parsed.value, styleId };
  }

  /** Delete/Backspace on a selection: clears contents, keeps formatting. */
  clearContents(source: CommandSource = 'keyboard'): void {
    const sheet = this.activeSheet();

    this.commit({ label: 'Clear Contents', source }, (mutator) => {
      for (const { row, col } of this.selection.addresses()) {
        const existing = sheet.getCell(row, col);
        if (!existing) continue;

        this.graph.clear(nodeId(sheet.id, row, col));
        mutator.setCell(
          sheet.id,
          row,
          col,
          existing.styleId === DEFAULT_STYLE_ID
            ? undefined
            : { value: null, styleId: existing.styleId },
        );
      }
    });
  }

  /**
   * Home > Clear > Clear Formats: every selected cell back to the default
   * style, its value untouched. A cell that held nothing but formatting goes.
   */
  clearFormats(): void {
    const sheet = this.activeSheet();

    this.commit({ label: 'Clear Formats', source: 'ribbon', control: 'home.editing.clearFormats' }, (mutator) => {
      for (const { row, col } of this.selection.addresses()) {
        const existing = sheet.getCell(row, col);
        if (!existing || existing.styleId === DEFAULT_STYLE_ID) continue;

        if (existing.value === null && existing.formula === undefined) mutator.setCell(sheet.id, row, col, undefined);
        else mutator.setStyle(sheet.id, row, col, DEFAULT_STYLE_ID);
      }
    });
  }

  /** Home > Clear > Clear All: contents and formatting both. */
  clearAll(): void {
    const sheet = this.activeSheet();

    this.commit({ label: 'Clear All', source: 'ribbon', control: 'home.editing.clearAll' }, (mutator) => {
      for (const { row, col } of this.selection.addresses()) {
        if (sheet.getCell(row, col)) mutator.setCell(sheet.id, row, col, undefined);
      }
    });
  }

  /** Applies a formatting change to every selected cell. */
  applyStyle(changes: Partial<CellStyle>, label: string, control?: string): void {
    const sheet = this.activeSheet();

    this.commit(
      { label, source: 'ribbon', ...(control === undefined ? {} : { control }) },
      (mutator) => {
        for (const { row, col } of this.selection.addresses()) {
          const existing = sheet.getCell(row, col);
          const styleId: StyleId = this.workbook.styles.derive(
            existing?.styleId ?? DEFAULT_STYLE_ID,
            changes,
          );
          mutator.setStyle(sheet.id, row, col, styleId);
        }
      },
    );
  }

  /**
   * Applies formatting that differs per cell.
   *
   * `applyStyle` puts one style on every selected cell, which is right for Bold
   * and wrong for Outside Borders — where the top row wants a top edge and the
   * interior wants nothing. Both go through the same transaction so either is
   * one undo.
   */
  applyStylePerCell(
    changesFor: (address: CellAddress) => Partial<CellStyle>,
    label: string,
    control?: string,
  ): void {
    const sheet = this.activeSheet();

    this.commit(
      { label, source: 'ribbon', ...(control === undefined ? {} : { control }) },
      (mutator) => {
        for (const address of this.selection.addresses()) {
          const existing = sheet.getCell(address.row, address.col);
          mutator.setStyle(
            sheet.id,
            address.row,
            address.col,
            this.workbook.styles.derive(existing?.styleId ?? DEFAULT_STYLE_ID, changesFor(address)),
          );
        }
      },
    );
  }

  /**
   * Auto Fill: extends the source range over the cells dragged into.
   *
   * Fills column by column when dragged down and row by row when dragged
   * across, so each line continues its own series — dragging a two-column table
   * down continues both columns independently, which is what Excel does and
   * what makes the gesture worth having.
   *
   * Formatting travels with the value: filling a formatted cell carries its
   * style, as Excel's default Fill Series does.
   */
  fillFrom(source: RangeAddress, target: RangeAddress): boolean {
    const sheet = this.activeSheet();
    const down = target.end.row > source.end.row || target.start.row < source.start.row;

    const lines = down
      ? rangeColumns(source).map((col) => ({
          seed: rangeRows(source).map((row) => ({ row, col })),
          into: rowsBetween(source, target).map((row) => ({ row, col })),
        }))
      : rangeRows(source).map((row) => ({
          seed: rangeColumns(source).map((col) => ({ row, col })),
          into: columnsBetween(source, target).map((col) => ({ row, col })),
        }));

    if (lines.every((line) => line.into.length === 0)) return false;

    this.commit({ label: 'Fill Series', source: 'grid' }, (mutator) => {
      for (const line of lines) {
        const seedCells = line.seed.map((address) => sheet.getCell(address.row, address.col));
        const values = fillSeries(
          seedCells.map((cell) => cell?.value ?? null),
          line.into.length,
        );

        line.into.forEach((address, index) => {
          const value = values[index] ?? null;
          // The style repeats across the fill the way the values do.
          const template = seedCells[index % seedCells.length];

          mutator.setCell(sheet.id, address.row, address.col, {
            value,
            styleId: template?.styleId ?? DEFAULT_STYLE_ID,
          });
        });
      }
    });

    return true;
  }

  /**
   * Inserts or deletes rows or columns, moving every formula that pointed there.
   *
   * The whole sheet is rebuilt from a transformed snapshot, because the cells,
   * the row heights, the merges, the frozen panes, the print area *and* every
   * formula on the sheet all move together — and a formula left pointing at the
   * old position gives a plausible wrong number.
   */
  editStructure(edit: SheetEdit, label: string, control: string): void {
    const sheet = this.activeSheet();
    const before = snapshotSheet(sheet, this.workbook);
    const after = applySheetEdit(before, edit);

    this.commit({ label, source: 'ribbon', control }, (mutator) => {
      mutator.replaceSheet(sheet.id, before, after);
    });

    this.rebuildDependencies();
    this.recalculateAll();
  }

  /**
   * Sorts the selected range by one of its columns.
   *
   * Returns the reason it could not, so the caller can say so. Sorting a range
   * holding formulas or merged cells is refused rather than attempted: moving
   * rows would have to move their references too, and being subtly wrong about
   * that is worse than declining.
   */
  sortSelection(direction: SortDirection): string | null {
    const sheet = this.activeSheet();
    const selected = this.selection.getRanges()[0];
    if (!selected) return 'nothing is selected';

    // A single cell means "sort the block around me", which is what Excel does.
    const range = isSingleCell(selected) ? (sheet.usedRange() ?? selected) : selected;

    const before = snapshotSheet(sheet, this.workbook);
    const blocker = sortBlocker(before, range);
    if (blocker) return blocker;

    const after = sortSheetRange(before, range, range.start.col, direction);

    this.commit(
      { label: direction === 'asc' ? 'Sort A to Z' : 'Sort Z to A', source: 'ribbon', control: 'data.sort' },
      (mutator) => mutator.replaceSheet(sheet.id, before, after),
    );

    this.selection.selectRange(range);
    return null;
  }

  /* -- AutoFilter --------------------------------------------------------- */

  /** How a filter reads a cell: the text the grid shows, and the value behind it. */
  private filterReader(sheet = this.activeSheet()): ReadCell {
    return (row, col) => {
      const cell = sheet.getCell(row, col);
      if (!cell || cell.value === null) return { text: '', value: null };
      return { text: formatCellValue(cell.value, this.workbook.styles.get(cell.styleId).numberFormat), value: cell.value };
    };
  }

  /** The values a column's checklist offers, given the other columns' filters. */
  filterValues(col: number): string[] {
    const filter = this.activeSheet().autoFilter;
    return filter ? columnValues(filter, col, this.filterReader()) : [];
  }

  /** Whether a filter column offers Number Filters rather than Text Filters. */
  filterIsNumeric(col: number): boolean {
    const filter = this.activeSheet().autoFilter;
    return filter ? isNumberColumn(filter, col, this.filterReader()) : false;
  }

  /**
   * Data > Filter: puts drop-down buttons on the table around the selection,
   * or takes them off again — showing every row they had hidden.
   *
   * Returns why it could not, or null. The table is the selection when more
   * than one cell is selected, otherwise the filled block around the cursor.
   */
  toggleAutoFilter(): string | null {
    const sheet = this.activeSheet();
    const existing = sheet.autoFilter;

    if (existing) {
      this.commit({ label: 'Filter', source: 'ribbon', control: 'data.filter' }, (mutator) => {
        mutator.setAutoFilter(sheet.id, null);
        this.setRowsHidden(mutator, sheet, bodyRows(existing), () => false);
      });
      return null;
    }

    const filled = (row: number, col: number): boolean => (sheet.getCell(row, col)?.value ?? null) !== null;
    const selected = this.selection.getRanges()[0];
    const active = this.selection.getActive();
    const used = sheet.usedRange();
    if (!used) return 'the sheet is empty — type the table first';

    let range: RangeAddress =
      selected && !isSingleCell(selected) ? selected : currentRegion({ start: active, end: active }, filled);
    // A selected whole column is a million rows; the table ends where the data does.
    range = {
      start: range.start,
      end: { row: Math.min(range.end.row, used.end.row), col: Math.min(range.end.col, used.end.col) },
    };

    let any = false;
    for (let col = range.start.col; col <= range.end.col && !any; col += 1) any = filled(range.start.row, col);
    if (!any) return 'select a cell in the table, with its headings in the first row';

    this.commit({ label: 'Filter', source: 'ribbon', control: 'data.filter' }, (mutator) => {
      mutator.setAutoFilter(sheet.id, { range, columns: {} });
    });
    return null;
  }

  /**
   * A column's filter, from its drop-down: a condition, or null for Clear
   * Filter From. Rows failing any column's condition are hidden.
   */
  setColumnFilter(col: number, condition: FilterCondition | null): void {
    const sheet = this.activeSheet();
    const filter = sheet.autoFilter;
    if (!filter) return;

    const next = this.grownFilter(filter);
    if (condition) next.columns[col] = condition;
    else delete next.columns[col];

    this.commit(
      { label: condition ? 'Filter' : 'Clear Filter', source: 'ribbon', control: 'data.filter.column' },
      (mutator) => {
        mutator.setAutoFilter(sheet.id, next);
        this.applyFilterRows(mutator, sheet, next);
      },
    );
  }

  /** Data > Clear: every column's condition removed, every row shown. */
  clearFilters(): void {
    const sheet = this.activeSheet();
    const filter = sheet.autoFilter;
    if (!filter) return;

    const next = this.grownFilter(filter);
    next.columns = {};
    this.commit({ label: 'Clear Filter', source: 'ribbon', control: 'data.filter.clear' }, (mutator) => {
      mutator.setAutoFilter(sheet.id, next);
      this.applyFilterRows(mutator, sheet, next);
    });
  }

  /** Data > Reapply: the same conditions over the table as it is now. */
  reapplyFilter(): void {
    const sheet = this.activeSheet();
    const filter = sheet.autoFilter;
    if (!filter) return;

    const next = this.grownFilter(filter);
    this.commit({ label: 'Reapply', source: 'ribbon', control: 'data.filter.reapply' }, (mutator) => {
      mutator.setAutoFilter(sheet.id, next);
      this.applyFilterRows(mutator, sheet, next);
    });
  }

  /**
   * Sort A to Z (or Z to A) from a column's drop-down: the rows under the
   * header, by that column, with the filter applied again afterwards.
   */
  sortFilterColumn(col: number, direction: SortDirection): string | null {
    const sheet = this.activeSheet();
    const filter = sheet.autoFilter;
    if (!filter) return 'there is no filter';

    const grown = this.grownFilter(filter);
    if (grown.range.end.row <= grown.range.start.row) return 'there are no rows under the headings';
    const body: RangeAddress = {
      start: { row: grown.range.start.row + 1, col: grown.range.start.col },
      end: grown.range.end,
    };

    const before = snapshotSheet(sheet, this.workbook);
    const blocker = sortBlocker(before, body);
    if (blocker) return blocker;
    const after = sortSheetRange(before, body, col, direction);

    this.commit(
      { label: direction === 'asc' ? 'Sort A to Z' : 'Sort Z to A', source: 'ribbon', control: 'data.filter.sort' },
      (mutator) => {
        mutator.replaceSheet(sheet.id, before, after);
        // Rebuilt by the replace, so the sheet is read again.
        const sorted = this.workbook.sheetById(sheet.id);
        if (!sorted) return;
        mutator.setAutoFilter(sheet.id, grown);
        this.applyFilterRows(mutator, sorted, grown);
      },
    );
    return null;
  }

  /** The filter with its range grown over rows typed in directly below the table. */
  private grownFilter(filter: AutoFilter): AutoFilter {
    const sheet = this.activeSheet();
    const next = cloneFilter(filter)!;
    const rowFilled = (row: number): boolean => {
      for (let col = next.range.start.col; col <= next.range.end.col; col += 1) {
        if ((sheet.getCell(row, col)?.value ?? null) !== null) return true;
      }
      return false;
    };
    while (rowFilled(next.range.end.row + 1)) next.range.end.row += 1;
    return next;
  }

  private applyFilterRows(mutator: WorkbookMutator, sheet: Worksheet, filter: AutoFilter): void {
    const hidden = hiddenRows(filter, this.filterReader(sheet));
    this.setRowsHidden(mutator, sheet, bodyRows(filter), (row) => hidden.has(row));
  }

  private setRowsHidden(
    mutator: WorkbookMutator,
    sheet: Worksheet,
    rows: readonly number[],
    hide: (row: number) => boolean,
  ): void {
    for (const row of rows) {
      const want = hide(row);
      const existing = sheet.rows.get(row);
      if (Boolean(existing?.hidden) === want) continue;
      mutator.setRowProps(sheet.id, row, cleanProps({ ...existing, hidden: want || undefined }));
    }
  }

  setColumnWidth(col: number, width: number): void {
    const sheet = this.activeSheet();
    const existing = sheet.columns.get(col);

    this.commit({ label: 'Column Width', source: 'grid' }, (mutator) => {
      mutator.setColumnProps(sheet.id, col, { ...existing, width: Math.max(0, Math.round(width)) });
    });
  }

  setRowHeight(row: number, height: number): void {
    const sheet = this.activeSheet();
    const existing = sheet.rows.get(row);

    this.commit({ label: 'Row Height', source: 'grid' }, (mutator) => {
      mutator.setRowProps(sheet.id, row, { ...existing, height: Math.max(0, Math.round(height)) });
    });
  }

  /**
   * Format Cells' OK: everything its tabs changed, as one undoable step.
   *
   * `merge` is the Alignment tab's Merge cells box — true merges the selection,
   * false unmerges every merge inside it, undefined leaves merges alone.
   * Returns false when a requested merge was refused because it overlaps one
   * that reaches outside the selection; the formatting is applied regardless.
   */
  formatCells(changesFor: (address: CellAddress) => Partial<CellStyle>, merge: boolean | undefined): boolean {
    const sheet = this.activeSheet();
    const range = this.selection.getRanges()[0];
    let refused = false;

    this.commit({ label: 'Format Cells', source: 'ribbon', control: 'home.formatCells' }, (mutator) => {
      if (range && merge === false) {
        for (const existing of sheet.mergedRanges()) {
          const overlaps =
            existing.start.row <= range.end.row &&
            existing.end.row >= range.start.row &&
            existing.start.col <= range.end.col &&
            existing.end.col >= range.start.col;
          if (overlaps) mutator.unmergeAt(sheet.id, existing.start.row, existing.start.col);
        }
      }
      if (range && merge === true && !isSingleCell(range)) refused = !mutator.mergeCells(sheet.id, range);

      for (const address of this.selection.addresses()) {
        const existing = sheet.getCell(address.row, address.col);
        mutator.setStyle(
          sheet.id,
          address.row,
          address.col,
          this.workbook.styles.derive(existing?.styleId ?? DEFAULT_STYLE_ID, changesFor(address)),
        );
      }
    });

    return !refused;
  }

  /**
   * Home > Fill > Down, Right, Up and Left: the first line of the selection
   * copied over the rest, formulas moved the way a paste moves them.
   *
   * A selection one line deep fills from its neighbour instead, which is what
   * Ctrl+D does on a single cell: the cell above comes down into it.
   */
  fill(direction: FillDirection): boolean {
    const sheet = this.activeSheet();
    const selected = this.selection.getRanges()[0];
    if (!selected) return false;

    const vertical = direction === 'down' || direction === 'up';
    const forward = direction === 'down' || direction === 'right';
    const first = vertical ? selected.start.row : selected.start.col;
    const last = vertical ? selected.end.row : selected.end.col;

    const source = first === last ? (forward ? first - 1 : last + 1) : forward ? first : last;
    if (source < 0) return false;

    const targets: number[] = [];
    for (let index = first; index <= last; index += 1) if (index !== source) targets.push(index);
    if (targets.length === 0) return false;

    const lines = vertical ? rangeColumns(selected) : rangeRows(selected);
    let formulas = false;

    this.commit(
      { label: FILL_LABELS[direction], source: 'ribbon', control: `home.editing.fill.${direction}` },
      (mutator) => {
        for (const line of lines) {
          const from = vertical ? { row: source, col: line } : { row: line, col: source };
          const cell = sheet.getCell(from.row, from.col);
          if (cell?.formula !== undefined) formulas = true;

          for (const index of targets) {
            const to = vertical ? { row: index, col: line } : { row: line, col: index };
            mutator.setCell(
              sheet.id,
              to.row,
              to.col,
              cell
                ? cell.formula === undefined
                  ? { ...cell }
                  : { ...cell, formula: translateFormula(cell.formula, to.row - from.row, to.col - from.col) }
                : undefined,
            );
          }
        }
      },
    );

    if (formulas) void this.ensureEngine();
    return true;
  }

  /**
   * Sets the height of rows or the width of columns, as Home > Format's Row
   * Height and Column Width do. `undefined` drops the override, which is what
   * AutoFit Row Height means for a row with nothing wrapped in it. A function
   * sizes each line on its own, as AutoFit Column Width does.
   */
  resize(
    axis: 'row' | 'column',
    indices: readonly number[],
    size: number | undefined | ((index: number) => number | undefined),
    label: string,
    control: string,
    source: CommandSource = 'ribbon',
  ): void {
    const sheet = this.activeSheet();

    this.commit({ label, source, control }, (mutator) => {
      for (const index of indices) {
        const raw = typeof size === 'function' ? size(index) : size;
        const value = raw === undefined ? undefined : Math.max(0, Math.round(raw));
        if (axis === 'row') mutator.setRowProps(sheet.id, index, cleanProps({ ...sheet.rows.get(index), height: value }));
        else mutator.setColumnProps(sheet.id, index, cleanProps({ ...sheet.columns.get(index), width: value }));
      }
    });
  }

  /** Home > Format > Hide & Unhide, for rows and columns. */
  setHidden(axis: 'row' | 'column', indices: readonly number[], hidden: boolean): boolean {
    const sheet = this.activeSheet();
    const props = axis === 'row' ? sheet.rows : sheet.columns;
    const changing = indices.filter((index) => Boolean(props.get(index)?.hidden) !== hidden);
    if (changing.length === 0) return false;

    const noun = axis === 'row' ? 'Rows' : 'Columns';
    this.commit(
      { label: `${hidden ? 'Hide' : 'Unhide'} ${noun}`, source: 'ribbon', control: `home.cells.format.${hidden ? 'hide' : 'unhide'}${noun}` },
      (mutator) => {
        for (const index of changing) {
          if (axis === 'row') mutator.setRowProps(sheet.id, index, cleanProps({ ...sheet.rows.get(index), hidden: hidden || undefined }));
          else mutator.setColumnProps(sheet.id, index, cleanProps({ ...sheet.columns.get(index), hidden: hidden || undefined }));
        }
      },
    );
    return true;
  }

  mergeSelection(): boolean {
    const sheet = this.activeSheet();
    const range = this.selection.getRanges()[0];
    if (!range) return false;

    let merged = false;
    this.commit({ label: 'Merge & Center', source: 'ribbon', control: 'home.alignment.merge' }, (mutator) => {
      merged = mutator.mergeCells(sheet.id, range);
    });
    return merged;
  }

  /**
   * Excel's Merge Across: one merge per row of the selection.
   *
   * A different command from Merge & Center, not a variant of it — merging
   * A1:D2 gives one cell, merging across gives two. A question asks for one or
   * the other and the answers are not interchangeable.
   */
  mergeAcross(): boolean {
    const sheet = this.activeSheet();
    const range = this.selection.getRanges()[0];
    if (!range) return false;

    let merged = false;
    this.commit({ label: 'Merge Across', source: 'ribbon', control: 'home.alignment.mergeAcross' }, (mutator) => {
      for (let row = range.start.row; row <= range.end.row; row += 1) {
        const across = { start: { row, col: range.start.col }, end: { row, col: range.end.col } };
        if (mutator.mergeCells(sheet.id, across)) merged = true;
      }
    });
    return merged;
  }

  /** Home > Merge > Merge Cells: one merged block, alignment left alone. */
  mergeCellsOnly(): boolean {
    const sheet = this.activeSheet();
    const range = this.selection.getRanges()[0];
    if (!range) return false;

    let merged = false;
    this.commit({ label: 'Merge Cells', source: 'ribbon', control: 'home.alignment.mergeCells' }, (mutator) => {
      merged = mutator.mergeCells(sheet.id, range);
    });
    return merged;
  }

  unmergeSelection(): void {
    const sheet = this.activeSheet();
    const active = this.selection.getActive();

    this.commit({ label: 'Unmerge Cells', source: 'ribbon', control: 'home.alignment.merge' }, (mutator) => {
      mutator.unmergeAt(sheet.id, active.row, active.col);
    });
  }

  /** Toggles gridlines or headings on the active sheet. */
  setSheetView(view: Partial<{ showGridlines: boolean; showHeadings: boolean }>, control: string): void {
    const sheet = this.activeSheet();
    this.commit({ label: 'Sheet View', source: 'ribbon', control }, (mutator) => {
      mutator.setSheetView(sheet.id, view);
    });
  }

  /** Sets the print area to the current selection, or clears it. */
  setPrintArea(range: RangeAddress | null): void {
    const sheet = this.activeSheet();
    this.commit(
      { label: range ? 'Set Print Area' : 'Clear Print Area', source: 'ribbon', control: 'pageLayout.pageSetup.printArea' },
      (mutator) => mutator.setPrintArea(sheet.id, range),
    );
  }

  freezePanes(rows: number, columns: number): void {
    const sheet = this.activeSheet();
    this.commit({ label: 'Freeze Panes', source: 'ribbon', control: 'view.window.freeze' }, (mutator) => {
      mutator.setFrozen(sheet.id, rows, columns);
    });
  }

  /* -- Clipboard ---------------------------------------------------------- */

  /** What Copy would put on the clipboard, or null when nothing is selected. */
  copySelection(cut = false): boolean {
    const sheet = this.activeSheet();
    const range = this.selection.getRanges()[0];
    if (!range) return false;

    const cells: ClipboardCell[] = [];
    for (const { row, col } of this.selection.addresses()) {
      const cell = sheet.getCell(row, col);
      if (cell) cells.push({ row, col, cell: { ...cell } });
    }

    this.clipboard = { origin: range.start, cells, cut, sheetId: sheet.id };
    this.changed();
    return true;
  }

  cutSelection(): boolean {
    return this.copySelection(true);
  }

  canPaste(): boolean {
    return this.clipboard !== null;
  }

  /**
   * Pastes at the cursor, translating relative references by how far the block
   * moved — the behaviour that makes a copied `=B1*2` still mean "the cell to
   * my left, doubled".
   *
   * `mode` is the Paste menu's choice. Values pastes what the cells showed,
   * Formulas pastes their contents without their formatting, Formatting pastes
   * only the formatting. A cut only pastes whole: Excel offers nothing else
   * after one, because a move that left the formatting behind is not a move.
   */
  paste(mode: PasteMode = 'all'): boolean {
    const clipboard = this.clipboard;
    if (!clipboard || (clipboard.cut && mode !== 'all')) return false;

    const sheet = this.activeSheet();
    const target = this.selection.getActive();
    const rowDelta = target.row - clipboard.origin.row;
    const colDelta = target.col - clipboard.origin.col;
    let formulas = false;

    const meta: CommandMeta = clipboard.cut
      ? { label: 'Cut', source: 'ribbon', control: 'home.clipboard.paste' }
      : { label: PASTE_LABELS[mode], source: 'ribbon', control: PASTE_CONTROLS[mode] };

    this.commit(meta, (mutator) => {
      if (clipboard.cut) {
        for (const { row, col } of clipboard.cells) {
          this.graph.clear(nodeId(clipboard.sheetId, row, col));
          mutator.setCell(clipboard.sheetId, row, col, undefined);
        }
      }

      for (const { row, col, cell } of clipboard.cells) {
        const to = { row: row + rowDelta, col: col + colDelta };
        if (to.row < 0 || to.col < 0) continue;

        const targetStyle = sheet.getCell(to.row, to.col)?.styleId ?? DEFAULT_STYLE_ID;
        const formula =
          cell.formula === undefined || clipboard.cut ? cell.formula : translateFormula(cell.formula, rowDelta, colDelta);

        switch (mode) {
          case 'formats':
            mutator.setStyle(sheet.id, to.row, to.col, cell.styleId);
            break;

          case 'values':
            mutator.setCell(
              sheet.id,
              to.row,
              to.col,
              cell.value === null && targetStyle === DEFAULT_STYLE_ID ? undefined : { value: cell.value, styleId: targetStyle },
            );
            break;

          case 'formulas':
            if (formula !== undefined) formulas = true;
            mutator.setCell(sheet.id, to.row, to.col, {
              value: cell.value,
              ...(formula === undefined ? {} : { formula }),
              styleId: targetStyle,
            });
            break;

          case 'all':
            if (formula !== undefined) formulas = true;
            // The value is left as the source's until recalculation runs; it
            // is replaced a few lines later, before anything paints.
            mutator.setCell(sheet.id, to.row, to.col, formula === undefined ? { ...cell } : { ...cell, formula });
            break;
        }
      }
    });

    // A cut is a move: the block is on the clipboard once.
    if (clipboard.cut) this.clipboard = null;
    if (formulas) void this.ensureEngine();
    return true;
  }

  /** Whether the clipboard holds a cut, which only pastes whole. */
  clipboardIsCut(): boolean {
    return this.clipboard?.cut === true;
  }

  /* -- Format Painter ----------------------------------------------------- */

  /**
   * Picks up the formatting of the selection, for the next selection to take.
   *
   * Only the cells that exist are recorded: an unformatted cell is the default
   * style, and a selected column of a million empty cells must not become a
   * million-entry brush.
   */
  pickUpFormat(): boolean {
    const sheet = this.activeSheet();
    const range = this.selection.getRanges()[0];
    if (!range) return false;

    const styles = new Map<string, StyleId>();
    for (const [address, cell] of sheet.entries()) {
      if (
        address.row >= range.start.row &&
        address.row <= range.end.row &&
        address.col >= range.start.col &&
        address.col <= range.end.col
      ) {
        styles.set(`${address.row - range.start.row}:${address.col - range.start.col}`, cell.styleId);
      }
    }

    this.formatBrush = {
      height: range.end.row - range.start.row + 1,
      width: range.end.col - range.start.col + 1,
      styles,
    };
    this.changed();
    return true;
  }

  hasFormatBrush(): boolean {
    return this.formatBrush !== null;
  }

  dropFormatBrush(): void {
    if (!this.formatBrush) return;
    this.formatBrush = null;
    this.changed();
  }

  /**
   * Paints the picked-up formatting over the selection, then puts the brush down.
   *
   * A single cell takes the brush's whole shape, as clicking once with Excel's
   * painter does; a larger selection is tiled with the pattern.
   */
  paintFormat(): boolean {
    const brush = this.formatBrush;
    const selected = this.selection.getRanges()[0];
    this.formatBrush = null;
    if (!brush || !selected) {
      this.changed();
      return false;
    }

    const sheet = this.activeSheet();
    const target: RangeAddress = isSingleCell(selected)
      ? {
          start: selected.start,
          end: { row: selected.start.row + brush.height - 1, col: selected.start.col + brush.width - 1 },
        }
      : selected;

    this.commit({ label: 'Format Painter', source: 'ribbon', control: 'home.clipboard.formatPainter' }, (mutator) => {
      for (let row = target.start.row; row <= target.end.row; row += 1) {
        for (let col = target.start.col; col <= target.end.col; col += 1) {
          const key = `${(row - target.start.row) % brush.height}:${(col - target.start.col) % brush.width}`;
          mutator.setStyle(sheet.id, row, col, brush.styles.get(key) ?? DEFAULT_STYLE_ID);
        }
      }
    });

    this.selection.selectRange(target);
    this.changed();
    return true;
  }

  /* -- Find & Replace ----------------------------------------------------- */

  /**
   * Every cell on the active sheet whose contents match, in Excel's search
   * order: across each row, then down.
   *
   * Matched against what the formula bar shows — the formula for a formula
   * cell — because that is Excel's default "Look in: Formulas".
   */
  findAll(query: string, options: FindOptions): CellAddress[] {
    if (query === '') return [];

    const found: CellAddress[] = [];
    for (const [address] of this.activeSheet().entries()) {
      if (textMatches(this.editText(address.row, address.col), query, options)) found.push(address);
    }
    return found.sort((a, b) => a.row - b.row || a.col - b.col);
  }

  /** Selects the next match after the active cell, wrapping round. */
  findNext(query: string, options: FindOptions): CellAddress | null {
    const found = this.findAll(query, options);
    const active = this.selection.getActive();
    const next =
      found.find((address) => address.row > active.row || (address.row === active.row && address.col > active.col)) ??
      found[0];
    if (!next) return null;

    this.selection.selectCell(next);
    this.extendReach(next);
    return next;
  }

  /**
   * Replaces the match in the active cell, if it is one, and moves to the next.
   * Returns whether a replacement was made.
   */
  replaceNext(query: string, replacement: string, options: FindOptions): boolean {
    const active = this.selection.getActive();
    const replaced = textMatches(this.editText(active.row, active.col), query, options)
      ? this.replaceIn([active], query, replacement, options, 'Replace') > 0
      : false;

    this.findNext(query, options);
    return replaced;
  }

  /** Replaces every match on the sheet as one undoable step; returns how many. */
  replaceAll(query: string, replacement: string, options: FindOptions): number {
    return this.replaceIn(this.findAll(query, options), query, replacement, options, 'Replace All');
  }

  private replaceIn(
    addresses: readonly CellAddress[],
    query: string,
    replacement: string,
    options: FindOptions,
    label: string,
  ): number {
    if (addresses.length === 0) return 0;

    const sheet = this.activeSheet();
    let formulas = false;

    this.commit({ label, source: 'ribbon', control: 'home.editing.replace' }, (mutator) => {
      for (const { row, col } of addresses) {
        const input = replaceText(this.editText(row, col), query, replacement, options);
        const { cell, isFormula } = this.cellFromInput(input, sheet.getCell(row, col)?.styleId ?? DEFAULT_STYLE_ID);
        if (isFormula) formulas = true;
        mutator.setCell(sheet.id, row, col, cell);
      }
    });

    if (formulas) void this.ensureEngine();
    return addresses.length;
  }

  /* -- Sheets ------------------------------------------------------------ */

  setActiveSheet(sheetId: string): void {
    if (!this.workbook.sheetById(sheetId)) return;

    this.workbook.activeSheetId = sheetId;
    this.selection.selectCell({ row: 0, col: 0 });
    this.reach = { row: 0, col: 0 };
    this.changed();
  }

  addSheet(): void {
    const name = this.workbook.suggestSheetName();
    let created: string | null = null;

    this.commit({ label: 'Insert Sheet', source: 'sheetTabs' }, (mutator) => {
      created = mutator.addSheet(name);
    });

    if (created) this.setActiveSheet(created);
  }

  renameSheet(sheetId: string, name: string): boolean {
    if (!this.workbook.canNameSheet(name, sheetId)) return false;

    this.commit({ label: 'Rename Sheet', source: 'sheetTabs' }, (mutator) => {
      mutator.renameSheet(sheetId, name);
    });
    return true;
  }

  /**
   * Hides the active sheet, or shows one that was hidden.
   *
   * Hiding the sheet you are looking at moves you to the next visible one —
   * otherwise the grid would be showing a sheet with no tab.
   */
  setSheetVisible(sheetId: string, visible: boolean): boolean {
    let changed = false;

    this.commit({ label: visible ? 'Unhide Sheet' : 'Hide Sheet', source: 'ribbon', control: 'view.window.hide' }, (mutator) => {
      changed = mutator.setSheetVisible(sheetId, visible);
    });

    if (changed && !visible && this.workbook.activeSheetId === sheetId) {
      const next = this.workbook.visibleSheets()[0];
      if (next) this.setActiveSheet(next.id);
    }

    return changed;
  }

  /** Sheets hidden from the tab strip but still in the workbook. */
  hiddenSheets() {
    return this.workbook.allSheets().filter((sheet) => !sheet.visible);
  }

  removeSheet(sheetId: string): void {
    if (this.workbook.sheetCount <= 1) return;

    this.commit({ label: 'Delete Sheet', source: 'sheetTabs' }, (mutator) => {
      mutator.removeSheet(sheetId);
    });
  }

  /* -- History ----------------------------------------------------------- */

  undo(): void {
    if (!this.commands.undo()) return;
    this.rebuildDependencies();
    this.recalculateAll();
    this.changed();
  }

  redo(): void {
    if (!this.commands.redo()) return;
    this.rebuildDependencies();
    this.recalculateAll();
    this.changed();
  }

  /* -- Navigation -------------------------------------------------------- */

  /** Records how far the user has gone, which is what the scrollbar spans. */
  extendReach(address: CellAddress): void {
    if (address.row <= this.reach.row && address.col <= this.reach.col) return;

    this.reach = {
      row: Math.max(this.reach.row, address.row),
      col: Math.max(this.reach.col, address.col),
    };
    this.changed();
  }

  /* -- Calculation ------------------------------------------------------- */

  /**
   * Loads the calculation engine, once.
   *
   * Called the first time a formula is entered rather than at startup: the
   * library is a heavy tree, and a sheet of typed numbers never needs it.
   */
  async ensureEngine(): Promise<FormulaEngine | null> {
    if (this.engine) return this.engine;
    if (this.engineLoading) return this.engineLoading;

    this.calcState = 'loading';
    this.changed();

    this.engineLoading = loadFormulaEngine(() => this.workbook)
      .then((engine) => {
        this.engine = engine;
        this.calcState = 'idle';
        this.rebuildDependencies();
        this.recalculateAll();
        this.changed();
        return engine;
      })
      .catch(() => {
        // Honest failure: formulas keep their source text and show `#NAME?`,
        // and the status bar says calculation is unavailable. Silently showing
        // stale values would be worse than showing none.
        this.calcState = 'unavailable';
        this.changed();
        return null;
      });

    return this.engineLoading;
  }

  /** Re-reads every formula's references. Used after undo, redo and load. */
  private rebuildDependencies(): void {
    const engine = this.engine;
    if (!engine) return;

    for (const node of this.graph.formulaCells()) this.graph.clear(node);

    for (const sheet of this.workbook.allSheets()) {
      for (const [address, cell] of sheet.entries()) {
        if (cell.formula === undefined) continue;

        this.graph.setDependencies(
          nodeId(sheet.id, address.row, address.col),
          engine.references(cell.formula, { sheetId: sheet.id, row: address.row, col: address.col }),
        );
      }
    }
  }

  private recalculate(changed: readonly { sheetId: string; address: CellAddress }[]): void {
    const engine = this.engine;
    if (!engine || changed.length === 0) return;

    // A formula that was just written must register what it reads before its
    // dependents can be found.
    for (const { sheetId, address } of changed) {
      const cell = this.workbook.sheetById(sheetId)?.getCell(address.row, address.col);
      const node = nodeId(sheetId, address.row, address.col);

      if (cell?.formula === undefined) this.graph.clear(node);
      else {
        this.graph.setDependencies(
          node,
          engine.references(cell.formula, { sheetId, row: address.row, col: address.col }),
        );
      }
    }

    const self = changed
      .map(({ sheetId, address }) => nodeId(sheetId, address.row, address.col))
      .filter((node) => {
        const parsed = parseNodeId(node);
        if (!parsed) return false;
        const cell = this.workbook
          .sheetById(parsed.sheetId)
          ?.getCell(parsed.address.row, parsed.address.col);
        return cell?.formula !== undefined;
      });

    const downstream = this.graph.planRecalc(changed);
    const plan = this.graph.order([...self, ...downstream.order]);

    this.circular = new Set([...downstream.cycles, ...plan.cycles]);
    this.evaluate(plan.order, engine);
  }

  private recalculateAll(): void {
    const engine = this.engine;
    if (!engine) return;

    const plan = this.graph.order(this.graph.formulaCells());
    this.circular = new Set(plan.cycles);
    this.evaluate(plan.order, engine);
  }

  /**
   * Writes computed values straight onto the cells.
   *
   * Deliberately not through the command bus: a recalculated value is not an
   * edit the user made, and putting it on the undo stack would mean Undo
   * stepped backwards through arithmetic instead of through actions.
   */
  private evaluate(order: readonly string[], engine: FormulaEngine): void {
    if (order.length === 0 && this.circular.size === 0) return;

    this.calcState = 'calculating';

    for (const node of order) {
      const parsed = parseNodeId(node);
      if (!parsed) continue;

      const sheet = this.workbook.sheetById(parsed.sheetId);
      const cell = sheet?.getCell(parsed.address.row, parsed.address.col);
      if (!sheet || !cell?.formula) continue;

      sheet.setCell(parsed.address.row, parsed.address.col, {
        ...cell,
        value: engine.evaluate(cell.formula, {
          sheetId: parsed.sheetId,
          row: parsed.address.row,
          col: parsed.address.col,
        }),
      });
    }

    for (const node of this.circular) {
      const parsed = parseNodeId(node);
      const sheet = parsed ? this.workbook.sheetById(parsed.sheetId) : undefined;
      const cell = parsed && sheet ? sheet.getCell(parsed.address.row, parsed.address.col) : undefined;
      if (!parsed || !sheet || !cell) continue;

      // Excel shows 0 and warns. Showing the error in the cell is clearer here,
      // where there is no modal to carry the warning.
      sheet.setCell(parsed.address.row, parsed.address.col, { ...cell, value: '#REF!' });
    }

    this.calcState = 'idle';
  }
}

function rangeRows(range: RangeAddress): number[] {
  const rows: number[] = [];
  for (let row = range.start.row; row <= range.end.row; row += 1) rows.push(row);
  return rows;
}

function rangeColumns(range: RangeAddress): number[] {
  const columns: number[] = [];
  for (let col = range.start.col; col <= range.end.col; col += 1) columns.push(col);
  return columns;
}

/** The rows the drag added below the source, in fill order. */
function rowsBetween(source: RangeAddress, target: RangeAddress): number[] {
  const rows: number[] = [];
  for (let row = source.end.row + 1; row <= target.end.row; row += 1) rows.push(row);
  return rows;
}

function columnsBetween(source: RangeAddress, target: RangeAddress): number[] {
  const columns: number[] = [];
  for (let col = source.end.col + 1; col <= target.end.col; col += 1) columns.push(col);
  return columns;
}

/** Row or column props with the cleared fields dropped; nothing left means none. */
function cleanProps<T extends object>(props: T): T | undefined {
  const entries = Object.entries(props).filter(([, value]) => value !== undefined);
  return entries.length === 0 ? undefined : (Object.fromEntries(entries) as T);
}

function textMatches(text: string, query: string, options: FindOptions): boolean {
  const haystack = options.matchCase ? text : text.toLowerCase();
  const needle = options.matchCase ? query : query.toLowerCase();
  return options.entireCell ? haystack === needle : haystack.includes(needle);
}

function replaceText(text: string, query: string, replacement: string, options: FindOptions): string {
  if (options.entireCell) return replacement;
  const pattern = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), options.matchCase ? 'g' : 'gi');
  // A function, so a `$` in the replacement is text rather than a group reference.
  return text.replace(pattern, () => replacement);
}

interface FormatBrush {
  height: number;
  width: number;
  /** Style ids keyed by `row:col` offset within the picked-up range. */
  styles: Map<string, StyleId>;
}

interface ClipboardCell {
  row: number;
  col: number;
  cell: Cell;
}

interface ClipboardContents {
  sheetId: string;
  origin: CellAddress;
  cells: ClipboardCell[];
  cut: boolean;
}

