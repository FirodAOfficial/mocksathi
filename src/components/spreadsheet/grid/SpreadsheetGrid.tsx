'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  columnToLabel,
  formatAddress,
  type CellAddress,
  type RangeAddress,
} from '@/spreadsheet/model/address';
import { alignmentOf, formatCellValue } from '@/spreadsheet/model/format';
import {
  DEFAULT_FONT_FAMILY,
  DEFAULT_FONT_SIZE_PT,
  type CellStyle,
} from '@/spreadsheet/model/styles';
import { GridGeometry } from '@/spreadsheet/grid/gridGeometry';
import { useSelection, useWorkbookStore, useWorkbookVersion } from '@/spreadsheet/useWorkbook';
import { useSpreadsheetUiStore } from '@/state/spreadsheetUiStore';
import { CellEditor } from './CellEditor';
import styles from './SpreadsheetGrid.module.css';

/**
 * The sheet surface.
 *
 * The rule the whole file serves: **what is on screen is what is in the DOM,
 * and nothing else.** A sheet is a million rows; rendering even one element per
 * row would be a million elements before a single cell of content.
 *
 * Three things follow from that, and each is why a piece of this looks the way
 * it does:
 *
 * - **Only occupied cells become elements.** Blank cells are not empty divs,
 *   they are nothing. The gridlines behind them are drawn separately, one
 *   element per visible line — about fifty for a full screen — rather than one
 *   per cell intersection.
 * - **Headers are translated, not scrolled.** `position: sticky` inside the
 *   scroller would work, but it re-lays-out the sticky element on every scroll
 *   event; a transform is composited.
 * - **Selection is not React state.** Dragging a marquee fires a pointermove
 *   per frame. `SelectionModel` notifies the overlay directly, and the cells do
 *   not subscribe to it at all.
 */

/**
 * The id of the scrollable cell surface.
 *
 * Exported because the formula bar and the Name Box hand focus back to the
 * grid when they are done — pressing Enter in the Name Box must leave the
 * cursor typing into cells, not into the box, which is what Excel does.
 */
export const GRID_ELEMENT_ID = 'sheet-grid';

/** Returns focus to the cell surface, if it is mounted. */
export function focusSheetGrid(): void {
  document.getElementById(GRID_ELEMENT_ID)?.focus();
}

/** Row header width and column header height, in CSS pixels, as Excel's. */
const ROW_HEADER_WIDTH = 46;
const COLUMN_HEADER_HEIGHT = 20;

/** How close to a header boundary counts as grabbing the resize handle. */
const RESIZE_GRIP = 4;

interface Size {
  width: number;
  height: number;
}

type Editing = { row: number; col: number; initial: string; selectAll: boolean } | null;

/** A fill-handle drag in progress: where it began and where it is now. */
type Filling = { source: RangeAddress; to: CellAddress } | null;

type Resizing =
  | { kind: 'column'; index: number; startPosition: number; startSize: number }
  | { kind: 'row'; index: number; startPosition: number; startSize: number }
  | null;

export function SpreadsheetGrid() {
  const store = useWorkbookStore();
  const version = useWorkbookVersion();
  const selection = useSelection();

  const zoom = useSpreadsheetUiStore((state) => state.zoom);
  const showFormulas = useSpreadsheetUiStore((state) => state.showFormulas);
  const readOnly = useSpreadsheetUiStore((state) => state.readOnly);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const [scroll, setScroll] = useState({ left: 0, top: 0 });
  const [viewport, setViewport] = useState<Size>({ width: 0, height: 0 });
  const [editing, setEditing] = useState<Editing>(null);
  const resizing = useRef<Resizing>(null);
  const [filling, setFilling] = useState<Filling>(null);

  const sheet = store.activeSheet();

  // Gridlines and headings belong to the sheet, not to the app: Excel stores
  // them per sheet, and a question can ask a candidate to turn them on.
  const showGridlines = sheet.view.showGridlines;
  const showHeadings = sheet.view.showHeadings;

  // Rebuilt when the workbook changes, because a resized row moves everything
  // below it. `version` is the dependency that says "something changed".
  const geometry = useMemo(
    () => new GridGeometry(sheet, store.reach),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- version is the change signal for the sheet's mutable contents.
    [sheet, store.reach, version],
  );

  /* -- Viewport measurement ---------------------------------------------- */

  useLayoutEffect(() => {
    const element = scrollerRef.current;
    if (!element) return;

    const measure = () =>
      setViewport({ width: element.clientWidth, height: element.clientHeight });

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  /* -- Visible window ----------------------------------------------------- */

  const window_ = useMemo(
    () =>
      geometry.visibleWindow(
        scroll.left / zoom,
        scroll.top / zoom,
        viewport.width / zoom,
        viewport.height / zoom,
      ),
    [geometry, scroll.left, scroll.top, viewport.width, viewport.height, zoom],
  );

  /* -- Keeping the cursor in view ----------------------------------------- */

  const active = selection.active;

  useEffect(() => {
    const element = scrollerRef.current;
    if (!element || viewport.width === 0) return;

    const target = geometry.scrollToShow(
      active,
      element.scrollLeft / zoom,
      element.scrollTop / zoom,
      viewport.width / zoom,
      viewport.height / zoom,
    );
    if (!target) return;

    element.scrollTo({ left: target.left * zoom, top: target.top * zoom });
  }, [active, geometry, viewport.width, viewport.height, zoom]);

  /* -- Pointer ------------------------------------------------------------ */

  /** Sheet coordinates from a pointer event, undoing scroll and zoom. */
  const pointToCell = useCallback(
    (clientX: number, clientY: number): CellAddress | null => {
      const element = scrollerRef.current;
      if (!element) return null;

      const box = element.getBoundingClientRect();
      const x = (clientX - box.left + element.scrollLeft) / zoom;
      const y = (clientY - box.top + element.scrollTop) / zoom;
      if (x < 0 || y < 0) return null;

      return geometry.cellAt(x, y);
    },
    [geometry, zoom],
  );

  const onCellPointerDown = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const address = pointToCell(event.clientX, event.clientY);
    if (!address) return;

    // A fill drag is in progress; the cell layer must not steal it.
    if (filling) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    setEditing(null);

    if (event.shiftKey) store.selection.extendTo(address);
    else if (event.ctrlKey || event.metaKey) store.selection.addRange(address);
    else store.selection.selectCell(address);

    store.extendReach(address);
  };

  const onCellPointerMove = (event: ReactPointerEvent<HTMLDivElement>): void => {
    // Buttons, not a separate isDragging flag: the browser already tracks
    // whether the button is down, and a flag can desynchronise if the pointer
    // is released outside the window.
    if (event.buttons !== 1) return;

    const address = pointToCell(event.clientX, event.clientY);
    if (!address) return;

    if (filling) {
      setFilling({ ...filling, to: address });
      return;
    }

    store.selection.extendTo(address);
  };

  /**
   * Finishes an Auto Fill.
   *
   * The preview rectangle is squared off to one axis first: Excel fills either
   * down or across, never both at once, and the longer of the two drags is the
   * one the user meant.
   */
  const endFill = (event?: ReactPointerEvent<HTMLDivElement>): void => {
    if (!filling) return;

    // The release point, not the last move: a drag that produces no pointermove
    // — a fast flick, or a synthetic one — would otherwise fill nothing.
    const released = event ? pointToCell(event.clientX, event.clientY) : null;
    const source = filling.source;
    const to = released ?? filling.to;
    setFilling(null);

    const down = Math.abs(to.row - source.end.row) >= Math.abs(to.col - source.end.col);
    const target: RangeAddress = down
      ? { start: source.start, end: { row: Math.max(to.row, source.end.row), col: source.end.col } }
      : { start: source.start, end: { row: source.end.row, col: Math.max(to.col, source.end.col) } };

    if (store.fillFrom(source, target)) store.selection.selectRange(target);
  };

  const onCellDoubleClick = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (readOnly) return;

    const address = pointToCell(event.clientX, event.clientY);
    if (!address) return;

    setEditing({
      row: address.row,
      col: address.col,
      initial: store.editText(address.row, address.col),
      selectAll: false,
    });
  };

  /* -- Header resizing ---------------------------------------------------- */

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const onMove = (event: PointerEvent): void => {
      const current = resizing.current;
      if (!current) return;

      if (readOnly) return;

      const delta =
        (current.kind === 'column' ? event.clientX : event.clientY) - current.startPosition;
      const size = Math.max(0, current.startSize + delta / zoom);

      if (current.kind === 'column') store.setColumnWidth(current.index, size);
      else store.setRowHeight(current.index, size);
    };

    const onUp = (): void => {
      resizing.current = null;
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    };
  }, [store, zoom, readOnly]);

  /* -- Keyboard ----------------------------------------------------------- */

  const beginTyping = (initial: string): void => {
    setEditing({ row: active.row, col: active.col, initial, selectAll: false });
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
    if (editing) return;

    const extend = event.shiftKey;

    switch (event.key) {
      case 'ArrowUp':
        store.selection.moveBy(-1, 0, extend);
        break;
      case 'ArrowDown':
        store.selection.moveBy(1, 0, extend);
        break;
      case 'ArrowLeft':
        store.selection.moveBy(0, -1, extend);
        break;
      case 'ArrowRight':
        store.selection.moveBy(0, 1, extend);
        break;
      case 'Tab':
        store.selection.moveBy(0, event.shiftKey ? -1 : 1);
        break;
      case 'Enter':
        store.selection.moveBy(event.shiftKey ? -1 : 1, 0);
        break;
      case 'Home':
        store.selection.selectCell({ row: active.row, col: 0 });
        break;
      case 'PageDown':
        store.selection.moveBy(Math.floor(viewport.height / zoom / 20), 0, extend);
        break;
      case 'PageUp':
        store.selection.moveBy(-Math.floor(viewport.height / zoom / 20), 0, extend);
        break;
      case 'F2':
        if (readOnly) break;
        setEditing({
          row: active.row,
          col: active.col,
          initial: store.editText(active.row, active.col),
          selectAll: false,
        });
        break;
      case 'Delete':
      case 'Backspace':
        if (!readOnly) store.clearContents();
        break;
      case 'Escape':
        return;
      default: {
        // Typing over a cell replaces it, as Excel does. Modifier chords are
        // left alone so Ctrl+C and friends still reach the browser.
        if (event.ctrlKey || event.metaKey || event.altKey) return;
        if (event.key.length !== 1) return;
        // Protected: the selection still moves, but nothing can be typed in.
        if (readOnly) return;

        beginTyping(event.key);
        break;
      }
    }

    event.preventDefault();
    if (event.key !== 'F2') store.extendReach(store.selection.getActive());
  };

  /* -- Committing an edit -------------------------------------------------- */

  const commitEdit = (text: string, move: 'down' | 'right' | 'none'): void => {
    if (!editing) return;

    store.setCellInput(editing.row, editing.col, text);
    setEditing(null);

    if (move === 'down') store.selection.moveBy(1, 0);
    else if (move === 'right') store.selection.moveBy(0, 1);

    scrollerRef.current?.focus();
  };

  /* -- Render -------------------------------------------------------------- */

  const rows: number[] = [];
  for (let row = window_.firstRow; row <= window_.lastRow; row += 1) rows.push(row);

  const columns: number[] = [];
  for (let col = window_.firstColumn; col <= window_.lastColumn; col += 1) columns.push(col);

  /** The rectangle the fill handle hangs off: the primary selection. */
  const fillSource = selection.ranges[0] ?? null;

  const contentStyle: CSSProperties = {
    width: geometry.totalWidth() * zoom,
    height: geometry.totalHeight() * zoom,
  };

  const layerStyle: CSSProperties = {
    transform: `scale(${zoom})`,
    transformOrigin: '0 0',
  };

  const headerOffset: CSSProperties = {
    transform: `translateX(${-scroll.left}px)`,
  };
  const rowHeaderOffset: CSSProperties = {
    transform: `translateY(${-scroll.top}px)`,
  };

  return (
    <div className={styles.frame} data-headings={showHeadings ? 'on' : 'off'}>
      {showHeadings ? (
        <>
          <div className={styles.corner} aria-hidden="true" />

          <div className={styles.columnHeaders}>
            <div style={headerOffset}>
              <div style={layerStyle} className={styles.headerLayer}>
                {columns.map((col) => (
                  <div
                    key={col}
                    className={`${styles.columnHeader} ${
                      isColumnSelected(selection.ranges, col) ? styles.headerSelected : ''
                    }`}
                    style={{
                      left: geometry.offsetOfColumn(col),
                      width: geometry.columnWidth(col),
                      height: COLUMN_HEADER_HEIGHT,
                    }}
                    onPointerDown={(event) => {
                      const box = event.currentTarget.getBoundingClientRect();
                      if (box.right - event.clientX <= RESIZE_GRIP) {
                        resizing.current = {
                          kind: 'column',
                          index: col,
                          startPosition: event.clientX,
                          startSize: geometry.columnWidth(col),
                        };
                        return;
                      }
                      store.selection.selectColumn(col);
                    }}
                  >
                    {columnToLabel(col)}
                    <span className={styles.columnGrip} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className={styles.rowHeaders}>
            <div style={rowHeaderOffset}>
              <div style={layerStyle} className={styles.headerLayer}>
                {rows.map((row) => (
                  <div
                    key={row}
                    className={`${styles.rowHeader} ${
                      isRowSelected(selection.ranges, row) ? styles.headerSelected : ''
                    }`}
                    style={{
                      top: geometry.offsetOfRow(row),
                      height: geometry.rowHeight(row),
                      width: ROW_HEADER_WIDTH,
                    }}
                    onPointerDown={(event) => {
                      const box = event.currentTarget.getBoundingClientRect();
                      if (box.bottom - event.clientY <= RESIZE_GRIP) {
                        resizing.current = {
                          kind: 'row',
                          index: row,
                          startPosition: event.clientY,
                          startSize: geometry.rowHeight(row),
                        };
                        return;
                      }
                      store.selection.selectRow(row);
                    }}
                  >
                    {row + 1}
                    <span className={styles.rowGrip} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      ) : null}

      <div
        className={styles.scroller}
        ref={scrollerRef}
        id={GRID_ELEMENT_ID}
        tabIndex={0}
        role="grid"
        aria-label={`${sheet.name} cells`}
        aria-rowcount={geometry.scrollRows}
        aria-colcount={geometry.scrollColumns}
        aria-activedescendant={`cell-${active.row}-${active.col}`}
        onScroll={(event) =>
          setScroll({
            left: event.currentTarget.scrollLeft,
            top: event.currentTarget.scrollTop,
          })
        }
        onKeyDown={onKeyDown}
        onPointerDown={onCellPointerDown}
        onPointerMove={onCellPointerMove}
        onDoubleClick={onCellDoubleClick}
        onPointerUp={(event) => endFill(event)}
      >
        <div className={styles.content} style={contentStyle}>
          <div className={styles.layer} style={layerStyle}>
            {showGridlines ? (
              <div className={styles.gridlines} aria-hidden="true">
                {rows.map((row) => (
                  <div
                    key={`h${row}`}
                    className={styles.hLine}
                    style={{
                      top: geometry.offsetOfRow(row) + geometry.rowHeight(row) - 1,
                      width: geometry.offsetOfColumn(window_.lastColumn + 1),
                    }}
                  />
                ))}
                {columns.map((col) => (
                  <div
                    key={`v${col}`}
                    className={styles.vLine}
                    style={{
                      left: geometry.offsetOfColumn(col) + geometry.columnWidth(col) - 1,
                      height: geometry.offsetOfRow(window_.lastRow + 1),
                    }}
                  />
                ))}
              </div>
            ) : null}

            {/*
              The print area's boundary. Excel draws a dashed outline around it,
              and drawing it here is what keeps Set Print Area from being a
              control that stores a value nobody can see.
            */}
            {sheet.printArea ? (
              <div
                className={styles.printArea}
                aria-hidden="true"
                style={geometry.rectOf(sheet.printArea)}
              />
            ) : null}

            <SelectionOverlay geometry={geometry} />

            {/* Only occupied cells exist as elements. A blank cell is nothing. */}
            {rows.map((row) =>
              [...sheet.cellsInRow(row, window_.firstColumn, window_.lastColumn)].map(
                ([col, cell]) => {
                  if (sheet.isCovered(row, col)) return null;

                  const merge = sheet.mergeCovering(row, col);
                  const style = store.workbook.styles.get(cell.styleId);
                  const width = merge
                    ? geometry.offsetOfColumn(merge.end.col + 1) - geometry.offsetOfColumn(col)
                    : geometry.columnWidth(col);
                  const height = merge
                    ? geometry.offsetOfRow(merge.end.row + 1) - geometry.offsetOfRow(row)
                    : geometry.rowHeight(row);

                  const text = showFormulas
                    ? (cell.formula ?? formatCellValue(cell.value, style.numberFormat))
                    : formatCellValue(cell.value, style.numberFormat);

                  return (
                    <div
                      key={`${row}:${col}`}
                      id={`cell-${row}-${col}`}
                      role="gridcell"
                      aria-rowindex={row + 1}
                      aria-colindex={col + 1}
                      className={styles.cell}
                      style={{
                        left: geometry.offsetOfColumn(col),
                        top: geometry.offsetOfRow(row),
                        width,
                        height,
                        textAlign: alignmentOf(cell, style),
                        ...cellCss(style),
                      }}
                    >
                      <span className={styles.cellText}>{text}</span>
                    </div>
                  );
                },
              ),
            )}

            {/*
              The fill handle: the small square at the bottom-right corner of the
              selection. Rendered here rather than in the overlay because it is a
              control, not decoration — the overlay is `pointer-events: none`.
            */}
            {!readOnly && !editing && fillSource ? (
              <div
                className={styles.fillHandle}
                role="button"
                aria-label="Fill handle"
                tabIndex={-1}
                style={{
                  left: geometry.offsetOfColumn(fillSource.end.col + 1) - 3,
                  top: geometry.offsetOfRow(fillSource.end.row + 1) - 3,
                }}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  event.currentTarget.setPointerCapture(event.pointerId);
                  setFilling({ source: fillSource, to: fillSource.end });
                }}
                onPointerMove={(event) => {
                  if (!filling) return;
                  const address = pointToCell(event.clientX, event.clientY);
                  if (address) setFilling({ ...filling, to: address });
                }}
                onPointerUp={(event) => endFill(event)}
              />
            ) : null}

            {filling ? (
              <div
                className={styles.fillPreview}
                aria-hidden="true"
                style={geometry.rectOf({
                  start: filling.source.start,
                  end: {
                    row: Math.max(filling.to.row, filling.source.end.row),
                    col: Math.max(filling.to.col, filling.source.end.col),
                  },
                })}
              />
            ) : null}

            {editing ? (
              <CellEditor
                initial={editing.initial}
                selectAll={editing.selectAll}
                left={geometry.offsetOfColumn(editing.col)}
                top={geometry.offsetOfRow(editing.row)}
                width={geometry.columnWidth(editing.col)}
                height={geometry.rowHeight(editing.row)}
                label={`Edit ${formatAddress({ row: editing.row, col: editing.col })}`}
                onCommit={commitEdit}
                onCancel={() => {
                  setEditing(null);
                  scrollerRef.current?.focus();
                }}
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * The selection rectangles and the cursor outline.
 *
 * A separate component so that a drag re-renders three absolutely positioned
 * divs and nothing else — the cells above do not subscribe to the selection.
 */
function SelectionOverlay({ geometry }: { geometry: GridGeometry }) {
  const selection = useSelection();
  const active = selection.active;

  return (
    <div className={styles.selectionLayer} aria-hidden="true">
      {selection.ranges.map((range, index) => {
        const rect = geometry.rectOf(range);
        return (
          <div
            key={index}
            className={styles.selectionRange}
            style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
          />
        );
      })}

      <div
        className={styles.cursor}
        style={{
          left: geometry.offsetOfColumn(active.col),
          top: geometry.offsetOfRow(active.row),
          width: geometry.columnWidth(active.col),
          height: geometry.rowHeight(active.row),
        }}
      />
    </div>
  );
}

function cellCss(style: CellStyle): CSSProperties {
  const css: CSSProperties = {
    fontFamily: style.fontFamily ?? DEFAULT_FONT_FAMILY,
    fontSize: `${style.fontSize ?? DEFAULT_FONT_SIZE_PT}pt`,
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
    // Excel shrinks raised and lowered text rather than moving it alone.
    css.fontSize = `${(style.fontSize ?? DEFAULT_FONT_SIZE_PT) * 0.7}pt`;
  }
  if (style.fontColor) css.color = style.fontColor;
  if (style.fillColor) css.backgroundColor = style.fillColor;
  if (style.wrapText) css.whiteSpace = 'normal';
  if (style.verticalAlignment) {
    css.alignItems =
      style.verticalAlignment === 'top'
        ? 'flex-start'
        : style.verticalAlignment === 'bottom'
          ? 'flex-end'
          : 'center';
  }
  if (style.indent) css.paddingLeft = 3 + style.indent * 9;

  if (style.borders) {
    const { top, right, bottom, left } = style.borders;
    if (top) css.borderTop = `${borderWidth(top.style)} ${borderKind(top.style)} ${top.color}`;
    if (right) css.borderRight = `${borderWidth(right.style)} ${borderKind(right.style)} ${right.color}`;
    if (bottom) css.borderBottom = `${borderWidth(bottom.style)} ${borderKind(bottom.style)} ${bottom.color}`;
    if (left) css.borderLeft = `${borderWidth(left.style)} ${borderKind(left.style)} ${left.color}`;
  }

  return css;
}

function borderWidth(style: string): string {
  if (style === 'thick') return '3px';
  if (style === 'medium') return '2px';
  return '1px';
}

function borderKind(style: string): string {
  if (style === 'dashed' || style === 'dotted' || style === 'double') return style;
  return 'solid';
}

function isColumnSelected(ranges: readonly { start: CellAddress; end: CellAddress }[], col: number): boolean {
  return ranges.some((range) => col >= range.start.col && col <= range.end.col);
}

function isRowSelected(ranges: readonly { start: CellAddress; end: CellAddress }[], row: number): boolean {
  return ranges.some((range) => row >= range.start.row && row <= range.end.row);
}
