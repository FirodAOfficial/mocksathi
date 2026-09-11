import { StyleRegistry } from './styles';
import { Worksheet } from './Worksheet';

/**
 * The workbook: sheets, the shared style registry, and defined names.
 *
 * This is the runtime structure the editor mutates — `Map`s and indexes, tuned
 * for editing. A separate plain-data serialisation shape will arrive with the
 * XLSX parser, which is the first thing that needs a deterministic output
 * format; inventing one now, before anything consumes it, would be guessing at
 * its requirements.
 *
 * Nothing here mutates itself in response to a UI event. Every change arrives
 * through the command layer, which is what makes undo and the operation log
 * correct by construction rather than by everyone remembering to record things.
 */

export interface DefinedName {
  name: string;
  /** An A1 reference, e.g. `Sheet1!$A$1:$B$10`. Stored as text, resolved on use. */
  reference: string;
  /** Absent means the name is global to the workbook. */
  sheetId?: string;
}

export class Workbook {
  readonly styles = new StyleRegistry();

  private readonly sheets: Worksheet[] = [];
  private readonly byId = new Map<string, Worksheet>();

  readonly definedNames = new Map<string, DefinedName>();

  /** The sheet the user is looking at. */
  activeSheetId = '';

  constructor(sheets: Worksheet[] = []) {
    for (const sheet of sheets) this.addSheet(sheet);
    if (this.sheets.length > 0) this.activeSheetId = this.sheets[0]!.id;
  }

  /** A workbook with one empty sheet, which is what `/spreadsheet` opens with. */
  static blank(): Workbook {
    return new Workbook([new Worksheet('sheet1', 'Sheet1')]);
  }

  get sheetCount(): number {
    return this.sheets.length;
  }

  /** Sheets in tab order. */
  allSheets(): readonly Worksheet[] {
    return this.sheets;
  }

  /** Only the sheets a user can see — hidden ones stay addressable by formulas. */
  visibleSheets(): Worksheet[] {
    return this.sheets.filter((sheet) => sheet.visible);
  }

  sheetById(id: string): Worksheet | undefined {
    return this.byId.get(id);
  }

  /**
   * Looks a sheet up by name, case-insensitively.
   *
   * Excel treats `Sheet1` and `SHEET1` as the same sheet in a formula, and a
   * workbook cannot contain both — so the lookup formulas go through has to
   * agree with the rule that keeps names unique.
   */
  sheetByName(name: string): Worksheet | undefined {
    const wanted = name.toLowerCase();
    return this.sheets.find((sheet) => sheet.name.toLowerCase() === wanted);
  }

  activeSheet(): Worksheet | undefined {
    return this.byId.get(this.activeSheetId);
  }

  addSheet(sheet: Worksheet, index?: number): void {
    if (this.byId.has(sheet.id)) {
      throw new Error(`Sheet id ${sheet.id} is already in this workbook.`);
    }

    const at = index === undefined ? this.sheets.length : clamp(index, 0, this.sheets.length);
    this.sheets.splice(at, 0, sheet);
    this.byId.set(sheet.id, sheet);

    if (this.activeSheetId === '') this.activeSheetId = sheet.id;
  }

  /**
   * Removes a sheet, refusing to remove the last one.
   *
   * Excel refuses too: a workbook with no sheets has nowhere to put a cell, and
   * every consumer would need a "what if there are no sheets" branch.
   */
  removeSheet(id: string): Worksheet | undefined {
    if (this.sheets.length <= 1) return undefined;

    const index = this.sheets.findIndex((sheet) => sheet.id === id);
    if (index === -1) return undefined;

    const [removed] = this.sheets.splice(index, 1);
    this.byId.delete(id);

    if (this.activeSheetId === id) {
      // Excel selects the sheet that took its place, or the one before it if
      // the removed sheet was last.
      const next = this.sheets[Math.min(index, this.sheets.length - 1)];
      this.activeSheetId = next?.id ?? '';
    }

    return removed;
  }

  moveSheet(id: string, toIndex: number): boolean {
    const from = this.sheets.findIndex((sheet) => sheet.id === id);
    if (from === -1) return false;

    const [sheet] = this.sheets.splice(from, 1);
    if (!sheet) return false;

    this.sheets.splice(clamp(toIndex, 0, this.sheets.length), 0, sheet);
    return true;
  }

  /**
   * Whether a name may be used for a sheet.
   *
   * Excel's rules: 1-31 characters, none of `: \ / ? * [ ]`, and unique
   * case-insensitively. Enforced here rather than in the tab UI so a workbook
   * being parsed is held to the same rule as one being edited.
   */
  canNameSheet(name: string, exceptId?: string): boolean {
    const trimmed = name.trim();
    if (trimmed.length === 0 || trimmed.length > 31) return false;
    if (/[:\\/?*[\]]/.test(trimmed)) return false;

    const existing = this.sheetByName(trimmed);
    return !existing || existing.id === exceptId;
  }

  /**
   * A name no existing sheet is using: `Sheet2`, `Sheet3`, ...
   *
   * Counts upward from the sheet count rather than from a module counter, so
   * two workbooks open at once cannot influence each other's naming.
   */
  suggestSheetName(): string {
    for (let n = this.sheets.length + 1; ; n += 1) {
      const candidate = `Sheet${n}`;
      if (!this.sheetByName(candidate)) return candidate;
    }
  }

  /** An id no existing sheet is using. Ids are stable; names are not. */
  nextSheetId(): string {
    let n = this.sheets.length + 1;
    while (this.byId.has(`sheet${n}`)) n += 1;
    return `sheet${n}`;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
