'use client';

import { useState, type CSSProperties, type FormEvent } from 'react';
import { ColorPicker } from '@/components/controls/ColorPicker';
import { NumberCombo } from '@/components/controls/NumberCombo';
import { SelectMenu } from '@/components/controls/SelectMenu';
import { ToolbarButton } from '@/components/controls/ToolbarButton';
import { RibbonColumn, RibbonGroup, RibbonRow } from '@/components/ribbon/RibbonGroup';
import { autoFitColumnWidth, autoFitRowHeight } from '@/components/spreadsheet/grid/autoFit';
import { focusSheetGrid } from '@/components/spreadsheet/grid/SpreadsheetGrid';
import { NUMBER_FORMATS, NUMERIC_CODE } from '@/spreadsheet/model/format';
import type { RangeAddress } from '@/spreadsheet/model/address';
import {
  DEFAULT_FONT_FAMILY,
  DEFAULT_FONT_SIZE_PT,
  type BorderEdge,
  type CellBorders,
  type CellStyle,
} from '@/spreadsheet/model/styles';
import { DEFAULT_COLUMN_WIDTH } from '@/spreadsheet/model/Worksheet';
import { useSelection, useWorkbookStore, useWorkbookVersion } from '@/spreadsheet/useWorkbook';
import type { FindOptions, WorkbookStore } from '@/spreadsheet/WorkbookStore';
import { useSpreadsheetUiStore, type FormatCellsTab } from '@/state/spreadsheetUiStore';
import { CollapsibleGroup } from './CollapsibleGroup';
import { RibbonMenu, type RibbonMenuEntry } from './RibbonMenu';
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

/** Excel's Font Size list, which Increase and Decrease Font Size step through. */
const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72];

const BORDER_PRESETS = [
  { value: 'bottom', label: 'Bottom Border' },
  { value: 'top', label: 'Top Border' },
  { value: 'left', label: 'Left Border' },
  { value: 'right', label: 'Right Border' },
  { value: 'none', label: 'No Border' },
  { value: 'all', label: 'All Borders' },
  { value: 'outline', label: 'Outside Borders' },
  { value: 'thickOutline', label: 'Thick Outside Borders' },
  { value: 'bottomDouble', label: 'Bottom Double Border' },
  { value: 'thickBottom', label: 'Thick Bottom Border' },
  { value: 'topBottom', label: 'Top and Bottom Border' },
  { value: 'topThickBottom', label: 'Top and Thick Bottom Border' },
  { value: 'topDoubleBottom', label: 'Top and Double Bottom Border' },
] as const;

const THIN_BLACK: BorderEdge = { style: 'thin', color: '#000000' };
const THICK_BLACK: BorderEdge = { style: 'thick', color: '#000000' };
const DOUBLE_BLACK: BorderEdge = { style: 'double', color: '#000000' };

const NUMBER_FORMAT_OPTIONS = [
  { value: NUMBER_FORMATS.general, label: 'General' },
  { value: NUMBER_FORMATS.number, label: 'Number' },
  { value: NUMBER_FORMATS.thousands, label: 'Comma' },
  { value: NUMBER_FORMATS.currency, label: 'Currency' },
  { value: NUMBER_FORMATS.currencyWhole, label: 'Currency (0 decimals)' },
  { value: NUMBER_FORMATS.percent, label: 'Percentage' },
  { value: NUMBER_FORMATS.date, label: 'Short Date' },
  { value: NUMBER_FORMATS.longDate, label: 'Long Date' },
  { value: NUMBER_FORMATS.time, label: 'Time' },
  { value: NUMBER_FORMATS.text, label: 'Text' },
];

/** The Accounting Number Format menu: the currencies a paper here asks for. */
const ACCOUNTING_FORMATS = [
  { label: '₹ English (India)', format: '₹#,##0.00' },
  { label: '$ English (United States)', format: '$#,##0.00' },
  { label: '€ Euro', format: '€#,##0.00' },
  { label: '£ English (United Kingdom)', format: '£#,##0.00' },
];

/** Home > Orientation. Degrees as Excel stores them: counterclockwise is positive. */
const ORIENTATIONS = [
  { label: 'Angle Counterclockwise', degrees: 45, glyph: '⤴' },
  { label: 'Angle Clockwise', degrees: -45, glyph: '⤵' },
  { label: 'Rotate Text Up', degrees: 90, glyph: '↑' },
  { label: 'Rotate Text Down', degrees: -90, glyph: '↓' },
];

/** The most indent steps Excel's ribbon applies, and what the server accepts. */
const MAX_INDENT = 15;

/** Every formatting property, cleared — the Normal cell style. */
const NORMAL_STYLE: Partial<CellStyle> = {
  fontFamily: undefined,
  fontSize: undefined,
  bold: undefined,
  italic: undefined,
  underline: undefined,
  strikethrough: undefined,
  fontColor: undefined,
  fillColor: undefined,
  horizontalAlignment: undefined,
  verticalAlignment: undefined,
  wrapText: undefined,
  textEffect: undefined,
  textRotation: undefined,
  indent: undefined,
  borders: undefined,
  numberFormat: undefined,
};

function allEdges(style: BorderEdge['style'], color: string): CellBorders {
  const edge = { style, color };
  return { top: edge, right: edge, bottom: edge, left: edge };
}

/**
 * Excel's built-in cell styles, as the formatting each one applies.
 *
 * Applied as plain formatting rather than as a named style: a workbook here has
 * no style table, and what a question can check is how the cell looks.
 */
const CELL_STYLES: { group: string; styles: { name: string; style: Partial<CellStyle> }[] }[] = [
  {
    group: 'Good, Bad and Neutral',
    styles: [
      { name: 'Normal', style: NORMAL_STYLE },
      { name: 'Bad', style: { fillColor: '#ffc7ce', fontColor: '#9c0006' } },
      { name: 'Good', style: { fillColor: '#c6efce', fontColor: '#006100' } },
      { name: 'Neutral', style: { fillColor: '#ffeb9c', fontColor: '#9c5700' } },
    ],
  },
  {
    group: 'Data and Model',
    styles: [
      { name: 'Calculation', style: { fillColor: '#f2f2f2', fontColor: '#fa7d00', bold: true, borders: allEdges('thin', '#7f7f7f') } },
      { name: 'Check Cell', style: { fillColor: '#a5a5a5', fontColor: '#ffffff', bold: true, borders: allEdges('double', '#3f3f3f') } },
      { name: 'Explanatory Text', style: { italic: true, fontColor: '#7f7f7f' } },
      { name: 'Input', style: { fillColor: '#ffcc99', fontColor: '#3f3f76', borders: allEdges('thin', '#7f7f7f') } },
      { name: 'Linked Cell', style: { fontColor: '#fa7d00', borders: { bottom: { style: 'double', color: '#ff8001' } } } },
      { name: 'Note', style: { fillColor: '#ffffcc', borders: allEdges('thin', '#b2b2b2') } },
      { name: 'Output', style: { fillColor: '#f2f2f2', fontColor: '#3f3f3f', bold: true, borders: allEdges('thin', '#3f3f3f') } },
      { name: 'Warning Text', style: { fontColor: '#ff0000' } },
    ],
  },
  {
    group: 'Titles and Headings',
    styles: [
      { name: 'Heading 1', style: { bold: true, fontSize: 15, fontColor: '#44546a', borders: { bottom: { style: 'thick', color: '#4472c4' } } } },
      { name: 'Heading 2', style: { bold: true, fontSize: 13, fontColor: '#44546a', borders: { bottom: { style: 'thick', color: '#a2b8e1' } } } },
      { name: 'Heading 3', style: { bold: true, fontColor: '#44546a', borders: { bottom: { style: 'medium', color: '#8ea9db' } } } },
      { name: 'Heading 4', style: { bold: true, fontColor: '#44546a' } },
      { name: 'Title', style: { fontSize: 18, fontColor: '#44546a' } },
      {
        name: 'Total',
        style: {
          bold: true,
          borders: { top: { style: 'thin', color: '#4472c4' }, bottom: { style: 'double', color: '#4472c4' } },
        },
      },
    ],
  },
  {
    group: 'Number Format',
    styles: [
      { name: 'Comma', style: { numberFormat: NUMBER_FORMATS.thousands } },
      { name: 'Comma [0]', style: { numberFormat: '#,##0' } },
      { name: 'Currency', style: { numberFormat: NUMBER_FORMATS.currency } },
      { name: 'Currency [0]', style: { numberFormat: NUMBER_FORMATS.currencyWhole } },
      { name: 'Percent', style: { numberFormat: '0%' } },
    ],
  },
];

const NO_CONDITIONAL_FORMATS = 'a cell carries no conditional rule in this build — format the cells directly';
const NO_TABLES = 'this build has no table objects — use Cell Styles and Borders to format the range';

export function SheetHomeTab() {
  const store = useWorkbookStore();
  const selection = useSelection();
  useWorkbookVersion();

  const setNotice = useSpreadsheetUiStore((state) => state.setNotice);
  const readOnly = useSpreadsheetUiStore((state) => state.readOnly);
  const openFormatCells = useSpreadsheetUiStore((state) => state.openFormatCells);

  /** The launcher arrow in a group's corner: Format Cells, on that group's tab. */
  const launch = (tab: FormatCellsTab) => () => {
    if (readOnly) setNotice('The sheet is protected — turn protection off on the Review tab to format cells.');
    else openFormatCells(tab);
  };

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
  const locked = { disabled: readOnly, disabledReason: protectedReason };

  /*
   * How many rows or columns Insert and Delete act on.
   *
   * Excel uses the size of the selection: three rows selected inserts three.
   * A single cell means one.
   */
  const selectedRange = store.selection.getRanges()[0];
  const selectedRows = selectedRange ? selectedRange.end.row - selectedRange.start.row + 1 : 1;
  const selectedColumns = selectedRange ? selectedRange.end.col - selectedRange.start.col + 1 : 1;

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

  const fontSize = style.fontSize ?? DEFAULT_FONT_SIZE_PT;
  const indent = style.indent ?? 0;

  const autoSum = (fn: 'SUM' | 'AVERAGE' | 'COUNT' | 'MAX' | 'MIN'): void => {
    if (!store.autoSum(fn, fn === 'SUM' ? 'home.editing.autosum' : `home.editing.autosum.${fn.toLowerCase()}`)) {
      setNotice(`${fn === 'SUM' ? 'AutoSum' : fn} found no numbers above, to the left of, or in the selection.`);
    }
  };

  const merge = (kind: 'center' | 'across' | 'cells'): void => {
    if (kind === 'across') {
      if (!store.mergeAcross()) setNotice('Those rows cannot be merged — one of them overlaps an existing merge.');
      return;
    }
    if (kind === 'cells') {
      if (!store.mergeCellsOnly()) setNotice('That range cannot be merged — it overlaps an existing merge.');
      return;
    }
    if (store.mergeSelection()) {
      store.applyStyle({ horizontalAlignment: 'center' }, 'Merge & Center', 'home.alignment.merge');
      return;
    }
    setNotice('That range cannot be merged — it overlaps an existing merge.');
  };

  const sort = (direction: 'asc' | 'desc'): void => {
    const blocker = store.sortSelection(direction);
    if (blocker) setNotice(`The selection could not be sorted: ${blocker}.`);
  };

  const pasteBlocked = !store.canPaste()
    ? 'nothing has been copied in this workbook'
    : store.clipboardIsCut()
      ? 'cut cells only paste whole — use Paste'
      : undefined;

  const visibleSheets = store.workbook.visibleSheets().length;
  const autoFilter = sheet.autoFilter;

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
          <RibbonMenu
            label="Paste options"
            size="arrow"
            disabled={readOnly || !store.canPaste()}
            disabledReason={protectedReason ?? 'nothing has been copied in this workbook'}
            items={[
              { label: 'Paste', glyph: '📋', onSelect: () => store.paste('all') },
              'separator',
              { heading: 'Paste Values' },
              {
                label: 'Values',
                glyph: '123',
                disabled: pasteBlocked !== undefined,
                disabledReason: pasteBlocked,
                onSelect: () => store.paste('values'),
              },
              {
                label: 'Formulas',
                glyph: 'fx',
                disabled: pasteBlocked !== undefined,
                disabledReason: pasteBlocked,
                onSelect: () => store.paste('formulas'),
              },
              {
                label: 'Formatting',
                glyph: '🖌',
                disabled: pasteBlocked !== undefined,
                disabledReason: pasteBlocked,
                onSelect: () => store.paste('formats'),
              },
            ]}
          />
          <RibbonColumn>
            {/* Icon-only, as Excel draws them once the ribbon is full. */}
            <ToolbarButton label="Cut" icon="cut" {...locked} onClick={() => store.cutSelection()} />
            <ToolbarButton label="Copy" icon="copy" onClick={() => store.copySelection()} />
            <ToolbarButton
              label="Format Painter"
              icon="format-painter"
              {...locked}
              active={store.hasFormatBrush()}
              onClick={() => {
                if (store.hasFormatBrush()) store.dropFormatBrush();
                else if (store.pickUpFormat()) focusSheetGrid();
              }}
            />
          </RibbonColumn>
        </RibbonRow>
      </RibbonGroup>

      <CollapsibleGroup label="Font" glyph={<span className={styles.fontGlyph}>A</span>} onLaunch={launch('font')} launchLabel="Format Cells: Font">
        <RibbonColumn>
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
              disabled={readOnly}
              onChange={(family) => apply({ fontFamily: family }, 'Font', 'home.font.family')}
            />
            <NumberCombo
              label="Font Size"
              value={fontSize}
              options={FONT_SIZES}
              min={1}
              max={409}
              width={52}
              onChange={(size) => apply({ fontSize: size }, 'Font Size', 'home.font.size')}
            />
            <ToolbarButton
              label="Increase Font Size"
              icon="grow-font"
              {...locked}
              onClick={() => apply({ fontSize: stepFontSize(fontSize, 1) }, 'Increase Font Size', 'home.font.grow')}
            />
            <ToolbarButton
              label="Decrease Font Size"
              icon="shrink-font"
              {...locked}
              disabled={readOnly || fontSize <= 1}
              disabledReason={protectedReason ?? 'the text is already at the smallest size'}
              onClick={() => apply({ fontSize: stepFontSize(fontSize, -1) }, 'Decrease Font Size', 'home.font.shrink')}
            />
          </RibbonRow>
          <RibbonRow>
            <ToolbarButton
              label="Bold"
              glyph={<strong>B</strong>}
              {...locked}
              active={Boolean(style.bold)}
              onClick={() => toggle('bold', 'Bold', 'home.font.bold')}
            />
            <ToolbarButton
              label="Italic"
              glyph={<em>I</em>}
              {...locked}
              active={Boolean(style.italic)}
              onClick={() => toggle('italic', 'Italic', 'home.font.italic')}
            />
            <ToolbarButton
              label="Underline"
              glyph={<u>U</u>}
              {...locked}
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
              {...locked}
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
              {...locked}
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
              width={84}
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
        </RibbonColumn>
      </CollapsibleGroup>

      <CollapsibleGroup label="Alignment" icon="align-left" onLaunch={launch('alignment')} launchLabel="Format Cells: Alignment">
        <RibbonColumn>
          <RibbonRow>
            <ToolbarButton
              label="Top Align"
              glyph="⬒"
              {...locked}
              active={style.verticalAlignment === 'top'}
              onClick={() => apply({ verticalAlignment: 'top' }, 'Top Align', 'home.alignment.top')}
            />
            <ToolbarButton
              label="Middle Align"
              glyph="⬓"
              {...locked}
              active={style.verticalAlignment === 'middle'}
              onClick={() => apply({ verticalAlignment: 'middle' }, 'Middle Align', 'home.alignment.middle')}
            />
            <ToolbarButton
              label="Bottom Align"
              glyph="⬔"
              {...locked}
              active={style.verticalAlignment === 'bottom'}
              onClick={() => apply({ verticalAlignment: 'bottom' }, 'Bottom Align', 'home.alignment.bottom')}
            />
            <RibbonMenu
              label="Orientation"
              caption="ab"
              glyph="↗"
              {...locked}
              items={[
                ...ORIENTATIONS.map((orientation) => ({
                  label: orientation.label,
                  glyph: orientation.glyph,
                  checked: style.textRotation === orientation.degrees,
                  onSelect: () =>
                    apply(
                      // Choosing the orientation already in effect turns it off, as in Excel.
                      { textRotation: style.textRotation === orientation.degrees ? undefined : orientation.degrees },
                      orientation.label,
                      'home.alignment.orientation',
                    ),
                })),
                {
                  label: 'Vertical Text',
                  glyph: '⇣',
                  disabled: true,
                  disabledReason: 'stacked letters are not in this build — use Rotate Text Up or Down',
                },
              ]}
            />
            <ToolbarButton
              label="Wrap Text"
              glyph="↵"
              size="wide"
              {...locked}
              active={Boolean(style.wrapText)}
              onClick={() => apply({ wrapText: style.wrapText ? undefined : true }, 'Wrap Text', 'home.alignment.wrap')}
            />
          </RibbonRow>
          <RibbonRow>
            <ToolbarButton
              label="Align Left"
              icon="align-left"
              {...locked}
              active={style.horizontalAlignment === 'left'}
              onClick={() => apply({ horizontalAlignment: 'left' }, 'Align Left', 'home.alignment.left')}
            />
            <ToolbarButton
              label="Center"
              icon="align-center"
              {...locked}
              active={style.horizontalAlignment === 'center'}
              onClick={() => apply({ horizontalAlignment: 'center' }, 'Center', 'home.alignment.center')}
            />
            <ToolbarButton
              label="Align Right"
              icon="align-right"
              {...locked}
              active={style.horizontalAlignment === 'right'}
              onClick={() => apply({ horizontalAlignment: 'right' }, 'Align Right', 'home.alignment.right')}
            />
            <ToolbarButton
              label="Decrease Indent"
              icon="indent-decrease"
              disabled={readOnly || indent === 0}
              disabledReason={protectedReason ?? 'the cell is not indented'}
              onClick={() =>
                apply({ indent: indent > 1 ? indent - 1 : undefined }, 'Decrease Indent', 'home.alignment.decreaseIndent')
              }
            />
            <ToolbarButton
              label="Increase Indent"
              icon="indent-increase"
              disabled={readOnly || indent >= MAX_INDENT}
              disabledReason={protectedReason ?? 'the cell is at the deepest indent'}
              onClick={() => apply({ indent: indent + 1 }, 'Increase Indent', 'home.alignment.increaseIndent')}
            />
            <ToolbarButton
              label={merged ? 'Unmerge Cells' : 'Merge & Center'}
              glyph="⬌"
              size="wide"
              {...locked}
              active={merged}
              onClick={() => (merged ? store.unmergeSelection() : merge('center'))}
            />
            <RibbonMenu
              label="Merge options"
              size="arrow"
              {...locked}
              items={[
                { label: 'Merge & Center', glyph: '⬌', disabled: merged, disabledReason: 'these cells are already merged', onSelect: () => merge('center') },
                { label: 'Merge Across', glyph: '⬍', disabled: merged, disabledReason: 'these cells are already merged', onSelect: () => merge('across') },
                { label: 'Merge Cells', glyph: '⊞', disabled: merged, disabledReason: 'these cells are already merged', onSelect: () => merge('cells') },
                { label: 'Unmerge Cells', glyph: '⊟', disabled: !merged, disabledReason: 'the cell is not merged', onSelect: () => store.unmergeSelection() },
              ]}
            />
          </RibbonRow>
        </RibbonColumn>
      </CollapsibleGroup>

      <CollapsibleGroup label="Number" glyph="%" onLaunch={launch('number')} launchLabel="Format Cells: Number">
        <RibbonColumn>
          <RibbonRow>
            <SelectMenu
              label="Number Format"
              value={style.numberFormat ?? NUMBER_FORMATS.general}
              options={NUMBER_FORMAT_OPTIONS}
              width={128}
              disabled={readOnly}
              onChange={(format) =>
                apply({ numberFormat: format }, 'Number Format', 'home.number.format')
              }
            />
          </RibbonRow>
          <RibbonRow>
            <ToolbarButton
              label="Accounting Number Format"
              glyph="₹"
              {...locked}
              active={ACCOUNTING_FORMATS.some((item) => item.format === style.numberFormat)}
              onClick={() =>
                apply({ numberFormat: ACCOUNTING_FORMATS[0]!.format }, 'Accounting Number Format', 'home.number.accounting')
              }
            />
            <RibbonMenu
              label="Accounting currencies"
              size="arrow"
              {...locked}
              items={ACCOUNTING_FORMATS.map((item) => ({
                label: item.label,
                checked: style.numberFormat === item.format,
                onSelect: () => apply({ numberFormat: item.format }, 'Accounting Number Format', 'home.number.accounting'),
              }))}
            />
            <ToolbarButton
              label="Percent Style"
              glyph="%"
              {...locked}
              active={style.numberFormat === NUMBER_FORMATS.percent}
              onClick={() => apply({ numberFormat: NUMBER_FORMATS.percent }, 'Percent Style', 'home.number.percent')}
            />
            <ToolbarButton
              label="Comma Style"
              glyph=","
              {...locked}
              active={style.numberFormat === NUMBER_FORMATS.thousands}
              onClick={() => apply({ numberFormat: NUMBER_FORMATS.thousands }, 'Comma Style', 'home.number.comma')}
            />
            <ToolbarButton
              label="Increase Decimal"
              glyph=".0→"
              {...locked}
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
              {...locked}
              onClick={() =>
                apply(
                  { numberFormat: withDecimals(style.numberFormat, -1) },
                  'Decrease Decimal',
                  'home.number.decreaseDecimal',
                )
              }
            />
          </RibbonRow>
        </RibbonColumn>
      </CollapsibleGroup>

      <CollapsibleGroup label="Styles" glyph="▣">
        <RibbonRow>
          <ToolbarButton
            label="Conditional Formatting"
            glyph="▤"
            size="large"
            className={styles.largeWide}
            disabled
            disabledReason={NO_CONDITIONAL_FORMATS}
          />
          <ToolbarButton label="Format as Table" glyph="▦" size="large" disabled disabledReason={NO_TABLES} />
          <RibbonMenu
            label="Cell Styles"
            glyph="▣"
            size="large"
            {...locked}
            content={(close) => (
              <div className={styles.menu} role="menu" aria-label="Cell Styles">
                {CELL_STYLES.map((group) => (
                  <div key={group.group}>
                    <div className={styles.menuHeading}>{group.group}</div>
                    <div className={styles.styleGallery}>
                      {group.styles.map((preset) => (
                        <button
                          key={preset.name}
                          type="button"
                          role="menuitem"
                          className={styles.styleSwatch}
                          style={swatchCss(preset.style)}
                          title={preset.name}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => {
                            close();
                            apply(preset.style, `Cell Style: ${preset.name}`, 'home.styles.cellStyles');
                          }}
                        >
                          {preset.name}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          />
        </RibbonRow>
      </CollapsibleGroup>

      <CollapsibleGroup label="Cells" glyph="▦">
        <RibbonRow>
          {/*
            Insert and Delete keep Sheet Rows and Sheet Columns apart rather than
            guessing from the selection, because the two do different things to
            the sheet and a candidate is asked for one or the other by name.
          */}
          <RibbonMenu
            label="Insert"
            glyph="⊕"
            size="large"
            {...locked}
            items={[
              {
                label: 'Insert Cells…',
                glyph: '⊞',
                disabled: true,
                disabledReason: 'shifting part of a row or column is not in this build — insert whole rows or columns',
              },
              {
                label: 'Insert Sheet Rows',
                glyph: '⇟',
                onSelect: () =>
                  store.editStructure(
                    { axis: 'row', at: active.row, delta: selectedRows },
                    'Insert Sheet Rows',
                    'home.cells.insertRows',
                  ),
              },
              {
                label: 'Insert Sheet Columns',
                glyph: '⇥',
                onSelect: () =>
                  store.editStructure(
                    { axis: 'column', at: active.col, delta: selectedColumns },
                    'Insert Sheet Columns',
                    'home.cells.insertColumns',
                  ),
              },
              'separator',
              { label: 'Insert Sheet', glyph: '⊕', onSelect: () => store.addSheet() },
            ]}
          />
          <RibbonMenu
            label="Delete"
            glyph="⊖"
            size="large"
            {...locked}
            items={[
              {
                label: 'Delete Cells…',
                glyph: '⊟',
                disabled: true,
                disabledReason: 'shifting part of a row or column is not in this build — delete whole rows or columns',
              },
              {
                label: 'Delete Sheet Rows',
                glyph: '⇞',
                onSelect: () =>
                  store.editStructure(
                    { axis: 'row', at: active.row, delta: -selectedRows },
                    'Delete Sheet Rows',
                    'home.cells.deleteRows',
                  ),
              },
              {
                label: 'Delete Sheet Columns',
                glyph: '⇤',
                onSelect: () =>
                  store.editStructure(
                    { axis: 'column', at: active.col, delta: -selectedColumns },
                    'Delete Sheet Columns',
                    'home.cells.deleteColumns',
                  ),
              },
              'separator',
              {
                label: 'Delete Sheet',
                glyph: '✕',
                disabled: visibleSheets <= 1,
                disabledReason: 'a workbook must keep one sheet in view',
                onSelect: () => store.removeSheet(store.workbook.activeSheetId),
              },
            ]}
          />
          <RibbonMenu
            label="Format"
            glyph="▤"
            size="large"
            {...locked}
            content={(close) => <FormatPanel store={store} range={selectedRange} close={close} />}
          />
        </RibbonRow>
      </CollapsibleGroup>

      <CollapsibleGroup label="Editing" glyph="Σ">
        <RibbonRow>
          <RibbonColumn>
            <RibbonRow>
              <ToolbarButton label="AutoSum" size="wide" glyph="Σ" {...locked} onClick={() => autoSum('SUM')} />
              <RibbonMenu
                label="More functions"
                size="arrow"
                {...locked}
                items={[
                  { label: 'Sum', glyph: 'Σ', onSelect: () => autoSum('SUM') },
                  { label: 'Average', glyph: 'x̄', onSelect: () => autoSum('AVERAGE') },
                  { label: 'Count Numbers', glyph: '#', onSelect: () => autoSum('COUNT') },
                  { label: 'Max', glyph: '⤒', onSelect: () => autoSum('MAX') },
                  { label: 'Min', glyph: '⤓', onSelect: () => autoSum('MIN') },
                ]}
              />
            </RibbonRow>
            <RibbonMenu
              label="Fill"
              glyph="⬇"
              {...locked}
              items={(['down', 'right', 'up', 'left'] as const).map((direction) => ({
                label: direction[0]!.toUpperCase() + direction.slice(1),
                glyph: { down: '↓', right: '→', up: '↑', left: '←' }[direction],
                onSelect: () => {
                  if (!store.fill(direction)) setNotice(`There is nothing ${FILL_FROM[direction]} the selection to fill ${direction} from.`);
                },
              }))}
            />
            <RibbonMenu
              label="Clear"
              icon="clear-format"
              {...locked}
              items={[
                { label: 'Clear All', glyph: '⌧', onSelect: () => store.clearAll() },
                { label: 'Clear Formats', glyph: '🖌', onSelect: () => store.clearFormats() },
                { label: 'Clear Contents', glyph: '⌫', onSelect: () => store.clearContents('ribbon') },
              ]}
            />
          </RibbonColumn>
          <RibbonMenu
            label="Sort & Filter"
            glyph="⇅"
            size="large"
            {...locked}
            items={[
              { label: 'Sort A to Z', glyph: '↓', onSelect: () => sort('asc') },
              { label: 'Sort Z to A', glyph: '↑', onSelect: () => sort('desc') },
              {
                label: 'Custom Sort…',
                glyph: '⇅',
                disabled: true,
                disabledReason: 'sorting by several keys is not in this build — sort by the first column',
              },
              'separator',
              {
                label: 'Filter',
                glyph: '⊽',
                checked: Boolean(autoFilter),
                onSelect: () => {
                  const reason = store.toggleAutoFilter();
                  if (reason) setNotice(`A filter could not be added: ${reason}.`);
                },
              },
              {
                label: 'Clear',
                glyph: '✕',
                disabled: !autoFilter || Object.keys(autoFilter.columns).length === 0,
                disabledReason: 'no column is filtered',
                onSelect: () => store.clearFilters(),
              },
              {
                label: 'Reapply',
                glyph: '↻',
                disabled: !autoFilter,
                disabledReason: 'there is no filter to reapply',
                onSelect: () => store.reapplyFilter(),
              },
            ]}
          />
          <RibbonMenu
            label="Find & Select"
            icon="find"
            size="large"
            align="end"
            content={(close) => <FindSelectPanel store={store} readOnly={readOnly} close={close} />}
          />
        </RibbonRow>
      </CollapsibleGroup>
    </div>
  );
}

/** Where Fill takes its first line from, for the message when there is none. */
const FILL_FROM = { down: 'above', right: 'to the left of', up: 'below', left: 'to the right of' } as const;

/* -- Format (Cells group) ------------------------------------------------ */

type FormatMode = 'menu' | 'rowHeight' | 'columnWidth' | 'rename';

/**
 * Home > Format: cell size, visibility and the sheet.
 *
 * A panel rather than a plain menu, because Row Height, Column Width and Rename
 * Sheet each ask one question first — Excel's small dialogs, shown in place.
 */
function FormatPanel({
  store,
  range,
  close,
}: {
  store: WorkbookStore;
  range: RangeAddress | undefined;
  close: () => void;
}) {
  const [mode, setMode] = useState<FormatMode>('menu');
  const sheet = store.activeSheet();
  const active = store.selection.getActive();

  const rows = indicesOf(range?.start.row ?? active.row, range?.end.row ?? active.row);
  const columns = indicesOf(range?.start.col ?? active.col, range?.end.col ?? active.col);
  const hiddenSheets = store.hiddenSheets();

  const anyHidden = (axis: 'row' | 'column'): boolean =>
    (axis === 'row' ? rows : columns).some((index) =>
      Boolean((axis === 'row' ? sheet.rows : sheet.columns).get(index)?.hidden),
    );

  if (mode === 'rowHeight' || mode === 'columnWidth') {
    const isRow = mode === 'rowHeight';
    return (
      <ValueForm
        label={isRow ? 'Row height' : 'Column width'}
        type="number"
        initial={String(isRow ? sheet.rowHeight(active.row) : sheet.columnWidth(active.col))}
        hint="pixels"
        onCancel={close}
        onSubmit={(raw) => {
          const value = Number(raw);
          if (!Number.isFinite(value) || value < 0 || value > 2000) return 'Enter a size between 0 and 2000.';
          store.resize(
            isRow ? 'row' : 'column',
            isRow ? rows : columns,
            value,
            isRow ? 'Row Height' : 'Column Width',
            isRow ? 'home.cells.format.rowHeight' : 'home.cells.format.columnWidth',
          );
          close();
          return null;
        }}
      />
    );
  }

  if (mode === 'rename') {
    return (
      <ValueForm
        label="Sheet name"
        type="text"
        initial={sheet.name}
        onCancel={close}
        onSubmit={(name) => {
          if (!store.renameSheet(sheet.id, name.trim())) {
            return 'That name is empty, too long, uses a character Excel forbids, or is already taken.';
          }
          close();
          return null;
        }}
      />
    );
  }

  const entries: RibbonMenuEntry[] = [
    { heading: 'Cell Size' },
    { label: 'Row Height…', glyph: '↕', onSelect: () => setMode('rowHeight') },
    {
      label: 'AutoFit Row Height',
      glyph: '⇕',
      onSelect: () =>
        store.resize('row', rows, (row) => autoFitRowHeight(store, row), 'AutoFit Row Height', 'home.cells.format.autoFitRows'),
    },
    { label: 'Column Width…', glyph: '↔', onSelect: () => setMode('columnWidth') },
    {
      label: 'AutoFit Column Width',
      glyph: '⇔',
      onSelect: () =>
        store.resize(
          'column',
          columns,
          (col) => autoFitColumnWidth(store, col),
          'AutoFit Column Width',
          'home.cells.format.autoFitColumns',
        ),
    },
    {
      label: 'Standard Width',
      glyph: '↦',
      onSelect: () =>
        store.resize('column', columns, DEFAULT_COLUMN_WIDTH, 'Standard Width', 'home.cells.format.standardWidth'),
    },
    { heading: 'Visibility' },
    { label: 'Hide Rows', glyph: '⊼', onSelect: () => store.setHidden('row', rows, true) },
    { label: 'Hide Columns', glyph: '⊼', onSelect: () => store.setHidden('column', columns, true) },
    {
      label: 'Unhide Rows',
      glyph: '⊻',
      disabled: !anyHidden('row'),
      disabledReason: 'select the rows on either side of the hidden ones',
      onSelect: () => store.setHidden('row', rows, false),
    },
    {
      label: 'Unhide Columns',
      glyph: '⊻',
      disabled: !anyHidden('column'),
      disabledReason: 'select the columns on either side of the hidden ones',
      onSelect: () => store.setHidden('column', columns, false),
    },
    {
      label: 'Hide Sheet',
      glyph: '👁',
      disabled: store.workbook.visibleSheets().length <= 1,
      disabledReason: 'a workbook must keep one sheet in view',
      onSelect: () => store.setSheetVisible(sheet.id, false),
    },
    ...hiddenSheets.map((hidden) => ({
      label: `Unhide Sheet: ${hidden.name}`,
      glyph: '👁',
      onSelect: () => store.setSheetVisible(hidden.id, true),
    })),
    { heading: 'Organize Sheets' },
    { label: 'Rename Sheet', glyph: '✎', onSelect: () => setMode('rename') },
  ];

  return (
    <div className={styles.menu} role="menu" aria-label="Format">
      {entries.map((entry, index) => {
        if (entry === 'separator') return <div key={index} className={styles.menuSeparator} role="separator" />;
        if ('heading' in entry) {
          return (
            <div key={entry.heading} className={styles.menuHeading}>
              {entry.heading}
            </div>
          );
        }
        // The size and rename entries switch the panel instead of closing it.
        const keepsOpen = entry.label.endsWith('…') || entry.label === 'Rename Sheet';
        return (
          <button
            key={entry.label}
            type="button"
            role="menuitem"
            className={styles.menuItem}
            disabled={entry.disabled}
            title={entry.disabled && entry.disabledReason ? `${entry.label} — ${entry.disabledReason}` : entry.label}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              if (!keepsOpen) close();
              entry.onSelect?.();
            }}
          >
            <span className={styles.menuGlyph} aria-hidden="true">
              {entry.glyph}
            </span>
            {entry.label}
          </button>
        );
      })}
    </div>
  );
}

/** One labelled field with OK and Cancel: Excel's Row Height dialog, in a menu. */
function ValueForm({
  label,
  type,
  initial,
  hint,
  onSubmit,
  onCancel,
}: {
  label: string;
  type: 'text' | 'number';
  initial: string;
  hint?: string;
  /** Returns an error to show, or null when the value was taken. */
  onSubmit: (value: string) => string | null;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    setError(onSubmit(value));
  };

  return (
    <form className={styles.menuForm} onSubmit={submit} aria-label={label}>
      <label className={styles.menuField}>
        <span>{label}</span>
        <input
          type={type}
          value={value}
          autoComplete="off"
          // Focused on open, so the value can be typed straight away as in Excel's dialog.
          autoFocus
          min={type === 'number' ? 0 : undefined}
          onChange={(event) => setValue(event.target.value)}
        />
      </label>
      {hint ? <p className={styles.menuStatus}>In {hint}.</p> : null}
      {error ? (
        <p className={styles.menuStatus} role="alert">
          {error}
        </p>
      ) : null}
      <div className={styles.menuActions}>
        <button type="submit">OK</button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

/* -- Find & Select ------------------------------------------------------- */

type FindMode = 'menu' | 'find' | 'replace';

function FindSelectPanel({ store, readOnly, close }: { store: WorkbookStore; readOnly: boolean; close: () => void }) {
  const [mode, setMode] = useState<FindMode>('menu');
  const [query, setQuery] = useState('');
  const [replacement, setReplacement] = useState('');
  const [options, setOptions] = useState<FindOptions>({ matchCase: false, entireCell: false });
  const [status, setStatus] = useState('');

  if (mode === 'menu') {
    const goTo = (): void => {
      close();
      document.querySelector<HTMLInputElement>('input[aria-label="Name Box"]')?.select();
    };

    return (
      <div className={styles.menu} role="menu" aria-label="Find & Select">
        <button type="button" role="menuitem" className={styles.menuItem} onClick={() => setMode('find')}>
          <span className={styles.menuGlyph} aria-hidden="true">⌕</span>
          Find…
        </button>
        <button
          type="button"
          role="menuitem"
          className={styles.menuItem}
          disabled={readOnly}
          title={readOnly ? 'Replace… — the sheet is protected' : 'Replace…'}
          onClick={() => setMode('replace')}
        >
          <span className={styles.menuGlyph} aria-hidden="true">⇄</span>
          Replace…
        </button>
        <button type="button" role="menuitem" className={styles.menuItem} onClick={goTo}>
          <span className={styles.menuGlyph} aria-hidden="true">→</span>
          Go To…
        </button>
      </div>
    );
  }

  const findNext = (): void => {
    const found = store.findNext(query, options);
    setStatus(found ? '' : `Excel cannot find “${query}”.`);
  };

  return (
    <form
      className={styles.menuForm}
      aria-label={mode === 'find' ? 'Find' : 'Find and Replace'}
      onSubmit={(event) => {
        event.preventDefault();
        findNext();
      }}
    >
      <label className={styles.menuField}>
        <span>Find what</span>
        <input
          type="text"
          value={query}
          autoFocus
          // The browser's saved-entry suggestions would drop over the buttons.
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      {mode === 'replace' ? (
        <label className={styles.menuField}>
          <span>Replace with</span>
          <input
            type="text"
            value={replacement}
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => setReplacement(event.target.value)}
          />
        </label>
      ) : null}
      <label className={styles.menuCheck}>
        <input
          type="checkbox"
          checked={options.matchCase}
          onChange={(event) => setOptions({ ...options, matchCase: event.target.checked })}
        />
        Match case
      </label>
      <label className={styles.menuCheck}>
        <input
          type="checkbox"
          checked={options.entireCell}
          onChange={(event) => setOptions({ ...options, entireCell: event.target.checked })}
        />
        Match entire cell contents
      </label>
      <p className={styles.menuStatus} role="status">
        {status}
      </p>
      <div className={styles.menuActions}>
        {mode === 'replace' ? (
          <>
            <button
              type="button"
              disabled={query === ''}
              onClick={() => {
                const count = store.replaceAll(query, replacement, options);
                setStatus(count === 0 ? `Excel cannot find “${query}”.` : `All done. ${count} replacement${count === 1 ? '' : 's'} made.`);
              }}
            >
              Replace All
            </button>
            <button
              type="button"
              disabled={query === ''}
              onClick={() => {
                if (!store.replaceNext(query, replacement, options) && store.findAll(query, options).length === 0) {
                  setStatus(`Excel cannot find “${query}”.`);
                } else {
                  setStatus('');
                }
              }}
            >
              Replace
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={query === ''}
            onClick={() => {
              const count = store.findAll(query, options).length;
              if (count > 0) findNext();
              setStatus(count === 0 ? `Excel cannot find “${query}”.` : `${count} cell${count === 1 ? '' : 's'} found.`);
            }}
          >
            Find All
          </button>
        )}
        <button type="submit" disabled={query === ''}>
          Find Next
        </button>
        <button type="button" onClick={close}>
          Close
        </button>
      </div>
    </form>
  );
}

/* -- Helpers ------------------------------------------------------------- */

function indicesOf(first: number, last: number): number[] {
  const indices: number[] = [];
  for (let index = first; index <= last; index += 1) indices.push(index);
  return indices;
}

/**
 * The next size up or down Excel's Font Size list, as Increase and Decrease
 * Font Size step. Past the list's ends the size moves by ten points, or by one
 * below the smallest entry.
 */
export function stepFontSize(current: number, direction: 1 | -1): number {
  if (direction > 0) {
    return FONT_SIZES.find((size) => size > current) ?? Math.min(409, Math.floor(current / 10) * 10 + 10);
  }
  const smaller = [...FONT_SIZES].reverse().find((size) => size < current);
  if (smaller !== undefined) return smaller;
  return Math.max(1, Math.ceil(current) - 1);
}

/** How a Cell Styles swatch previews its preset. */
function swatchCss(style: Partial<CellStyle>): CSSProperties {
  const css: CSSProperties = {};
  if (style.fillColor) css.background = style.fillColor;
  if (style.fontColor) css.color = style.fontColor;
  if (style.bold) css.fontWeight = 700;
  if (style.italic) css.fontStyle = 'italic';
  if (style.fontSize) css.fontSize = `${Math.min(style.fontSize, 15)}px`;
  const bottom = style.borders?.bottom;
  if (bottom) {
    css.borderBottom = `${bottom.style === 'thin' ? 1 : 3}px ${bottom.style === 'double' ? 'double' : 'solid'} ${bottom.color}`;
  }
  return css;
}

/**
 * The borders one cell gets, given the preset and where it sits in the range.
 *
 * `outline` is the reason this takes a position at all: Excel's Outside Borders
 * draws the edge of the selection, so an interior cell gets nothing. The
 * double, thick and top-and-bottom presets are drawn on the selection's edges
 * the same way.
 */
export function bordersAt(
  preset: string,
  cell: { row: number; col: number },
  range: RangeAddress,
): CellBorders | undefined {
  const top = cell.row === range.start.row;
  const bottom = cell.row === range.end.row;

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
    case 'outline':
    case 'thickOutline': {
      const edge = preset === 'outline' ? THIN_BLACK : THICK_BLACK;
      const borders: CellBorders = {};
      if (top) borders.top = edge;
      if (bottom) borders.bottom = edge;
      if (cell.col === range.start.col) borders.left = edge;
      if (cell.col === range.end.col) borders.right = edge;
      return Object.keys(borders).length > 0 ? borders : undefined;
    }
    case 'bottomDouble':
      return bottom ? { bottom: DOUBLE_BLACK } : undefined;
    case 'thickBottom':
      return bottom ? { bottom: THICK_BLACK } : undefined;
    case 'topBottom':
    case 'topThickBottom':
    case 'topDoubleBottom': {
      const lower = preset === 'topBottom' ? THIN_BLACK : preset === 'topThickBottom' ? THICK_BLACK : DOUBLE_BLACK;
      const borders: CellBorders = {};
      if (top) borders.top = THIN_BLACK;
      if (bottom) borders.bottom = lower;
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
  const match = NUMERIC_CODE.exec(current);

  if (!match) {
    // General with one more decimal is `0.0`, which is what Excel does too.
    return delta > 0 ? '0.0' : NUMBER_FORMATS.general;
  }

  const [, currency = '', base = '0', decimals = '', percent = ''] = match;
  const places = Math.max(0, Math.min(10, decimals.length + delta));
  const fraction = places === 0 ? '' : `.${'0'.repeat(places)}`;

  return `${currency}${base}${fraction}${percent}`;
}
