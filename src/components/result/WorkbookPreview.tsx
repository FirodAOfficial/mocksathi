import type { CSSProperties } from 'react';
import { columnToLabel } from '@/spreadsheet/model/address';
import { alignmentOf, formatCellValue } from '@/spreadsheet/model/format';
import type { CellSnapshot, WorkbookSnapshot } from '@/spreadsheet/model/snapshot';
import {
  DEFAULT_FONT_FAMILY,
  DEFAULT_FONT_SIZE_PT,
  type CellStyle,
} from '@/spreadsheet/model/styles';
import styles from './WorkbookPreview.module.css';

/**
 * A workbook, shown read-only on the review screen.
 *
 * The counterpart of `PassagePreview`, and it exists for the same reason: the
 * candidate has to see their answer *as formatted*, not described. A table of
 * plain values would hide the very thing most of these questions are about.
 *
 * Deliberately not `SpreadsheetGrid`. That component virtualizes, scrolls,
 * takes keyboard input and owns a selection — none of which belongs on a review
 * screen, and all of which would make two of them on one page fight over focus.
 * This renders the used range as a static table and nothing else.
 */

/** Beyond this the preview would dominate the screen rather than illustrate it. */
const MAX_PREVIEW_ROWS = 14;
const MAX_PREVIEW_COLUMNS = 8;

export interface WorkbookPreviewProps {
  workbook: WorkbookSnapshot;
  className?: string;
}

export function WorkbookPreview({ workbook, className }: WorkbookPreviewProps) {
  const sheet = workbook.sheets[0];
  const cells = sheet?.cells ?? [];

  if (cells.length === 0) {
    return (
      <p className={styles.empty} role="note">
        This sheet is empty.
      </p>
    );
  }

  const lastRow = Math.min(Math.max(...cells.map((cell) => cell.row)), MAX_PREVIEW_ROWS - 1);
  const lastColumn = Math.min(Math.max(...cells.map((cell) => cell.col)), MAX_PREVIEW_COLUMNS - 1);

  const byAddress = new Map(cells.map((cell) => [`${cell.row},${cell.col}`, cell]));

  // A merge is drawn by spanning its anchor and skipping the cells it covers,
  // which is the only way a table can show what the grid shows.
  const covered = new Set<string>();
  const spans = new Map<string, { rowSpan: number; colSpan: number }>();

  for (const merge of sheet?.merges ?? []) {
    spans.set(`${merge.start.row},${merge.start.col}`, {
      rowSpan: merge.end.row - merge.start.row + 1,
      colSpan: merge.end.col - merge.start.col + 1,
    });

    for (let row = merge.start.row; row <= merge.end.row; row += 1) {
      for (let col = merge.start.col; col <= merge.end.col; col += 1) {
        if (row !== merge.start.row || col !== merge.start.col) covered.add(`${row},${col}`);
      }
    }
  }

  const rows = Array.from({ length: lastRow + 1 }, (_, row) => row);
  const columns = Array.from({ length: lastColumn + 1 }, (_, col) => col);

  return (
    <div className={[styles.frame, className ?? ''].filter(Boolean).join(' ')}>
      <table className={styles.sheet}>
        <thead>
          <tr>
            <th className={styles.corner} aria-hidden="true" />
            {columns.map((col) => (
              <th key={col} scope="col" className={styles.columnHead}>
                {columnToLabel(col)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row}>
              <th scope="row" className={styles.rowHead}>
                {row + 1}
              </th>
              {columns.map((col) => {
                const key = `${row},${col}`;
                if (covered.has(key)) return null;

                const cell = byAddress.get(key);
                const span = spans.get(key);

                return (
                  <td
                    key={col}
                    className={styles.cell}
                    rowSpan={span?.rowSpan}
                    colSpan={span?.colSpan}
                    style={cellCss(cell)}
                  >
                    {formatCellValue(cell?.value ?? null, cell?.style?.numberFormat)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function cellCss(cell: CellSnapshot | undefined): CSSProperties {
  const style: CellStyle = cell?.style ?? {};

  const css: CSSProperties = {
    fontFamily: style.fontFamily ?? DEFAULT_FONT_FAMILY,
    fontSize: `${style.fontSize ?? DEFAULT_FONT_SIZE_PT}pt`,
    textAlign: alignmentOf(cell ? { value: cell.value, styleId: 0 } : undefined, style),
  };

  if (style.bold) css.fontWeight = 700;
  if (style.italic) css.fontStyle = 'italic';
  if (style.underline || style.strikethrough) {
    css.textDecoration = [style.underline ? 'underline' : '', style.strikethrough ? 'line-through' : '']
      .filter(Boolean)
      .join(' ');
  }
  if (style.textEffect) {
    css.verticalAlign = style.textEffect === 'subscript' ? 'sub' : 'super';
    css.fontSize = `${(style.fontSize ?? DEFAULT_FONT_SIZE_PT) * 0.7}pt`;
  }
  if (style.fontColor) css.color = style.fontColor;
  if (style.fillColor) css.backgroundColor = style.fillColor;
  if (style.wrapText) css.whiteSpace = 'normal';
  if (style.indent) css.paddingLeft = 4 + style.indent * 9;

  if (style.borders) {
    const { top, right, bottom, left } = style.borders;
    if (top) css.borderTop = `${borderWidth(top.style)} solid ${top.color}`;
    if (right) css.borderRight = `${borderWidth(right.style)} solid ${right.color}`;
    if (bottom) css.borderBottom = `${borderWidth(bottom.style)} solid ${bottom.color}`;
    if (left) css.borderLeft = `${borderWidth(left.style)} solid ${left.color}`;
  }

  return css;
}

function borderWidth(style: string): string {
  if (style === 'thick') return '3px';
  if (style === 'medium') return '2px';
  return '1px';
}
