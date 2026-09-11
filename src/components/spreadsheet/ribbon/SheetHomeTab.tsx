'use client';

import { ColorPicker } from '@/components/controls/ColorPicker';
import { NumberCombo } from '@/components/controls/NumberCombo';
import { SelectMenu } from '@/components/controls/SelectMenu';
import { ToolbarButton } from '@/components/controls/ToolbarButton';
import { RibbonColumn, RibbonGroup, RibbonRow } from '@/components/ribbon/RibbonGroup';
import { columnToLabel } from '@/spreadsheet/model/address';
import { NUMBER_FORMATS } from '@/spreadsheet/model/format';
import type { RangeAddress } from '@/spreadsheet/model/address';
import {
  DEFAULT_FONT_FAMILY,
  DEFAULT_FONT_SIZE_PT,
  type CellBorders,
  type CellStyle,
} from '@/spreadsheet/model/styles';
import { useSelection, useWorkbookStore, useWorkbookVersion } from '@/spreadsheet/useWorkbook';
import { useSpreadsheetUiStore } from '@/state/spreadsheetUiStore';
import styles from './SpreadsheetRibbon.module.css';

/**
 * The Home tab.
 *
 * Same rule as the Word editor's ribbon, for the same reason: **a control is
 * either wired to the workbook or visibly disabled with the reason why.** A
 * practical paper is marked on which control produced a change, so a button
 * that looks live and does nothing is not a cosmetic problem — it is a
 * candidate failing a question they answered correctly.
 *
 * Every command here passes its `control` id to the store, which records it in
 * the operation log alongside the change. That is what will let a marker
 * distinguish "bolded from the ribbon" from "bolded some other way".
 */

const FONT_FAMILIES = [
  'Calibri',
  'Arial',
  'Times New Roman',
  'Verdana',
  'Georgia',
  'Courier New',
  'Segoe UI',
  'Tahoma',
];

const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36, 48, 72];

const BORDER_PRESETS = [
  { value: 'none', label: 'No Border' },
  { value: 'bottom', label: 'Bottom Border' },
  { value: 'top', label: 'Top Border' },
  { value: 'left', label: 'Left Border' },
  { value: 'right', label: 'Right Border' },
  { value: 'all', label: 'All Borders' },
  { value: 'outline', label: 'Outside Borders' },
] as const;

const THIN_BLACK = { style: 'thin' as const, color: '#000000' };

const NUMBER_FORMAT_OPTIONS = [
  { value: NUMBER_FORMATS.general, label: 'General' },
  { value: NUMBER_FORMATS.number, label: 'Number' },
  { value: NUMBER_FORMATS.thousands, label: 'Comma' },
  { value: NUMBER_FORMATS.currency, label: 'Currency' },
  { value: NUMBER_FORMATS.currencyWhole, label: 'Currency (0 decimals)' },
  { value: NUMBER_FORMATS.percent, label: 'Percentage' },
  { value: NUMBER_FORMATS.date, label: 'Short Date' },
  { value: NUMBER_FORMATS.time, label: 'Time' },
  { value: NUMBER_FORMATS.text, label: 'Text' },
];

export function SheetHomeTab() {
  const store = useWorkbookStore();
  const selection = useSelection();
  useWorkbookVersion();

  const setNotice = useSpreadsheetUiStore((state) => state.setNotice);
  const readOnly = useSpreadsheetUiStore((state) => state.readOnly);

  const active = selection.active;
  const style: CellStyle = store.styleAt(active.row, active.col);
  const sheet = store.activeSheet();
  const merged = sheet.mergeCovering(active.row, active.col) !== undefined;

  const apply = (changes: Partial<CellStyle>, label: string, control: string): void => {
    store.applyStyle(changes, label, control);
  };

  /**
   * Appended to every editing control's tooltip while the sheet is protected.
   *
   * The controls go dead rather than disappearing: a candidate who cannot find
   * Bold needs to be told why, not left hunting for a button that is no longer
   * on the ribbon.
   */
  const protectedReason = readOnly ? 'the sheet is protected — turn it off on the Review tab' : undefined;

  const toggle = (key: 'bold' | 'italic' | 'underline' | 'strikethrough', label: string, control: string): void => {
    apply({ [key]: style[key] ? undefined : true }, label, control);
  };

  /**
   * Borders, applied per cell according to where the cell sits.
   *
   * This cannot go through `applyStyle`, which puts the same style on every
   * selected cell. "Outside Borders" means the *perimeter* of the selection —
   * the top edge only on the top row, the left edge only on the left column —
   * so each cell needs a different set. Applying all four edges to every cell
   * is All Borders, which is a different answer to a different question.
   */
  const applyBorders = (preset: string, label: string): void => {
    const range = store.selection.getRanges()[0];
    if (!range) return;

    store.applyStylePerCell(
      (address) => ({ borders: bordersAt(preset, address, range) }),
      label,
      'home.font.borders',
    );
  };

  return (
    <div className={styles.tab}>
      <RibbonGroup label="Clipboard">
        <RibbonRow>
          <ToolbarButton
            label="Paste"
            icon="paste"
            size="large"
            disabled={readOnly || !store.canPaste()}
            disabledReason={protectedReason ?? 'nothing has been copied in this workbook'}
            onClick={() => store.paste()}
          />
          <RibbonColumn>
            <ToolbarButton
              label="Cut"
              icon="cut"
              size="wide"
              disabled={readOnly}
              disabledReason={protectedReason}
              onClick={() => store.cutSelection()}
            />
            <ToolbarButton label="Copy" icon="copy" size="wide" onClick={() => store.copySelection()} />
          </RibbonColumn>
        </RibbonRow>
      </RibbonGroup>

      <RibbonGroup label="Font">
        <RibbonRow>
          <SelectMenu
            label="Font"
            value={style.fontFamily ?? DEFAULT_FONT_FAMILY}
            options={FONT_FAMILIES.map((family) => ({
              value: family,
              label: family,
              optionStyle: { fontFamily: family },
            }))}
            width={128}
            onChange={(family) => apply({ fontFamily: family }, 'Font', 'home.font.family')}
          />
          <NumberCombo
            label="Font Size"
            value={style.fontSize ?? DEFAULT_FONT_SIZE_PT}
            options={FONT_SIZES}
            min={1}
            max={409}
            width={52}
            onChange={(size) => apply({ fontSize: size }, 'Font Size', 'home.font.size')}
          />
        </RibbonRow>
        <RibbonRow>
          <ToolbarButton
            label="Bold"
            glyph={<strong>B</strong>}
            disabled={readOnly}
            disabledReason={protectedReason}
            active={Boolean(style.bold)}
            onClick={() => toggle('bold', 'Bold', 'home.font.bold')}
          />
          <ToolbarButton
            label="Italic"
            glyph={<em>I</em>}
            disabled={readOnly}
            disabledReason={protectedReason}
            active={Boolean(style.italic)}
            onClick={() => toggle('italic', 'Italic', 'home.font.italic')}
          />
          <ToolbarButton
            label="Underline"
            glyph={<u>U</u>}
            disabled={readOnly}
            disabledReason={protectedReason}
            active={Boolean(style.underline)}
            onClick={() => toggle('underline', 'Underline', 'home.font.underline')}
          />
          <ToolbarButton
            label="Subscript"
            glyph={
              <span>
                x<sub>2</sub>
              </span>
            }
            disabled={readOnly}
            disabledReason={protectedReason}
            active={style.textEffect === 'subscript'}
            onClick={() =>
              apply(
                { textEffect: style.textEffect === 'subscript' ? undefined : 'subscript' },
                'Subscript',
                'home.font.subscript',
              )
            }
          />
          <ToolbarButton
            label="Superscript"
            glyph={
              <span>
                x<sup>2</sup>
              </span>
            }
            disabled={readOnly}
            disabledReason={protectedReason}
            active={style.textEffect === 'superscript'}
            onClick={() =>
              apply(
                { textEffect: style.textEffect === 'superscript' ? undefined : 'superscript' },
                'Superscript',
                'home.font.superscript',
              )
            }
          />
          <SelectMenu
            label="Borders"
            value={null}
            placeholder="Borders"
            width={104}
            disabled={readOnly}
            options={BORDER_PRESETS.map((preset) => ({ value: preset.value, label: preset.label }))}
            onChange={(preset) =>
              applyBorders(
                preset,
                BORDER_PRESETS.find((item) => item.value === preset)?.label ?? 'Borders',
              )
            }
          />
          <ColorPicker
            label="Fill Color"
            icon="highlight"
            currentColor={style.fillColor ?? null}
            defaultColor="#ffff00"
            clearLabel="No Fill"
            onSelect={(color) =>
              apply({ fillColor: color ?? undefined }, 'Fill Color', 'home.font.fill')
            }
          />
          <ColorPicker
            label="Font Color"
            icon="text-color"
            currentColor={style.fontColor ?? null}
            defaultColor="#c00000"
            clearLabel="Automatic"
            onSelect={(color) =>
              apply({ fontColor: color ?? undefined }, 'Font Color', 'home.font.color')
            }
          />
        </RibbonRow>
      </RibbonGroup>

      <RibbonGroup label="Alignment">
        <RibbonRow>
          <ToolbarButton
            label="Top Align"
            glyph="⬒"
            active={style.verticalAlignment === 'top'}
            onClick={() => apply({ verticalAlignment: 'top' }, 'Top Align', 'home.alignment.top')}
          />
          <ToolbarButton
            label="Middle Align"
            glyph="⬓"
            active={style.verticalAlignment === 'middle'}
            onClick={() => apply({ verticalAlignment: 'middle' }, 'Middle Align', 'home.alignment.middle')}
          />
          <ToolbarButton
            label="Bottom Align"
            glyph="⬔"
            active={style.verticalAlignment === 'bottom'}
            onClick={() => apply({ verticalAlignment: 'bottom' }, 'Bottom Align', 'home.alignment.bottom')}
          />
        </RibbonRow>
        <RibbonRow>
          <ToolbarButton
            label="Align Left"
            glyph="≡"
            active={style.horizontalAlignment === 'left'}
            onClick={() => apply({ horizontalAlignment: 'left' }, 'Align Left', 'home.alignment.left')}
          />
          <ToolbarButton
            label="Center"
            glyph="≣"
            active={style.horizontalAlignment === 'center'}
            onClick={() => apply({ horizontalAlignment: 'center' }, 'Center', 'home.alignment.center')}
          />
          <ToolbarButton
            label="Align Right"
            glyph="≡"
            active={style.horizontalAlignment === 'right'}
            onClick={() => apply({ horizontalAlignment: 'right' }, 'Align Right', 'home.alignment.right')}
          />
          <ToolbarButton
            label="Wrap Text"
            glyph="↵"
            active={Boolean(style.wrapText)}
            onClick={() => apply({ wrapText: style.wrapText ? undefined : true }, 'Wrap Text', 'home.alignment.wrap')}
          />
          <ToolbarButton
            label="Merge Across"
            glyph="⬍"
            disabled={readOnly || merged}
            disabledReason={protectedReason ?? (merged ? 'these cells are already merged' : undefined)}
            onClick={() => {
              if (!store.mergeAcross()) {
                setNotice('Those rows cannot be merged — one of them overlaps an existing merge.');
              }
            }}
          />
          <ToolbarButton
            label={merged ? 'Unmerge Cells' : 'Merge & Center'}
            glyph="⬌"
            active={merged}
            onClick={() => {
              if (merged) {
                store.unmergeSelection();
                return;
              }
              if (store.mergeSelection()) {
                store.applyStyle({ horizontalAlignment: 'center' }, 'Merge & Center', 'home.alignment.merge');
                return;
              }
              setNotice('That range cannot be merged — it overlaps an existing merge.');
            }}
          />
        </RibbonRow>
      </RibbonGroup>

      <RibbonGroup label="Number">
        <RibbonRow>
          <SelectMenu
            label="Number Format"
            value={style.numberFormat ?? NUMBER_FORMATS.general}
            options={NUMBER_FORMAT_OPTIONS}
            width={128}
            onChange={(format) =>
              apply({ numberFormat: format }, 'Number Format', 'home.number.format')
            }
          />
        </RibbonRow>
        <RibbonRow>
          <ToolbarButton
            label="Percent Style"
            glyph="%"
            active={style.numberFormat === NUMBER_FORMATS.percent}
            onClick={() => apply({ numberFormat: NUMBER_FORMATS.percent }, 'Percent Style', 'home.number.percent')}
          />
          <ToolbarButton
            label="Comma Style"
            glyph=","
            active={style.numberFormat === NUMBER_FORMATS.thousands}
            onClick={() => apply({ numberFormat: NUMBER_FORMATS.thousands }, 'Comma Style', 'home.number.comma')}
          />
          <ToolbarButton
            label="Increase Decimal"
            glyph=".0→"
            onClick={() =>
              apply(
                { numberFormat: withDecimals(style.numberFormat, 1) },
                'Increase Decimal',
                'home.number.increaseDecimal',
              )
            }
          />
          <ToolbarButton
            label="Decrease Decimal"
            glyph="←.0"
            onClick={() =>
              apply(
                { numberFormat: withDecimals(style.numberFormat, -1) },
                'Decrease Decimal',
                'home.number.decreaseDecimal',
              )
            }
          />
        </RibbonRow>
      </RibbonGroup>

      <RibbonGroup label="Cells">
        <RibbonRow>
          <RibbonColumn>
            {/*
              Inserting and deleting rows shifts every reference below them, and
              there is no operation for that in the command layer yet. A button
              that reflowed the sheet without the formulas following would
              corrupt a workbook silently, so it says what it is instead.
            */}
            <ToolbarButton
              label="Insert"
              size="wide"
              glyph="+"
              disabled
              disabledReason="inserting rows and columns is not in this build"
            />
            <ToolbarButton
              label="Delete"
              size="wide"
              glyph="−"
              disabled
              disabledReason="deleting rows and columns is not in this build"
            />
          </RibbonColumn>
          <RibbonColumn>
            <ToolbarButton
              label="AutoFit Column"
              size="wide"
              glyph="↔"
              onClick={() => store.setColumnWidth(active.col, autoFitWidth(store, active.col))}
            />
            <ToolbarButton
              label="Standard Width"
              size="wide"
              glyph="↦"
              onClick={() => store.setColumnWidth(active.col, 64)}
            />
          </RibbonColumn>
        </RibbonRow>
      </RibbonGroup>

      <RibbonGroup label="Editing">
        <RibbonRow>
          <RibbonColumn>
            <ToolbarButton
              label="AutoSum"
              size="wide"
              glyph="Σ"
              onClick={() => {
                const range = sumRangeAbove(store, active.row, active.col);
                if (!range) {
                  setNotice('AutoSum needs numbers directly above the cursor.');
                  return;
                }
                store.setCellInput(active.row, active.col, range, 'ribbon');
                void store.ensureEngine();
              }}
            />
            <ToolbarButton
              label="Clear Contents"
              size="wide"
              glyph="⌫"
              disabled={readOnly}
              disabledReason={protectedReason}
              onClick={() => store.clearContents('ribbon')}
            />
          </RibbonColumn>
          <ToolbarButton
            label="Find & Select"
            icon="find"
            size="large"
            disabled
            disabledReason="find and replace across a sheet is not in this build"
          />
        </RibbonRow>
      </RibbonGroup>
    </div>
  );
}

/**
 * The borders one cell gets, given the preset and where it sits in the range.
 *
 * `outline` is the reason this takes a position at all: Excel's Outside Borders
 * draws the edge of the selection, so an interior cell gets nothing.
 */
export function bordersAt(
  preset: string,
  cell: { row: number; col: number },
  range: RangeAddress,
): CellBorders | undefined {
  switch (preset) {
    case 'none':
      return undefined;
    case 'bottom':
      return { bottom: THIN_BLACK };
    case 'top':
      return { top: THIN_BLACK };
    case 'left':
      return { left: THIN_BLACK };
    case 'right':
      return { right: THIN_BLACK };
    case 'all':
      return { top: THIN_BLACK, right: THIN_BLACK, bottom: THIN_BLACK, left: THIN_BLACK };
    case 'outline': {
      const borders: CellBorders = {};
      if (cell.row === range.start.row) borders.top = THIN_BLACK;
      if (cell.row === range.end.row) borders.bottom = THIN_BLACK;
      if (cell.col === range.start.col) borders.left = THIN_BLACK;
      if (cell.col === range.end.col) borders.right = THIN_BLACK;
      return Object.keys(borders).length > 0 ? borders : undefined;
    }
    default:
      return undefined;
  }
}

/**
 * The same number format with one more or one fewer decimal place.
 *
 * Only the codes the Number group can produce are adjusted. A code from a
 * parsed workbook that this does not recognise is left alone rather than
 * rewritten into something that means something else.
 */
export function withDecimals(format: string | undefined, delta: number): string {
  const current = format ?? NUMBER_FORMATS.general;
  const match = /^(₹?)(#,##0|0)(?:\.(0+))?(%?)$/.exec(current);

  if (!match) {
    // General with one more decimal is `0.0`, which is what Excel does too.
    return delta > 0 ? '0.0' : NUMBER_FORMATS.general;
  }

  const [, currency = '', base = '0', decimals = '', percent = ''] = match;
  const places = Math.max(0, Math.min(10, decimals.length + delta));
  const fraction = places === 0 ? '' : `.${'0'.repeat(places)}`;

  return `${currency}${base}${fraction}${percent}`;
}

/** A width that fits the longest text in the column, within reason. */
function autoFitWidth(store: ReturnType<typeof useWorkbookStore>, col: number): number {
  const sheet = store.activeSheet();
  const used = sheet.usedRange();
  if (!used) return 64;

  let longest = 0;
  for (let row = used.start.row; row <= used.end.row; row += 1) {
    const cell = sheet.getCell(row, col);
    if (!cell) continue;
    longest = Math.max(longest, String(cell.value ?? '').length);
  }

  // 7px per character is Calibri 11's rough average advance; the estimate is
  // only ever off by a character or two, and the column stays draggable.
  return Math.max(32, Math.min(400, longest * 7 + 10));
}

/**
 * The `=SUM(...)` AutoSum would insert, or null when there is nothing above.
 *
 * Excel looks upward for a contiguous run of numbers, which is what makes
 * AutoSum feel like it read your mind.
 */
function sumRangeAbove(
  store: ReturnType<typeof useWorkbookStore>,
  row: number,
  col: number,
): string | null {
  const sheet = store.activeSheet();

  let top = row;
  while (top > 0 && typeof sheet.getValue(top - 1, col) === 'number') top -= 1;
  if (top === row) return null;

  const label = columnToLabel(col);
  return `=SUM(${label}${top + 1}:${label}${row})`;
}
