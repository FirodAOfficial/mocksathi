/**
 * Types for `fast-formula-parser`, which ships none.
 *
 * Deliberately narrow: this declares only the surface
 * `src/spreadsheet/calc/FastFormulaEngine.ts` actually uses, so the shape of
 * our dependency on an unmaintained package is visible in one file. Anything
 * not declared here is something we do not rely on, and adding to this file is
 * the moment to ask whether the engine wrapper should absorb it instead.
 *
 * Verified against 1.0.19 by inspecting the module at runtime: the export is
 * the `FormulaParser` class itself with the rest hung off it as statics, so
 * this is an `export =` with a merged namespace rather than a set of named
 * exports.
 *
 * Row and column numbers here are ONE-BASED — the library's own convention,
 * and the opposite of the engine's. `FastFormulaEngine` is the only place that
 * conversion happens.
 *
 * The library also exports `MAX_ROW`, `MAX_COLUMN`, `SSF` and others. They are
 * left undeclared on purpose: the grid limits live in `model/address.ts`, and
 * two sources of truth for how big a sheet is would be one too many.
 */
declare module 'fast-formula-parser' {
  /** One-based, as the library counts. */
  interface CellRef {
    row: number;
    col: number;
    sheet?: string;
  }

  interface RangeRef {
    from: { row: number; col: number };
    to: { row: number; col: number };
    sheet?: string;
  }

  /** What a formula can evaluate to. `FormulaError` covers Excel's seven. */
  type FormulaValue = string | number | boolean | null | FormulaError | FormulaValue[][];

  class FormulaError extends Error {
    constructor(error: string, message?: string);
    /** The error text, e.g. `#DIV/0!`. */
    readonly error: string;
    toString(): string;
  }

  interface ParserConfig {
    /** Return the value at a cell, or null when it is blank. */
    onCell?: (ref: CellRef) => FormulaValue;
    /** Return the range as rows of values. */
    onRange?: (ref: RangeRef) => FormulaValue[][];
    /** Resolve a defined name to a reference or a value. */
    onVariable?: (name: string, sheet?: string) => CellRef | RangeRef | FormulaValue | null;
    functions?: Record<string, (...args: never[]) => FormulaValue>;
    functionsNeedContext?: Record<string, (...args: never[]) => FormulaValue>;
  }

  /**
   * Extracts the references a formula reads, without evaluating it.
   *
   * This is what the dependency graph is built from — the reason this library
   * was chosen over writing a reference tokenizer by hand.
   */
  class DepParser {
    constructor(config?: Pick<ParserConfig, 'onVariable'>);
    parse(formula: string, position: CellRef): Array<CellRef | RangeRef>;
  }

  class FormulaParser {
    constructor(config?: ParserConfig);
    /** `formula` is the source WITHOUT its leading `=`. */
    parse(formula: string, position: CellRef, allowReturnArray?: boolean): FormulaValue;
    parseAsync(formula: string, position: CellRef, allowReturnArray?: boolean): Promise<FormulaValue>;
    supportedFunctions(): string[];
  }

  namespace FormulaParser {
    export { DepParser, FormulaError };
    export type { CellRef, RangeRef, FormulaValue, ParserConfig };
  }

  export = FormulaParser;
}
