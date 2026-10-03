import type { RangeAddress } from './address';
import type { CellValue } from './Cell';

/**
 * Excel's AutoFilter: drop-down buttons on a table's header row, and a
 * condition per column that hides the rows failing it.
 *
 * A filtered-out row is a **hidden row**, exactly as Excel writes it to a
 * workbook file. That is what makes a filter markable without a marker of its
 * own: the rows a filter hides are the rows a candidate who applied the same
 * filter has hidden, whichever way they got there. The filter itself — range
 * and conditions — is kept alongside so the buttons, the funnel icons and
 * Clear/Reapply have something to work from.
 */

export type TextFilterOp = 'equals' | 'notEquals' | 'beginsWith' | 'endsWith' | 'contains' | 'notContains';

export type NumberFilterOp =
  | 'equals'
  | 'notEquals'
  | 'greater'
  | 'greaterOrEqual'
  | 'less'
  | 'lessOrEqual'
  | 'between';

export type FilterCondition =
  /** The checklist: the displayed values left ticked. `''` stands for (Blanks). */
  | { kind: 'values'; values: string[] }
  | { kind: 'text'; op: TextFilterOp; value: string }
  | { kind: 'number'; op: NumberFilterOp; value: number; value2?: number }
  /** Top 10…: the largest (or smallest) `count` numbers in the column. */
  | { kind: 'top'; count: number; bottom: boolean }
  | { kind: 'average'; above: boolean };

export interface AutoFilter {
  /** Header row first; the rows below it are the ones filtered. */
  range: RangeAddress;
  /** Conditions keyed by absolute column index. A column without one shows everything. */
  columns: Record<number, FilterCondition>;
}

/** One cell as a filter sees it: what is displayed, and the value behind it. */
export interface FilterCell {
  text: string;
  value: CellValue;
}

export type ReadCell = (row: number, col: number) => FilterCell;

/** Most values a checklist condition may name; a column of an exam table has a few dozen. */
export const MAX_FILTER_VALUES = 1000;

/** The rows a filter applies to: everything under the header. */
export function bodyRows(filter: AutoFilter): number[] {
  const rows: number[] = [];
  for (let row = filter.range.start.row + 1; row <= filter.range.end.row; row += 1) rows.push(row);
  return rows;
}

/** Column statistics a Top 10 or Average condition needs, computed once per column. */
interface ColumnStats {
  numbers: number[];
  average: number;
}

function statsOf(filter: AutoFilter, col: number, read: ReadCell): ColumnStats {
  const numbers = bodyRows(filter)
    .map((row) => read(row, col).value)
    .filter((value): value is number => typeof value === 'number');
  const average = numbers.length === 0 ? 0 : numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
  return { numbers, average };
}

/** Whether one cell passes one condition. */
export function passes(condition: FilterCondition, cell: FilterCell, stats?: ColumnStats): boolean {
  switch (condition.kind) {
    case 'values':
      return condition.values.includes(cell.text);

    case 'text': {
      // Excel's text filters ignore case.
      const text = cell.text.toLowerCase();
      const value = condition.value.toLowerCase();
      switch (condition.op) {
        case 'equals':
          return text === value;
        case 'notEquals':
          return text !== value;
        case 'beginsWith':
          return text.startsWith(value);
        case 'endsWith':
          return text.endsWith(value);
        case 'contains':
          return text.includes(value);
        case 'notContains':
          return !text.includes(value);
      }
      return true;
    }

    case 'number': {
      const value = cell.value;
      // A cell that is not a number fails every comparison but "does not equal".
      if (typeof value !== 'number') return condition.op === 'notEquals';
      switch (condition.op) {
        case 'equals':
          return value === condition.value;
        case 'notEquals':
          return value !== condition.value;
        case 'greater':
          return value > condition.value;
        case 'greaterOrEqual':
          return value >= condition.value;
        case 'less':
          return value < condition.value;
        case 'lessOrEqual':
          return value <= condition.value;
        case 'between': {
          const low = Math.min(condition.value, condition.value2 ?? condition.value);
          const high = Math.max(condition.value, condition.value2 ?? condition.value);
          return value >= low && value <= high;
        }
      }
      return true;
    }

    case 'top': {
      if (typeof cell.value !== 'number' || !stats) return false;
      const ordered = [...stats.numbers].sort((a, b) => (condition.bottom ? a - b : b - a));
      const cutoff = ordered[Math.min(condition.count, ordered.length) - 1];
      if (cutoff === undefined) return false;
      return condition.bottom ? cell.value <= cutoff : cell.value >= cutoff;
    }

    case 'average':
      if (typeof cell.value !== 'number' || !stats) return false;
      return condition.above ? cell.value > stats.average : cell.value < stats.average;
  }
}

/**
 * The body rows a filter hides: those failing any column's condition.
 *
 * `except` leaves one column's condition out, which is what a column's own
 * checklist is built from — Excel lists the values the *other* filters let
 * through, so a value hidden only by this column's filter can be ticked back.
 */
export function hiddenRows(filter: AutoFilter, read: ReadCell, except?: number): Set<number> {
  const hidden = new Set<number>();
  const conditions = Object.entries(filter.columns)
    .map(([col, condition]) => ({ col: Number(col), condition }))
    .filter(({ col }) => col !== except);

  const stats = new Map<number, ColumnStats>();
  for (const { col, condition } of conditions) {
    if (condition.kind === 'top' || condition.kind === 'average') stats.set(col, statsOf(filter, col, read));
  }

  for (const row of bodyRows(filter)) {
    for (const { col, condition } of conditions) {
      if (!passes(condition, read(row, col), stats.get(col))) {
        hidden.add(row);
        break;
      }
    }
  }
  return hidden;
}

/** The distinct displayed values in a column, for its checklist; blanks as `''`, listed last. */
export function columnValues(filter: AutoFilter, col: number, read: ReadCell): string[] {
  const hidden = hiddenRows(filter, read, col);
  const numbers = new Map<string, number>();
  const texts = new Set<string>();
  let blanks = false;

  for (const row of bodyRows(filter)) {
    if (hidden.has(row)) continue;
    const cell = read(row, col);
    if (cell.text === '') blanks = true;
    else if (typeof cell.value === 'number') numbers.set(cell.text, cell.value);
    else texts.add(cell.text);
  }

  // Numbers in numeric order, then text alphabetically: Excel's checklist order.
  const sortedNumbers = [...numbers.entries()].sort((a, b) => a[1] - b[1]).map(([text]) => text);
  const sortedTexts = [...texts].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  return [...sortedNumbers, ...sortedTexts, ...(blanks ? [''] : [])];
}

/** Whether a column holds mostly numbers, which decides Number Filters over Text Filters. */
export function isNumberColumn(filter: AutoFilter, col: number, read: ReadCell): boolean {
  let numbers = 0;
  let texts = 0;
  for (const row of bodyRows(filter)) {
    const value = read(row, col).value;
    if (typeof value === 'number') numbers += 1;
    else if (typeof value === 'string' && value !== '') texts += 1;
  }
  return numbers > texts;
}

/**
 * The table a filter goes on when one cell is selected: Excel's current region,
 * the block of filled cells around it, bounded by empty rows and columns.
 */
export function currentRegion(
  start: RangeAddress,
  filled: (row: number, col: number) => boolean,
  limit = 2000,
): RangeAddress {
  let { row: top, col: left } = start.start;
  let { row: bottom, col: right } = start.end;

  const rowHas = (row: number): boolean => {
    for (let col = Math.max(0, left - 1); col <= right + 1; col += 1) if (filled(row, col)) return true;
    return false;
  };
  const colHas = (col: number): boolean => {
    for (let row = Math.max(0, top - 1); row <= bottom + 1; row += 1) if (filled(row, col)) return true;
    return false;
  };

  for (let steps = 0; steps < limit; steps += 1) {
    let grew = false;
    if (top > 0 && rowHas(top - 1)) {
      top -= 1;
      grew = true;
    }
    if (rowHas(bottom + 1)) {
      bottom += 1;
      grew = true;
    }
    if (left > 0 && colHas(left - 1)) {
      left -= 1;
      grew = true;
    }
    if (colHas(right + 1)) {
      right += 1;
      grew = true;
    }
    if (!grew) break;
  }

  return { start: { row: top, col: left }, end: { row: bottom, col: right } };
}

/** A deep copy, so an operation's before and after never share a condition object. */
export function cloneFilter(filter: AutoFilter | null): AutoFilter | null {
  if (!filter) return null;
  return {
    range: { start: { ...filter.range.start }, end: { ...filter.range.end } },
    columns: Object.fromEntries(
      Object.entries(filter.columns).map(([col, condition]) => [
        col,
        condition.kind === 'values' ? { ...condition, values: [...condition.values] } : { ...condition },
      ]),
    ),
  };
}

/** Plain-language summary of a condition, for the funnel button's tooltip. */
export function describeCondition(condition: FilterCondition): string {
  switch (condition.kind) {
    case 'values':
      return `showing ${condition.values.length} value${condition.values.length === 1 ? '' : 's'}`;
    case 'text':
      return `${TEXT_OP_LABELS[condition.op].toLowerCase()} “${condition.value}”`;
    case 'number':
      return condition.op === 'between'
        ? `between ${condition.value} and ${condition.value2 ?? condition.value}`
        : `${NUMBER_OP_LABELS[condition.op].toLowerCase()} ${condition.value}`;
    case 'top':
      return `${condition.bottom ? 'bottom' : 'top'} ${condition.count}`;
    case 'average':
      return condition.above ? 'above average' : 'below average';
  }
}

export const TEXT_OP_LABELS: Record<TextFilterOp, string> = {
  equals: 'Equals',
  notEquals: 'Does Not Equal',
  beginsWith: 'Begins With',
  endsWith: 'Ends With',
  contains: 'Contains',
  notContains: 'Does Not Contain',
};

export const NUMBER_OP_LABELS: Record<NumberFilterOp, string> = {
  equals: 'Equals',
  notEquals: 'Does Not Equal',
  greater: 'Greater Than',
  greaterOrEqual: 'Greater Than Or Equal To',
  less: 'Less Than',
  lessOrEqual: 'Less Than Or Equal To',
  between: 'Between',
};

/** Shape-checks a filter from an untrusted snapshot. */
export function isAutoFilter(value: unknown, isRange: (range: unknown) => boolean): value is AutoFilter {
  if (!value || typeof value !== 'object') return false;
  const { range, columns } = value as AutoFilter;
  if (!isRange(range) || !columns || typeof columns !== 'object' || Array.isArray(columns)) return false;

  const entries = Object.entries(columns);
  if (entries.length > 500) return false;
  return entries.every(([col, condition]) => {
    if (!/^\d+$/.test(col) || !condition || typeof condition !== 'object') return false;
    switch (condition.kind) {
      case 'values':
        return (
          Array.isArray(condition.values) &&
          condition.values.length <= MAX_FILTER_VALUES &&
          condition.values.every((entry) => typeof entry === 'string' && entry.length <= 1000)
        );
      case 'text':
        return condition.op in TEXT_OP_LABELS && typeof condition.value === 'string' && condition.value.length <= 1000;
      case 'number':
        return (
          condition.op in NUMBER_OP_LABELS &&
          Number.isFinite(condition.value) &&
          (condition.value2 === undefined || Number.isFinite(condition.value2))
        );
      case 'top':
        return Number.isInteger(condition.count) && condition.count > 0 && condition.count <= 500 && typeof condition.bottom === 'boolean';
      case 'average':
        return typeof condition.above === 'boolean';
      default:
        return false;
    }
  });
}
