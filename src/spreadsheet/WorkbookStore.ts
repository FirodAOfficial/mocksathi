import { CommandBus, type CommandMeta, type WorkbookMutator } from './commands/CommandBus';
import type { CommandSource } from './commands/Operation';
import { DependencyGraph, nodeId, parseNodeId } from './calc/DependencyGraph';
import { loadFormulaEngine } from './calc/FastFormulaEngine';
import type { FormulaEngine } from './calc/FormulaEngine';
import { coerceInput, type Cell } from './model/Cell';
import { DEFAULT_STYLE_ID, type CellStyle, type StyleId } from './model/styles';
import { isSingleCell, type CellAddress, type RangeAddress } from './model/address';
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
  readonly selection = new SelectionModel();

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
    const styleId = existing?.styleId ?? DEFAULT_STYLE_ID;

    const isFormula = input.startsWith('=') && input.length > 1;

    const cell: Cell | undefined = isFormula
      ? { value: null, formula: input, styleId }
      : buildValueCell(input, styleId);

    this.commit({ label: isFormula ? 'Enter Formula' : 'Type', source }, (mutator) => {
      mutator.setCell(sheet.id, row, col, cell);
    });

    if (isFormula) void this.ensureEngine();
    else this.graph.clear(nodeId(sheet.id, row, col));
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
   */
  paste(): boolean {
    const clipboard = this.clipboard;
    if (!clipboard) return false;

    const sheet = this.activeSheet();
    const target = this.selection.getActive();
    const rowDelta = target.row - clipboard.origin.row;
    const colDelta = target.col - clipboard.origin.col;

    this.commit({ label: clipboard.cut ? 'Cut' : 'Paste', source: 'ribbon', control: 'home.clipboard.paste' }, (mutator) => {
      if (clipboard.cut) {
        for (const { row, col } of clipboard.cells) {
          this.graph.clear(nodeId(clipboard.sheetId, row, col));
          mutator.setCell(clipboard.sheetId, row, col, undefined);
        }
      }

      for (const { row, col, cell } of clipboard.cells) {
        const to = { row: row + rowDelta, col: col + colDelta };
        if (to.row < 0 || to.col < 0) continue;

        mutator.setCell(
          sheet.id,
          to.row,
          to.col,
          cell.formula === undefined
            ? { ...cell }
            : {
                ...cell,
                // The value is left as the source's until recalculation runs;
                // it is replaced a few lines later, before anything paints.
                formula: clipboard.cut ? cell.formula : translateFormula(cell.formula, rowDelta, colDelta),
              },
        );
      }
    });

    // A cut is a move: the block is on the clipboard once.
    if (clipboard.cut) this.clipboard = null;
    return true;
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

function buildValueCell(input: string, styleId: StyleId): Cell | undefined {
  const value = coerceInput(input);
  if (value === null && styleId === DEFAULT_STYLE_ID) return undefined;
  return { value, styleId };
}
