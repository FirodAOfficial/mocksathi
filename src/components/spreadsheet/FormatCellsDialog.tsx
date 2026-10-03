'use client';

import { useState, type CSSProperties, type ReactNode } from 'react';
import { THEME_PALETTE } from '@/components/controls/ColorPicker';
import { Dialog } from '@/components/dialogs/Dialog';
import type { TextAlignment } from '@/services/document/types';
import type { CellAddress, RangeAddress } from '@/spreadsheet/model/address';
import { formatCellValue, isDateTimeFormat, NUMBER_FORMATS, NUMERIC_CODE } from '@/spreadsheet/model/format';
import {
  DEFAULT_FONT_FAMILY,
  DEFAULT_FONT_SIZE_PT,
  type BorderEdge,
  type BorderStyle,
  type CellBorders,
  type CellStyle,
  type VerticalAlignment,
} from '@/spreadsheet/model/styles';
import type { WorkbookStore } from '@/spreadsheet/WorkbookStore';
import type { FormatCellsTab } from '@/state/spreadsheetUiStore';
import styles from './FormatCellsDialog.module.css';

/**
 * Excel's Format Cells dialog: Number, Alignment, Font, Border and Fill.
 *
 * Opened from the launcher arrow in the corner of the Home tab's Font,
 * Alignment and Number groups, each on its own tab, and with Ctrl+1.
 *
 * Only what the candidate actually changed is applied. Every field starts from
 * the active cell, and a range usually mixes formats — pressing OK after
 * changing only the colour must not also stamp the active cell's font, size
 * and alignment over every other cell in the selection.
 */

export interface FormatCellsDialogProps {
  store: WorkbookStore;
  initialTab: FormatCellsTab;
  onClose: () => void;
  /** Reports a merge the sheet refused. */
  onNotice: (message: string) => void;
}

const TABS: { id: FormatCellsTab; label: string }[] = [
  { id: 'number', label: 'Number' },
  { id: 'alignment', label: 'Alignment' },
  { id: 'font', label: 'Font' },
  { id: 'border', label: 'Border' },
  { id: 'fill', label: 'Fill' },
];

const FONT_FAMILIES = [
  'Calibri',
  'Arial',
  'Cambria',
  'Candara',
  'Comic Sans MS',
  'Consolas',
  'Courier New',
  'Georgia',
  'Segoe UI',
  'Tahoma',
  'Times New Roman',
  'Trebuchet MS',
  'Verdana',
];

const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72];

type FontStyleName = 'Regular' | 'Italic' | 'Bold' | 'Bold Italic';
const FONT_STYLES: FontStyleName[] = ['Regular', 'Italic', 'Bold', 'Bold Italic'];

const PALETTE = THEME_PALETTE.flat();

/* -- Number ------------------------------------------------------------- */

type Category = 'General' | 'Number' | 'Currency' | 'Percentage' | 'Date' | 'Time' | 'Text' | 'Custom';
const CATEGORIES: Category[] = ['General', 'Number', 'Currency', 'Percentage', 'Date', 'Time', 'Text', 'Custom'];

const CURRENCY_SYMBOLS = ['₹', '$', '€', '£'];

const DATE_TYPES = [
  { code: NUMBER_FORMATS.date, label: '14-03-2026' },
  { code: 'dd/mm/yyyy', label: '14/03/2026' },
  { code: 'mm/dd/yyyy', label: '03/14/2026' },
  { code: 'd-mmm-yy', label: '14-Mar-26' },
  { code: NUMBER_FORMATS.longDate, label: '14 March 2026' },
  { code: 'dddd, dd mmmm yyyy', label: 'Saturday, 14 March 2026' },
];

const TIME_TYPES = [
  { code: NUMBER_FORMATS.time, label: '13:30:55' },
  { code: 'hh:mm', label: '13:30' },
  { code: 'h:mm AM/PM', label: '1:30 PM' },
  { code: 'h:mm:ss AM/PM', label: '1:30:55 PM' },
];

interface NumberState {
  category: Category;
  decimals: number;
  separator: boolean;
  symbol: string;
  dateCode: string;
  timeCode: string;
  custom: string;
}

/** Reads a format code back into the Number tab's choices. */
function numberStateOf(format: string | undefined): NumberState {
  const code = format ?? NUMBER_FORMATS.general;
  const state: NumberState = {
    category: 'Custom',
    decimals: 2,
    separator: false,
    symbol: '₹',
    dateCode: NUMBER_FORMATS.date,
    timeCode: NUMBER_FORMATS.time,
    custom: code,
  };

  if (code === NUMBER_FORMATS.general) return { ...state, category: 'General' };
  if (code === NUMBER_FORMATS.text) return { ...state, category: 'Text' };

  const numeric = NUMERIC_CODE.exec(code);
  if (numeric) {
    const [, currency = '', base = '0', decimals = '', percent = ''] = numeric;
    const shared = { ...state, decimals: decimals.length, separator: base === '#,##0' };
    if (percent) return { ...shared, category: 'Percentage' };
    if (currency && base === '#,##0') return { ...shared, category: 'Currency', symbol: currency };
    if (!currency) return { ...shared, category: 'Number' };
    return state;
  }

  if (isDateTimeFormat(code)) {
    // A code with a day or a year in it is a date, whatever else it holds.
    if (/[dy]/i.test(code)) {
      return DATE_TYPES.some((type) => type.code === code) ? { ...state, category: 'Date', dateCode: code } : state;
    }
    return TIME_TYPES.some((type) => type.code === code) ? { ...state, category: 'Time', timeCode: code } : state;
  }

  return state;
}

function codeOf(state: NumberState): string {
  const fraction = state.decimals > 0 ? `.${'0'.repeat(state.decimals)}` : '';
  switch (state.category) {
    case 'General':
      return NUMBER_FORMATS.general;
    case 'Number':
      return `${state.separator ? '#,##0' : '0'}${fraction}`;
    case 'Currency':
      return `${state.symbol}#,##0${fraction}`;
    case 'Percentage':
      return `0${fraction}%`;
    case 'Date':
      return state.dateCode;
    case 'Time':
      return state.timeCode;
    case 'Text':
      return NUMBER_FORMATS.text;
    case 'Custom':
      return state.custom.trim() || NUMBER_FORMATS.general;
  }
}

const CATEGORY_HELP: Record<Category, string> = {
  General: 'General format cells have no specific number format.',
  Number: 'Number is used for general display of numbers.',
  Currency: 'Currency formats are used for general monetary values.',
  Percentage: 'Percentage formats multiply the cell value by 100 and display the result with a percent symbol.',
  Date: 'Date formats display date serial numbers as date values.',
  Time: 'Time formats display date serial numbers as time values.',
  Text: 'Text format cells are treated as text even when a number is in the cell.',
  Custom: 'Type the number format code, using one of the existing codes as a starting point.',
};

/* -- Border ------------------------------------------------------------- */

type Edge = 'top' | 'bottom' | 'left' | 'right' | 'insideH' | 'insideV';

const LINE_STYLES: { style: BorderStyle; label: string }[] = [
  { style: 'thin', label: 'Thin' },
  { style: 'medium', label: 'Medium' },
  { style: 'thick', label: 'Thick' },
  { style: 'dashed', label: 'Dashed' },
  { style: 'dotted', label: 'Dotted' },
  { style: 'double', label: 'Double' },
];

type EdgeState = Partial<Record<Edge, BorderEdge | null>>;

/**
 * The borders one cell ends up with: its own, with every edge the dialog
 * touched replaced. Outer edges of the selection take the outline's edges;
 * edges between two selected cells take the inside lines.
 */
export function borderedCell(
  existing: CellBorders | undefined,
  edges: EdgeState,
  cell: CellAddress,
  range: RangeAddress,
): CellBorders | undefined {
  const next: CellBorders = { ...existing };
  const sides: { side: keyof CellBorders; edge: Edge }[] = [
    { side: 'top', edge: cell.row === range.start.row ? 'top' : 'insideH' },
    { side: 'bottom', edge: cell.row === range.end.row ? 'bottom' : 'insideH' },
    { side: 'left', edge: cell.col === range.start.col ? 'left' : 'insideV' },
    { side: 'right', edge: cell.col === range.end.col ? 'right' : 'insideV' },
  ];

  for (const { side, edge } of sides) {
    if (!(edge in edges)) continue;
    const value = edges[edge];
    if (value) next[side] = value;
    else delete next[side];
  }

  return Object.keys(next).length > 0 ? next : undefined;
}

function sameEdge(a: BorderEdge | null | undefined, b: BorderEdge | null | undefined): boolean {
  if (!a || !b) return !a && !b;
  return a.style === b.style && a.color.toLowerCase() === b.color.toLowerCase();
}

function edgeCss(edge: BorderEdge | null | undefined): string {
  if (!edge) return '1px dotted #c8d2dc';
  const width = edge.style === 'thick' || edge.style === 'double' ? 3 : edge.style === 'medium' ? 2 : 1;
  const kind = edge.style === 'dashed' || edge.style === 'dotted' || edge.style === 'double' ? edge.style : 'solid';
  return `${width}px ${kind} ${edge.color}`;
}

/* -- The dialog ---------------------------------------------------------- */

export function FormatCellsDialog({ store, initialTab, onClose, onNotice }: FormatCellsDialogProps) {
  const active = store.selection.getActive();
  const range: RangeAddress = store.selection.getRanges()[0] ?? { start: active, end: active };
  const single = range.start.row === range.end.row && range.start.col === range.end.col;
  const sheet = store.activeSheet();
  const initial = store.styleAt(active.row, active.col);
  const cell = sheet.getCell(active.row, active.col);
  const wasMerged = sheet.mergeCovering(active.row, active.col) !== undefined;

  const [tab, setTab] = useState<FormatCellsTab>(initialTab);

  // Font
  const [family, setFamily] = useState(initial.fontFamily ?? DEFAULT_FONT_FAMILY);
  const [bold, setBold] = useState(Boolean(initial.bold));
  const [italic, setItalic] = useState(Boolean(initial.italic));
  const [size, setSize] = useState(String(initial.fontSize ?? DEFAULT_FONT_SIZE_PT));
  const [underline, setUnderline] = useState(Boolean(initial.underline));
  const [fontColor, setFontColor] = useState<string | null>(initial.fontColor ?? null);
  const [strike, setStrike] = useState(Boolean(initial.strikethrough));
  const [effect, setEffect] = useState<CellStyle['textEffect']>(initial.textEffect);

  // Alignment
  const [horizontal, setHorizontal] = useState<TextAlignment | 'general'>(initial.horizontalAlignment ?? 'general');
  const [vertical, setVertical] = useState<VerticalAlignment>(initial.verticalAlignment ?? 'bottom');
  const [indent, setIndent] = useState(initial.indent ?? 0);
  const [rotation, setRotation] = useState(initial.textRotation ?? 0);
  const [wrap, setWrap] = useState(Boolean(initial.wrapText));
  const [merge, setMerge] = useState(wasMerged);

  // Number
  const [number, setNumber] = useState<NumberState>(() => numberStateOf(initial.numberFormat));

  // Border
  const [lineStyle, setLineStyle] = useState<BorderStyle>('thin');
  const [lineColor, setLineColor] = useState('#000000');
  const [edges, setEdges] = useState<EdgeState>({});
  const initialEdges: EdgeState = single
    ? {
        top: initial.borders?.top ?? null,
        bottom: initial.borders?.bottom ?? null,
        left: initial.borders?.left ?? null,
        right: initial.borders?.right ?? null,
      }
    : {};
  const shownEdge = (edge: Edge): BorderEdge | null => (edge in edges ? (edges[edge] ?? null) : (initialEdges[edge] ?? null));

  // Fill
  const [fill, setFill] = useState<string | null>(initial.fillColor ?? null);

  const sizeValue = Number(size);
  const sizeValid = Number.isFinite(sizeValue) && sizeValue >= 1 && sizeValue <= 409;
  const customValid = number.category !== 'Custom' || number.custom.trim() !== '';

  const fontStyle: FontStyleName = bold && italic ? 'Bold Italic' : bold ? 'Bold' : italic ? 'Italic' : 'Regular';
  const setFontStyle = (name: FontStyleName): void => {
    setBold(name === 'Bold' || name === 'Bold Italic');
    setItalic(name === 'Italic' || name === 'Bold Italic');
  };

  const isNormalFont =
    family === DEFAULT_FONT_FAMILY &&
    sizeValue === DEFAULT_FONT_SIZE_PT &&
    !bold &&
    !italic &&
    !underline &&
    fontColor === null &&
    !strike &&
    effect === undefined;

  const resetFont = (): void => {
    setFamily(DEFAULT_FONT_FAMILY);
    setSize(String(DEFAULT_FONT_SIZE_PT));
    setBold(false);
    setItalic(false);
    setUnderline(false);
    setFontColor(null);
    setStrike(false);
    setEffect(undefined);
  };

  const toggleEdge = (edge: Edge): void => {
    const line: BorderEdge = { style: lineStyle, color: lineColor };
    setEdges({ ...edges, [edge]: sameEdge(shownEdge(edge), line) ? null : line });
  };

  const preset = (kind: 'none' | 'outline' | 'inside'): void => {
    const line: BorderEdge = { style: lineStyle, color: lineColor };
    if (kind === 'none') {
      setEdges({ top: null, bottom: null, left: null, right: null, insideH: null, insideV: null });
    } else if (kind === 'outline') {
      setEdges({ ...edges, top: line, bottom: line, left: line, right: line });
    } else {
      setEdges({
        ...edges,
        ...(range.start.row === range.end.row ? {} : { insideH: line }),
        ...(range.start.col === range.end.col ? {} : { insideV: line }),
      });
    }
  };

  /** What changed, as style changes. Untouched fields are left out. */
  const changes = (): Partial<CellStyle> => {
    const out: Partial<CellStyle> = {};
    const differs = <K extends keyof CellStyle>(key: K, value: CellStyle[K]): void => {
      if (value !== initial[key]) out[key] = value;
    };

    differs('fontFamily', family === DEFAULT_FONT_FAMILY && !initial.fontFamily ? undefined : family);
    differs('fontSize', sizeValue === DEFAULT_FONT_SIZE_PT && !initial.fontSize ? undefined : sizeValue);
    differs('bold', bold || undefined);
    differs('italic', italic || undefined);
    differs('underline', underline || undefined);
    differs('strikethrough', strike || undefined);
    differs('textEffect', effect);
    differs('fontColor', fontColor ?? undefined);

    differs('horizontalAlignment', horizontal === 'general' ? undefined : horizontal);
    if (vertical !== (initial.verticalAlignment ?? 'bottom')) out.verticalAlignment = vertical;
    differs('indent', indent > 0 ? indent : undefined);
    differs('textRotation', rotation !== 0 ? rotation : undefined);
    differs('wrapText', wrap || undefined);

    const code = codeOf(number);
    if (code !== (initial.numberFormat ?? NUMBER_FORMATS.general)) out.numberFormat = code;

    differs('fillColor', fill ?? undefined);
    return out;
  };

  const apply = (): void => {
    const common = changes();
    const bordersTouched = Object.keys(edges).length > 0;
    const mergeChange = merge === wasMerged ? undefined : merge;

    const merged = store.formatCells((address) => {
      if (!bordersTouched) return common;
      const existing = store.styleAt(address.row, address.col).borders;
      return { ...common, borders: borderedCell(existing, edges, address, range) };
    }, mergeChange);

    if (!merged) onNotice('Those cells could not be merged — the range overlaps an existing merge.');
    onClose();
  };

  const previewStyle: CSSProperties = {
    fontFamily: family,
    fontSize: `${Math.min(sizeValid ? sizeValue : DEFAULT_FONT_SIZE_PT, 28)}pt`,
    fontWeight: bold ? 700 : 400,
    fontStyle: italic ? 'italic' : 'normal',
    textDecoration: [underline ? 'underline' : '', strike ? 'line-through' : ''].filter(Boolean).join(' ') || 'none',
    color: fontColor ?? '#000000',
    verticalAlign: effect === 'superscript' ? 'super' : effect === 'subscript' ? 'sub' : undefined,
  };

  const sample = typeof cell?.value === 'number' ? formatCellValue(cell.value, codeOf(number)) : '';

  return (
    <Dialog
      title="Format Cells"
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className={`${styles.button} ${styles.primary}`}
            disabled={!sizeValid || !customValid}
            onClick={apply}
          >
            OK
          </button>
          <button type="button" className={styles.button} onClick={onClose}>
            Cancel
          </button>
        </>
      }
    >
      <div className={styles.tabs} role="tablist" aria-label="Format Cells">
        {TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={tab === entry.id}
            className={`${styles.tab} ${tab === entry.id ? styles.tabActive : ''}`}
            onClick={() => setTab(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </div>

      <div className={styles.page} role="tabpanel" aria-label={TABS.find((entry) => entry.id === tab)?.label}>
        {tab === 'number' ? (
          <div className={styles.numberLayout}>
            <ListField
              label="Category:"
              value={number.category}
              options={CATEGORIES.map((category) => ({ value: category, label: category }))}
              rows={8}
              onChange={(category) => setNumber({ ...number, category: category as Category, decimals: number.category === 'General' || number.category === 'Text' ? 2 : number.decimals })}
            />
            <div className={styles.numberOptions}>
              <fieldset className={styles.group}>
                <legend>Sample</legend>
                <div className={styles.sample}>{sample || ' '}</div>
              </fieldset>

              {number.category === 'Number' || number.category === 'Currency' || number.category === 'Percentage' ? (
                <label className={styles.inline}>
                  Decimal places:
                  <input
                    type="number"
                    className={styles.numberInput}
                    min={0}
                    max={10}
                    value={number.decimals}
                    onChange={(event) =>
                      setNumber({ ...number, decimals: Math.max(0, Math.min(10, Math.trunc(Number(event.target.value) || 0))) })
                    }
                  />
                </label>
              ) : null}

              {number.category === 'Number' ? (
                <label className={styles.check}>
                  <input
                    type="checkbox"
                    checked={number.separator}
                    onChange={(event) => setNumber({ ...number, separator: event.target.checked })}
                  />
                  Use 1000 Separator (,)
                </label>
              ) : null}

              {number.category === 'Currency' ? (
                <label className={styles.inline}>
                  Symbol:
                  <select
                    className={styles.select}
                    value={number.symbol}
                    onChange={(event) => setNumber({ ...number, symbol: event.target.value })}
                  >
                    {CURRENCY_SYMBOLS.map((symbol) => (
                      <option key={symbol} value={symbol}>
                        {symbol}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {number.category === 'Date' || number.category === 'Time' ? (
                <ListField
                  label="Type:"
                  value={number.category === 'Date' ? number.dateCode : number.timeCode}
                  options={(number.category === 'Date' ? DATE_TYPES : TIME_TYPES).map((type) => ({
                    value: type.code,
                    label: type.label,
                  }))}
                  rows={6}
                  onChange={(code) =>
                    setNumber(number.category === 'Date' ? { ...number, dateCode: code } : { ...number, timeCode: code })
                  }
                />
              ) : null}

              {number.category === 'Custom' ? (
                <label className={styles.stack}>
                  Type:
                  <input
                    type="text"
                    autoComplete="off"
                    className={styles.input}
                    value={number.custom}
                    onChange={(event) => setNumber({ ...number, custom: event.target.value })}
                  />
                </label>
              ) : null}

              <p className={styles.help}>{CATEGORY_HELP[number.category]}</p>
            </div>
          </div>
        ) : null}

        {tab === 'alignment' ? (
          <div className={styles.alignmentLayout}>
            <div>
              <fieldset className={styles.group}>
                <legend>Text alignment</legend>
                <label className={styles.stack}>
                  Horizontal:
                  <select
                    className={styles.select}
                    value={horizontal}
                    onChange={(event) => setHorizontal(event.target.value as TextAlignment | 'general')}
                  >
                    <option value="general">General</option>
                    <option value="left">Left (Indent)</option>
                    <option value="center">Center</option>
                    <option value="right">Right (Indent)</option>
                    <option value="justify">Justify</option>
                  </select>
                </label>
                <label className={styles.stack}>
                  Vertical:
                  <select
                    className={styles.select}
                    value={vertical}
                    onChange={(event) => setVertical(event.target.value as VerticalAlignment)}
                  >
                    <option value="top">Top</option>
                    <option value="middle">Center</option>
                    <option value="bottom">Bottom</option>
                  </select>
                </label>
                <label className={styles.inline}>
                  Indent:
                  <input
                    type="number"
                    className={styles.numberInput}
                    min={0}
                    max={15}
                    value={indent}
                    // Excel only indents text that sits against an edge.
                    disabled={horizontal !== 'left' && horizontal !== 'right'}
                    onChange={(event) => setIndent(Math.max(0, Math.min(15, Math.trunc(Number(event.target.value) || 0))))}
                  />
                </label>
              </fieldset>

              <fieldset className={styles.group}>
                <legend>Text control</legend>
                <label className={styles.check}>
                  <input type="checkbox" checked={wrap} onChange={(event) => setWrap(event.target.checked)} />
                  Wrap text
                </label>
                <label className={styles.check}>
                  <input
                    type="checkbox"
                    checked={merge}
                    disabled={single && !wasMerged}
                    title={single && !wasMerged ? 'Select more than one cell to merge' : undefined}
                    onChange={(event) => setMerge(event.target.checked)}
                  />
                  Merge cells
                </label>
              </fieldset>
            </div>

            <fieldset className={styles.group}>
              <legend>Orientation</legend>
              <div className={styles.orientation}>
                <span className={styles.orientationText} style={{ transform: `rotate(${-rotation}deg)` }}>
                  Text —
                </span>
              </div>
              <input
                type="range"
                aria-label="Orientation"
                min={-90}
                max={90}
                step={1}
                value={rotation}
                onChange={(event) => setRotation(Number(event.target.value))}
              />
              <label className={styles.inline}>
                <input
                  type="number"
                  className={styles.numberInput}
                  min={-90}
                  max={90}
                  value={rotation}
                  onChange={(event) => setRotation(Math.max(-90, Math.min(90, Math.trunc(Number(event.target.value) || 0))))}
                />
                Degrees
              </label>
            </fieldset>
          </div>
        ) : null}

        {tab === 'font' ? (
          <>
            <div className={styles.fontLayout}>
              <ComboList
                label="Font:"
                value={family}
                options={FONT_FAMILIES}
                rows={6}
                onChange={setFamily}
                optionStyle={(option) => ({ fontFamily: option })}
              />
              <ComboList
                label="Font style:"
                value={fontStyle}
                options={FONT_STYLES}
                rows={6}
                readOnly
                onChange={(name) => setFontStyle(name as FontStyleName)}
              />
              <ComboList
                label="Size:"
                value={size}
                options={FONT_SIZES.map(String)}
                rows={6}
                invalid={!sizeValid}
                onChange={setSize}
              />
            </div>

            <div className={styles.fontLayout}>
              <label className={styles.stack}>
                Underline:
                <select
                  className={styles.select}
                  value={underline ? 'single' : 'none'}
                  onChange={(event) => setUnderline(event.target.value === 'single')}
                >
                  <option value="none">None</option>
                  <option value="single">Single</option>
                </select>
              </label>
              <label className={styles.stack}>
                Color:
                <ColorField value={fontColor} automatic="Automatic" onChange={setFontColor} />
              </label>
              <label className={`${styles.check} ${styles.normalFont}`}>
                <input type="checkbox" checked={isNormalFont} onChange={(event) => event.target.checked && resetFont()} />
                Normal font
              </label>
            </div>

            <div className={styles.fontLayout}>
              <fieldset className={styles.group}>
                <legend>Effects</legend>
                <label className={styles.check}>
                  <input type="checkbox" checked={strike} onChange={(event) => setStrike(event.target.checked)} />
                  Strikethrough
                </label>
                <label className={styles.check}>
                  <input
                    type="checkbox"
                    checked={effect === 'superscript'}
                    onChange={(event) => setEffect(event.target.checked ? 'superscript' : undefined)}
                  />
                  Superscript
                </label>
                <label className={styles.check}>
                  <input
                    type="checkbox"
                    checked={effect === 'subscript'}
                    onChange={(event) => setEffect(event.target.checked ? 'subscript' : undefined)}
                  />
                  Subscript
                </label>
              </fieldset>
              <fieldset className={`${styles.group} ${styles.wide}`}>
                <legend>Preview</legend>
                <div className={styles.preview}>
                  <span style={previewStyle}>{family || 'AaBbCcYyZz'}</span>
                </div>
              </fieldset>
            </div>
          </>
        ) : null}

        {tab === 'border' ? (
          <div className={styles.borderLayout}>
            <fieldset className={styles.group}>
              <legend>Line</legend>
              <ListField
                label="Style:"
                value={lineStyle}
                options={LINE_STYLES.map((line) => ({ value: line.style, label: line.label }))}
                rows={6}
                onChange={(value) => setLineStyle(value as BorderStyle)}
              />
              <label className={styles.stack}>
                Color:
                <ColorField value={lineColor} automatic="Automatic" onChange={(value) => setLineColor(value ?? '#000000')} />
              </label>
            </fieldset>

            <div className={styles.borderMain}>
              <div className={styles.presets}>
                <PresetButton label="None" onClick={() => preset('none')} />
                <PresetButton label="Outline" onClick={() => preset('outline')} />
                <PresetButton label="Inside" disabled={single} onClick={() => preset('inside')} />
              </div>

              <div className={styles.borderGrid}>
                <div className={styles.edgeColumn}>
                  <EdgeButton label="Top border" glyph="⎺" pressed={Boolean(shownEdge('top'))} onClick={() => toggleEdge('top')} />
                  <EdgeButton
                    label="Inside horizontal border"
                    glyph="━"
                    disabled={range.start.row === range.end.row}
                    pressed={Boolean(shownEdge('insideH'))}
                    onClick={() => toggleEdge('insideH')}
                  />
                  <EdgeButton label="Bottom border" glyph="⎽" pressed={Boolean(shownEdge('bottom'))} onClick={() => toggleEdge('bottom')} />
                </div>

                <div
                  className={styles.borderPreview}
                  aria-hidden="true"
                  style={{
                    borderTop: edgeCss(shownEdge('top')),
                    borderBottom: edgeCss(shownEdge('bottom')),
                    borderLeft: edgeCss(shownEdge('left')),
                    borderRight: edgeCss(shownEdge('right')),
                  }}
                >
                  {range.start.col !== range.end.col ? (
                    <span className={styles.insideV} style={{ borderLeft: edgeCss(shownEdge('insideV')) }} />
                  ) : null}
                  {range.start.row !== range.end.row ? (
                    <span className={styles.insideH} style={{ borderTop: edgeCss(shownEdge('insideH')) }} />
                  ) : null}
                  <span className={styles.previewText}>Text</span>
                </div>
              </div>

              <div className={styles.edgeRow}>
                <EdgeButton label="Left border" glyph="⎸" pressed={Boolean(shownEdge('left'))} onClick={() => toggleEdge('left')} />
                <EdgeButton
                  label="Inside vertical border"
                  glyph="┃"
                  disabled={range.start.col === range.end.col}
                  pressed={Boolean(shownEdge('insideV'))}
                  onClick={() => toggleEdge('insideV')}
                />
                <EdgeButton label="Right border" glyph="⎹" pressed={Boolean(shownEdge('right'))} onClick={() => toggleEdge('right')} />
              </div>

              <p className={styles.help}>
                Choose a line style and colour, then click a preset, a button, or the edge you want to draw.
              </p>
            </div>
          </div>
        ) : null}

        {tab === 'fill' ? (
          <div className={styles.fillLayout}>
            <div>
              <span>Background Color:</span>
              <button
                type="button"
                className={`${styles.noColor} ${fill === null ? styles.swatchActive : ''}`}
                onClick={() => setFill(null)}
              >
                No Color
              </button>
              <div className={styles.palette} role="listbox" aria-label="Background color">
                {PALETTE.map((color) => (
                  <button
                    key={color}
                    type="button"
                    role="option"
                    aria-selected={fill?.toLowerCase() === color}
                    aria-label={color}
                    title={color}
                    className={`${styles.swatch} ${fill?.toLowerCase() === color ? styles.swatchActive : ''}`}
                    style={{ background: color }}
                    onClick={() => setFill(color)}
                  />
                ))}
              </div>
              <label className={styles.inline}>
                More Colors…
                <input type="color" value={fill ?? '#ffffff'} onChange={(event) => setFill(event.target.value)} />
              </label>
            </div>
            <fieldset className={styles.group}>
              <legend>Sample</legend>
              <div className={styles.fillSample} style={{ background: fill ?? '#ffffff' }} />
            </fieldset>
          </div>
        ) : null}
      </div>
    </Dialog>
  );
}

/* -- Controls ------------------------------------------------------------ */

/** A labelled list box, as Excel's Category and Style lists. */
function ListField({
  label,
  value,
  options,
  rows,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  rows: number;
  onChange: (value: string) => void;
}) {
  return (
    <label className={styles.stack}>
      {label}
      <select className={styles.list} size={rows} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * Excel's text box over a list: type a value, or pick one. The Font and Size
 * columns take values the list does not offer — a paper may ask for 15pt.
 */
function ComboList({
  label,
  value,
  options,
  rows,
  onChange,
  readOnly = false,
  invalid = false,
  optionStyle,
}: {
  label: string;
  value: string;
  options: readonly string[];
  rows: number;
  onChange: (value: string) => void;
  readOnly?: boolean;
  invalid?: boolean;
  optionStyle?: (option: string) => CSSProperties;
}) {
  return (
    <div className={styles.stack}>
      <label className={styles.stack}>
        {label}
        <input
          type="text"
                    autoComplete="off"
          className={`${styles.input} ${invalid ? styles.invalid : ''}`}
          value={value}
          readOnly={readOnly}
          aria-invalid={invalid || undefined}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
      <select
        className={styles.list}
        size={rows}
        aria-label={label.replace(/:$/, '')}
        value={options.includes(value) ? value : ''}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option} value={option} style={optionStyle?.(option)}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

/** A colour select: Automatic, the theme palette, or any colour. */
function ColorField({
  value,
  automatic,
  onChange,
}: {
  value: string | null;
  automatic: string;
  onChange: (value: string | null) => void;
}) {
  const inPalette = value === null || PALETTE.includes(value.toLowerCase());
  return (
    <span className={styles.colorField}>
      <span className={styles.colorWell} style={{ background: value ?? '#000000' }} aria-hidden="true" />
      <select
        className={styles.select}
        value={value?.toLowerCase() ?? ''}
        onChange={(event) => onChange(event.target.value === '' ? null : event.target.value)}
      >
        <option value="">{automatic}</option>
        {PALETTE.map((color) => (
          <option key={color} value={color}>
            {color}
          </option>
        ))}
        {inPalette ? null : <option value={value!.toLowerCase()}>{value}</option>}
      </select>
      <input type="color" aria-label="More colors" value={value ?? '#000000'} onChange={(event) => onChange(event.target.value)} />
    </span>
  );
}

function PresetButton({ label, onClick, disabled = false }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" className={styles.presetButton} disabled={disabled} onClick={onClick}>
      {label}
    </button>
  );
}

function EdgeButton({
  label,
  glyph,
  pressed,
  onClick,
  disabled = false,
}: {
  label: string;
  glyph: ReactNode;
  pressed: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={`${styles.edgeButton} ${pressed ? styles.edgePressed : ''}`}
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      {glyph}
    </button>
  );
}
