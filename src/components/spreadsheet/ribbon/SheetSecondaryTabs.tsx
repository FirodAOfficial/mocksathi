'use client';

import { useState } from 'react';
import { Popover } from '@/components/controls/Popover';
import { SelectMenu } from '@/components/controls/SelectMenu';
import { ToolbarButton } from '@/components/controls/ToolbarButton';
import { RibbonColumn, RibbonGroup, RibbonRow } from '@/components/ribbon/RibbonGroup';
import { GRID_ELEMENT_ID } from '@/components/spreadsheet/grid/SpreadsheetGrid';
import { GridGeometry } from '@/spreadsheet/grid/gridGeometry';
import { useSelection, useWorkbookStore, useWorkbookVersion } from '@/spreadsheet/useWorkbook';
import { SHEET_ZOOM_LEVELS, useSpreadsheetUiStore } from '@/state/spreadsheetUiStore';
import styles from './SpreadsheetRibbon.module.css';

/**
 * The tabs beside Home.
 *
 * The groups and the control names are Excel's, in Excel's order, because half
 * of what a practical paper tests is knowing where a command lives. What is
 * *not* Excel's is any pretence: a control is either wired to the workbook or
 * disabled with the reason why, which is the same rule the Word ribbon is held
 * to and the same rule its tests enforce.
 *
 * The reasons below are the honest ones. Most of what is missing is missing for
 * one of four causes, so they are named once and reused.
 */

/** No pagination, so nothing that describes a printed page can be honoured. */
const NO_PRINT = 'this build has no print pipeline';
/** No canvas over the grid, so nothing can be drawn on top of it. */
const NO_DRAWING = 'this build has no drawing layer';
/** One workbook, one window: no MDI, so window management has nothing to manage. */
const NO_WINDOWS = 'this build shows one workbook in one window';

/** Characters Excel's Symbol dialog is usually opened for. */
const SYMBOLS = [
  '₹', '$', '€', '£', '¥', '%', '‰', '°', '±', '×',
  '÷', '≠', '≤', '≥', '√', 'π', '∑', '∆', '≈', '∞',
  '©', '®', '™', '§', '•', '–', '—', '“', '”', '★',
];

/* ---------------------------------------------------------------------- */

export function SheetFormulasTab() {
  const store = useWorkbookStore();
  const selection = useSelection();
  useWorkbookVersion();

  const showFormulas = useSpreadsheetUiStore((state) => state.showFormulas);
  const toggleShowFormulas = useSpreadsheetUiStore((state) => state.toggleShowFormulas);
  const setNotice = useSpreadsheetUiStore((state) => state.setNotice);
  const readOnly = useSpreadsheetUiStore((state) => state.readOnly);

  const active = selection.active;
  const locked = readOnly ? 'the sheet is protected' : undefined;

  const insert = (formula: string): void => {
    store.setCellInput(active.row, active.col, formula, 'ribbon');
    void store.ensureEngine();
  };

  return (
    <div className={styles.tab}>
      <RibbonGroup label="Function Library">
        <RibbonRow>
          <ToolbarButton
            label="AutoSum"
            size="large"
            glyph="Σ"
            disabled={readOnly}
            disabledReason={locked}
            onClick={() => insert('=SUM()')}
          />
          <RibbonColumn>
            <ToolbarButton
              label="Average"
              size="wide"
              glyph="x̄"
              disabled={readOnly}
              disabledReason={locked}
              onClick={() => insert('=AVERAGE()')}
            />
            <ToolbarButton
              label="Count"
              size="wide"
              glyph="#"
              disabled={readOnly}
              disabledReason={locked}
              onClick={() => insert('=COUNT()')}
            />
          </RibbonColumn>
          <RibbonColumn>
            <ToolbarButton
              label="IF"
              size="wide"
              glyph="?"
              disabled={readOnly}
              disabledReason={locked}
              onClick={() => insert('=IF()')}
            />
            <ToolbarButton
              label="VLOOKUP"
              size="wide"
              glyph="⌕"
              disabled={readOnly}
              disabledReason={locked}
              onClick={() => insert('=VLOOKUP()')}
            />
          </RibbonColumn>
        </RibbonRow>
      </RibbonGroup>

      <RibbonGroup label="Defined Names">
        <RibbonRow>
          {/*
            A defined name has to resolve inside the calculation engine, and the
            engine's `onVariable` hook is not wired to a name table. The Name Box
            still navigates, which is the half that works.
          */}
          <ToolbarButton
            label="Define Name"
            size="large"
            glyph="ab"
            disabled
            disabledReason="named ranges are not in this build"
          />
          <ToolbarButton
            label="Use in Formula"
            size="wide"
            glyph="ƒ"
            disabled
            disabledReason="named ranges are not in this build"
          />
        </RibbonRow>
      </RibbonGroup>

      <RibbonGroup label="Formula Auditing">
        <RibbonRow>
          <RibbonColumn>
            <ToolbarButton
              label="Show Formulas"
              size="wide"
              glyph="="
              active={showFormulas}
              onClick={toggleShowFormulas}
            />
            <ToolbarButton
              label="Trace Precedents"
              size="wide"
              glyph="↰"
              disabled
              disabledReason="the dependency graph is not drawn on the sheet in this build"
            />
          </RibbonColumn>
          <ToolbarButton
            label="Calculate Now"
            size="wide"
            glyph="↻"
            onClick={() => {
              void store.ensureEngine().then((engine) => {
                setNotice(
                  engine
                    ? 'Recalculated.'
                    : 'The calculation engine could not be loaded, so formulas are not evaluated.',
                );
              });
            }}
          />
        </RibbonRow>
      </RibbonGroup>
    </div>
  );
}

/* ---------------------------------------------------------------------- */

export function SheetInsertTab() {
  const store = useWorkbookStore();
  const selection = useSelection();
  useWorkbookVersion();
  const readOnly = useSpreadsheetUiStore((state) => state.readOnly);

  const active = selection.active;
  const locked = readOnly ? 'the sheet is protected' : undefined;

  /** Appends a character to the active cell, which is what Symbol does. */
  const insertSymbol = (symbol: string): void => {
    store.setCellInput(active.row, active.col, `${store.editText(active.row, active.col)}${symbol}`, 'ribbon');
  };

  return (
    <div className={styles.tab}>
      <RibbonGroup label="Tables">
        <RibbonRow>
          <ToolbarButton
            label="PivotTable"
            size="large"
            glyph="⊞"
            disabled
            disabledReason="no pivot engine in this build"
          />
          <RibbonColumn>
            <ToolbarButton
              label="Recommended PivotTables"
              size="wide"
              glyph="⊞"
              disabled
              disabledReason="no pivot engine in this build"
            />
            <ToolbarButton
              label="Table"
              size="wide"
              glyph="▦"
              disabled
              disabledReason="structured tables and their references are not in this build"
            />
          </RibbonColumn>
        </RibbonRow>
      </RibbonGroup>

      <RibbonGroup label="Illustrations">
        <RibbonRow>
          <RibbonColumn>
            <ToolbarButton label="Pictures" size="wide" glyph="🖼" disabled disabledReason={NO_DRAWING} />
            <ToolbarButton label="Online Pictures" size="wide" glyph="🌐" disabled disabledReason={NO_DRAWING} />
          </RibbonColumn>
          <RibbonColumn>
            <ToolbarButton label="Shapes" size="wide" glyph="◇" disabled disabledReason={NO_DRAWING} />
            <ToolbarButton label="SmartArt" size="wide" glyph="⊕" disabled disabledReason={NO_DRAWING} />
          </RibbonColumn>
        </RibbonRow>
      </RibbonGroup>

      <RibbonGroup label="Add-ins">
        <RibbonColumn>
          <ToolbarButton label="Store" size="wide" glyph="🛍" disabled disabledReason="no add-in host in this build" />
          <ToolbarButton label="My Apps" size="wide" glyph="⊞" disabled disabledReason="no add-in host in this build" />
        </RibbonColumn>
      </RibbonGroup>

      <RibbonGroup label="Charts">
        <RibbonRow>
          <ToolbarButton
            label="Recommended Charts"
            size="large"
            glyph="📊"
            disabled
            disabledReason="no chart rendering in this build"
          />
          <RibbonColumn>
            <ToolbarButton label="Column Chart" size="wide" glyph="▮" disabled disabledReason="no chart rendering in this build" />
            <ToolbarButton label="Line Chart" size="wide" glyph="📈" disabled disabledReason="no chart rendering in this build" />
          </RibbonColumn>
          <RibbonColumn>
            <ToolbarButton label="Pie Chart" size="wide" glyph="◕" disabled disabledReason="no chart rendering in this build" />
            <ToolbarButton label="PivotChart" size="wide" glyph="📊" disabled disabledReason="no pivot engine in this build" />
          </RibbonColumn>
        </RibbonRow>
      </RibbonGroup>

      <RibbonGroup label="Sparklines">
        <RibbonRow>
          <ToolbarButton label="Line" size="wide" glyph="〰" disabled disabledReason="no chart rendering in this build" />
          <ToolbarButton label="Column" size="wide" glyph="▮" disabled disabledReason="no chart rendering in this build" />
          <ToolbarButton label="Win/Loss" size="wide" glyph="±" disabled disabledReason="no chart rendering in this build" />
        </RibbonRow>
      </RibbonGroup>

      <RibbonGroup label="Filters">
        <RibbonRow>
          <ToolbarButton label="Slicer" size="wide" glyph="⧉" disabled disabledReason="filtering is not in this build" />
          <ToolbarButton label="Timeline" size="wide" glyph="⏱" disabled disabledReason="filtering is not in this build" />
        </RibbonRow>
      </RibbonGroup>

      <RibbonGroup label="Links">
        <ToolbarButton
          label="Hyperlink"
          size="large"
          glyph="🔗"
          disabled
          disabledReason="a cell holds a value or a formula in this build, not a link"
        />
      </RibbonGroup>

      <RibbonGroup label="Text">
        <RibbonColumn>
          <ToolbarButton label="Text Box" size="wide" glyph="🅣" disabled disabledReason={NO_DRAWING} />
          <ToolbarButton label="Header & Footer" size="wide" glyph="▤" disabled disabledReason={NO_PRINT} />
        </RibbonColumn>
      </RibbonGroup>

      <RibbonGroup label="Symbols">
        <RibbonRow>
          {/*
            A plain button rather than `ToolbarButton`: `Popover` owns the id and
            the aria wiring for its trigger, and `ToolbarButton` does not forward
            them — without which the menu never opens for a keyboard or screen
            reader user.
          */}
          <Popover
            align="start"
            trigger={({ open, toggle, id, controls }) => (
              <button
                id={id}
                type="button"
                data-popover-trigger
                className={`${styles.menuTrigger} ${open ? styles.menuTriggerOpen : ''}`}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-controls={open ? controls : undefined}
                aria-label="Symbol"
                title={readOnly ? `Symbol — ${locked}` : 'Symbol'}
                disabled={readOnly}
                onMouseDown={(event) => event.preventDefault()}
                onClick={toggle}
              >
                <span aria-hidden="true">Ω</span>
                <span className={styles.menuCaption}>Symbol</span>
              </button>
            )}
          >
            {({ close }) => (
              <div className={styles.symbolGrid} role="menu" aria-label="Symbols">
                {SYMBOLS.map((symbol) => (
                  <button
                    key={symbol}
                    type="button"
                    role="menuitem"
                    className={styles.symbol}
                    title={`Insert ${symbol}`}
                    onClick={() => {
                      insertSymbol(symbol);
                      close();
                    }}
                  >
                    {symbol}
                  </button>
                ))}
              </div>
            )}
          </Popover>
          <ToolbarButton
            label="Equation"
            size="wide"
            glyph="√"
            disabled
            disabledReason="a cell holds text, a number or a formula in this build, not an equation"
          />
        </RibbonRow>
      </RibbonGroup>
    </div>
  );
}

/* ---------------------------------------------------------------------- */

export function SheetPageLayoutTab() {
  const store = useWorkbookStore();
  const selection = useSelection();
  useWorkbookVersion();

  const view = store.activeSheet().view;
  const hasPrintArea = store.activeSheet().printArea !== null;

  return (
    <div className={styles.tab}>
      <RibbonGroup label="Themes">
        <RibbonRow>
          <ToolbarButton
            label="Themes"
            size="large"
            glyph="Aa"
            disabled
            disabledReason="themes need a theme model this build does not have"
          />
          <RibbonColumn>
            <ToolbarButton label="Colors" size="wide" glyph="🎨" disabled disabledReason="themes need a theme model this build does not have" />
            <ToolbarButton label="Fonts" size="wide" glyph="A" disabled disabledReason="themes need a theme model this build does not have" />
            <ToolbarButton label="Effects" size="wide" glyph="◍" disabled disabledReason="themes need a theme model this build does not have" />
          </RibbonColumn>
        </RibbonRow>
      </RibbonGroup>

      <RibbonGroup label="Page Setup">
        <RibbonRow>
          <ToolbarButton label="Margins" size="large" glyph="▭" disabled disabledReason={NO_PRINT} />
          <ToolbarButton label="Orientation" size="large" glyph="⬒" disabled disabledReason={NO_PRINT} />
          <ToolbarButton label="Size" size="large" glyph="▯" disabled disabledReason={NO_PRINT} />
          {/*
            Print Area is stored and drawn even though nothing prints: it is a
            real sheet property a paper asks for, and the grid outlines it, so
            setting it does something the candidate can see.
          */}
          <RibbonColumn>
            <ToolbarButton
              label="Set Print Area"
              size="wide"
              glyph="⎙"
              active={hasPrintArea}
              onClick={() => store.setPrintArea(selection.ranges[0] ?? null)}
            />
            <ToolbarButton
              label="Clear Print Area"
              size="wide"
              glyph="⌫"
              disabled={!hasPrintArea}
              disabledReason="no print area is set"
              onClick={() => store.setPrintArea(null)}
            />
            <ToolbarButton label="Breaks" size="wide" glyph="⎯" disabled disabledReason={NO_PRINT} />
          </RibbonColumn>
          <RibbonColumn>
            <ToolbarButton label="Background" size="wide" glyph="🖼" disabled disabledReason={NO_DRAWING} />
            <ToolbarButton label="Print Titles" size="wide" glyph="▤" disabled disabledReason={NO_PRINT} />
          </RibbonColumn>
        </RibbonRow>
      </RibbonGroup>

      <RibbonGroup label="Scale to Fit">
        <RibbonColumn>
          <ToolbarButton label="Width" size="wide" glyph="↔" disabled disabledReason={NO_PRINT} />
          <ToolbarButton label="Height" size="wide" glyph="↕" disabled disabledReason={NO_PRINT} />
          <ToolbarButton label="Scale" size="wide" glyph="%" disabled disabledReason={NO_PRINT} />
        </RibbonColumn>
      </RibbonGroup>

      {/*
        The only group on this tab with anything behind it. Excel offers View and
        Print for each; only View can mean anything here, so Print is disabled
        rather than shown as a checkbox that remembers a setting nobody reads.
      */}
      <RibbonGroup label="Sheet Options">
        <RibbonRow>
          <RibbonColumn>
            <ToolbarButton
              label="Gridlines: View"
              size="wide"
              glyph="▦"
              active={view.showGridlines}
              onClick={() =>
                store.setSheetView({ showGridlines: !view.showGridlines }, 'pageLayout.sheetOptions.gridlines')
              }
            />
            <ToolbarButton label="Gridlines: Print" size="wide" glyph="⎙" disabled disabledReason={NO_PRINT} />
          </RibbonColumn>
          <RibbonColumn>
            <ToolbarButton
              label="Headings: View"
              size="wide"
              glyph="⊞"
              active={view.showHeadings}
              onClick={() =>
                store.setSheetView({ showHeadings: !view.showHeadings }, 'pageLayout.sheetOptions.headings')
              }
            />
            <ToolbarButton label="Headings: Print" size="wide" glyph="⎙" disabled disabledReason={NO_PRINT} />
          </RibbonColumn>
        </RibbonRow>
      </RibbonGroup>

      <RibbonGroup label="Arrange">
        <RibbonRow>
          <RibbonColumn>
            <ToolbarButton label="Bring Forward" size="wide" glyph="⬆" disabled disabledReason={NO_DRAWING} />
            <ToolbarButton label="Send Backward" size="wide" glyph="⬇" disabled disabledReason={NO_DRAWING} />
            <ToolbarButton label="Selection Pane" size="wide" glyph="☰" disabled disabledReason={NO_DRAWING} />
          </RibbonColumn>
          <RibbonColumn>
            <ToolbarButton label="Align" size="wide" glyph="⊟" disabled disabledReason={NO_DRAWING} />
            <ToolbarButton label="Group" size="wide" glyph="⧉" disabled disabledReason={NO_DRAWING} />
            <ToolbarButton label="Rotate" size="wide" glyph="↻" disabled disabledReason={NO_DRAWING} />
          </RibbonColumn>
        </RibbonRow>
      </RibbonGroup>
    </div>
  );
}

/* ---------------------------------------------------------------------- */

/**
 * The Data tab.
 *
 * Every command here rewrites rows in place — sorting moves them, filtering
 * hides them, removing duplicates deletes them — and the command layer has no
 * operation that shifts rows while the formulas that point at them follow. A
 * sort that left `=SUM(B3:B7)` pointing at the old positions would produce a
 * plausible, wrong number, which is the worst failure this editor has. So the
 * tab is here, where a candidate expects it, and says what is missing.
 */
export function SheetDataTab() {
  const NO_ROW_OPS = 'rewriting rows needs reference-shifting the command layer does not have yet';

  return (
    <div className={styles.tab}>
      <RibbonGroup label="Get External Data">
        <RibbonRow>
          <ToolbarButton
            label="From Text"
            size="large"
            glyph="📄"
            disabled
            disabledReason="this build opens no files — a workbook arrives with the paper"
          />
          <ToolbarButton
            label="From Web"
            size="large"
            glyph="🌐"
            disabled
            disabledReason="this build opens no external data sources"
          />
        </RibbonRow>
      </RibbonGroup>

      <RibbonGroup label="Connections">
        <RibbonColumn>
          <ToolbarButton label="Refresh All" size="wide" glyph="↻" disabled disabledReason="there are no connections to refresh" />
          <ToolbarButton label="Connections" size="wide" glyph="🔌" disabled disabledReason="there are no connections to refresh" />
        </RibbonColumn>
      </RibbonGroup>

      <RibbonGroup label="Sort &amp; Filter">
        <RibbonRow>
          <ToolbarButton label="Sort" size="large" glyph="⇅" disabled disabledReason={NO_ROW_OPS} />
          <ToolbarButton label="Filter" size="large" glyph="⊽" disabled disabledReason={NO_ROW_OPS} />
          <RibbonColumn>
            <ToolbarButton label="Clear" size="wide" glyph="✕" disabled disabledReason={NO_ROW_OPS} />
            <ToolbarButton label="Reapply" size="wide" glyph="↻" disabled disabledReason={NO_ROW_OPS} />
            <ToolbarButton label="Advanced" size="wide" glyph="⚙" disabled disabledReason={NO_ROW_OPS} />
          </RibbonColumn>
        </RibbonRow>
      </RibbonGroup>

      <RibbonGroup label="Data Tools">
        <RibbonRow>
          <RibbonColumn>
            <ToolbarButton label="Text to Columns" size="wide" glyph="⇥" disabled disabledReason={NO_ROW_OPS} />
            <ToolbarButton label="Flash Fill" size="wide" glyph="⚡" disabled disabledReason={NO_ROW_OPS} />
            <ToolbarButton label="Remove Duplicates" size="wide" glyph="⊗" disabled disabledReason={NO_ROW_OPS} />
          </RibbonColumn>
          <RibbonColumn>
            <ToolbarButton
              label="Data Validation"
              size="wide"
              glyph="✓"
              disabled
              disabledReason="a cell carries no validation rule in this build"
            />
            <ToolbarButton label="Consolidate" size="wide" glyph="⊞" disabled disabledReason={NO_ROW_OPS} />
            <ToolbarButton
              label="What-If Analysis"
              size="wide"
              glyph="?"
              disabled
              disabledReason="goal seek and scenarios are not in this build"
            />
          </RibbonColumn>
        </RibbonRow>
      </RibbonGroup>

      <RibbonGroup label="Outline">
        <RibbonRow>
          <RibbonColumn>
            <ToolbarButton label="Group" size="wide" glyph="⊞" disabled disabledReason={NO_ROW_OPS} />
            <ToolbarButton label="Ungroup" size="wide" glyph="⊟" disabled disabledReason={NO_ROW_OPS} />
          </RibbonColumn>
          <ToolbarButton label="Subtotal" size="wide" glyph="Σ" disabled disabledReason={NO_ROW_OPS} />
        </RibbonRow>
      </RibbonGroup>
    </div>
  );
}

/* ---------------------------------------------------------------------- */

export function SheetReviewTab() {
  const readOnly = useSpreadsheetUiStore((state) => state.readOnly);
  const setReadOnly = useSpreadsheetUiStore((state) => state.setReadOnly);

  const NO_COMMENTS = 'a cell holds a value or a formula in this build, not a comment';

  return (
    <div className={styles.tab}>
      <RibbonGroup label="Proofing">
        <RibbonRow>
          <ToolbarButton label="Spelling" size="large" glyph="ABC" disabled disabledReason="no dictionary in this build" />
          <ToolbarButton label="Research" size="large" glyph="📖" disabled disabledReason="no reference service in this build" />
          <ToolbarButton label="Thesaurus" size="large" glyph="📕" disabled disabledReason="no reference service in this build" />
        </RibbonRow>
      </RibbonGroup>

      <RibbonGroup label="Language">
        <ToolbarButton
          label="Translate"
          size="large"
          glyph="文"
          disabled
          disabledReason="no translation service in this build"
        />
      </RibbonGroup>

      <RibbonGroup label="Comments">
        <RibbonRow>
          <ToolbarButton label="Edit Comment" size="large" glyph="✎" disabled disabledReason={NO_COMMENTS} />
          <ToolbarButton label="Delete" size="large" glyph="✕" disabled disabledReason={NO_COMMENTS} />
          <ToolbarButton label="Previous" size="large" glyph="◀" disabled disabledReason={NO_COMMENTS} />
          <ToolbarButton label="Next" size="large" glyph="▶" disabled disabledReason={NO_COMMENTS} />
          <RibbonColumn>
            <ToolbarButton label="Show/Hide Comment" size="wide" glyph="💬" disabled disabledReason={NO_COMMENTS} />
            <ToolbarButton label="Show All Comments" size="wide" glyph="🗨" disabled disabledReason={NO_COMMENTS} />
            <ToolbarButton label="Show Ink" size="wide" glyph="✒" disabled disabledReason={NO_DRAWING} />
          </RibbonColumn>
        </RibbonRow>
      </RibbonGroup>

      {/*
        Protect Sheet is the one control here with something behind it. There is
        no password — the real feature guards a saved file, and nothing here is
        saved — but what it does do is real: the sheet stops accepting edits and
        the formatting controls go dead. The Word editor's Restrict Editing
        works the same way, for the same reason.
      */}
      <RibbonGroup label="Changes">
        <RibbonRow>
          <ToolbarButton
            label={readOnly ? 'Unprotect Sheet' : 'Protect Sheet'}
            size="large"
            glyph="🔒"
            active={readOnly}
            onClick={() => setReadOnly(!readOnly)}
          />
          <RibbonColumn>
            <ToolbarButton
              label="Protect Workbook"
              size="wide"
              glyph="🔐"
              disabled
              disabledReason="there is no saved workbook to protect — nothing here is saved"
            />
            <ToolbarButton
              label="Share Workbook"
              size="wide"
              glyph="👥"
              disabled
              disabledReason="this build has one candidate in one tab"
            />
          </RibbonColumn>
          <RibbonColumn>
            <ToolbarButton
              label="Allow Users to Edit Ranges"
              size="wide"
              glyph="🔑"
              disabled
              disabledReason="protection is whole-sheet in this build"
            />
            <ToolbarButton
              label="Track Changes"
              size="wide"
              glyph="↺"
              disabled
              disabledReason="revisions are not recorded in this build"
            />
          </RibbonColumn>
        </RibbonRow>
      </RibbonGroup>
    </div>
  );
}

/* ---------------------------------------------------------------------- */

export function SheetViewTab() {
  const store = useWorkbookStore();
  const selection = useSelection();
  useWorkbookVersion();

  const ui = useSpreadsheetUiStore();
  const [unhiding, setUnhiding] = useState(false);

  const sheetView = store.activeSheet().view;
  const frozen = store.activeSheet().frozen;
  const isFrozen = frozen.rows > 0 || frozen.columns > 0;
  const active = selection.active;
  const hidden = store.hiddenSheets();

  /**
   * Excel's Zoom to Selection: the selected range enlarged to fill the window.
   *
   * Measured off the live grid rather than kept in a store, because the number
   * that matters is how much room the sheet has right now — which changes with
   * the exam panels, the drawers and the window itself.
   */
  const zoomToSelection = (): void => {
    const scroller = document.getElementById(GRID_ELEMENT_ID);
    const range = selection.ranges[0];
    if (!scroller || !range) return;

    const geometry = new GridGeometry(store.activeSheet(), store.reach);
    const rect = geometry.rectOf(range);
    if (rect.width === 0 || rect.height === 0) return;

    ui.setZoom(Math.min(scroller.clientWidth / rect.width, scroller.clientHeight / rect.height));
  };

  return (
    <div className={styles.tab}>
      <RibbonGroup label="Workbook Views">
        <RibbonRow>
          {/* Normal is not a choice here, it is the only view — shown active so
              the tab reads truthfully rather than as three dead options. */}
          <ToolbarButton label="Normal" size="large" glyph="▦" active onClick={() => undefined} />
          <ToolbarButton label="Page Break Preview" size="large" glyph="⎯" disabled disabledReason={NO_PRINT} />
          <ToolbarButton label="Page Layout" size="large" glyph="▯" disabled disabledReason={NO_PRINT} />
          <ToolbarButton
            label="Custom Views"
            size="large"
            glyph="⊡"
            disabled
            disabledReason="there is nowhere to save a view — nothing here is saved"
          />
        </RibbonRow>
      </RibbonGroup>

      <RibbonGroup label="Show">
        <RibbonRow>
          <RibbonColumn>
            <ToolbarButton
              label="Ruler"
              size="wide"
              glyph="⌸"
              disabled
              disabledReason="Excel shows the ruler in Page Layout view, which needs a print pipeline"
            />
            <ToolbarButton
              label="Gridlines"
              size="wide"
              glyph="▦"
              active={sheetView.showGridlines}
              onClick={() =>
                store.setSheetView({ showGridlines: !sheetView.showGridlines }, 'view.show.gridlines')
              }
            />
          </RibbonColumn>
          <RibbonColumn>
            <ToolbarButton
              label="Formula Bar"
              size="wide"
              glyph="fx"
              active={ui.showFormulaBar}
              onClick={ui.toggleFormulaBar}
            />
            <ToolbarButton
              label="Headings"
              size="wide"
              glyph="⊞"
              active={sheetView.showHeadings}
              onClick={() =>
                store.setSheetView({ showHeadings: !sheetView.showHeadings }, 'view.show.headings')
              }
            />
          </RibbonColumn>
        </RibbonRow>
      </RibbonGroup>

      <RibbonGroup label="Zoom">
        <RibbonRow>
          <Popover
            align="start"
            trigger={({ open, toggle, id, controls }) => (
              <button
                id={id}
                type="button"
                data-popover-trigger
                className={`${styles.menuTrigger} ${open ? styles.menuTriggerOpen : ''}`}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-controls={open ? controls : undefined}
                aria-label="Zoom"
                title="Zoom"
                onMouseDown={(event) => event.preventDefault()}
                onClick={toggle}
              >
                <span aria-hidden="true">🔍</span>
                <span className={styles.menuCaption}>Zoom</span>
              </button>
            )}
          >
            {({ close }) => (
              <div className={styles.zoomMenu} role="menu" aria-label="Zoom level">
                {SHEET_ZOOM_LEVELS.map((level) => (
                  <button
                    key={level}
                    type="button"
                    role="menuitemradio"
                    aria-checked={Math.round(ui.zoom * 100) === Math.round(level * 100)}
                    className={styles.zoomOption}
                    onClick={() => {
                      ui.setZoom(level);
                      close();
                    }}
                  >
                    {Math.round(level * 100)}%
                  </button>
                ))}
              </div>
            )}
          </Popover>
          <ToolbarButton label="100%" size="large" glyph="1:1" onClick={() => ui.setZoom(1)} />
          <ToolbarButton label="Zoom to Selection" size="large" glyph="⤢" onClick={zoomToSelection} />
        </RibbonRow>
      </RibbonGroup>

      <RibbonGroup label="Window">
        <RibbonRow>
          <ToolbarButton label="New Window" size="large" glyph="⧉" disabled disabledReason={NO_WINDOWS} />
          <ToolbarButton label="Arrange All" size="large" glyph="▤" disabled disabledReason={NO_WINDOWS} />
          <ToolbarButton
            label={isFrozen ? 'Unfreeze Panes' : 'Freeze Panes'}
            size="large"
            glyph="❄"
            active={isFrozen}
            onClick={() => (isFrozen ? store.freezePanes(0, 0) : store.freezePanes(active.row, active.col))}
          />
          <RibbonColumn>
            <ToolbarButton
              label="Split"
              size="wide"
              glyph="⊟"
              disabled
              disabledReason="the grid has a single pane in this build"
            />
            <ToolbarButton
              label="Hide"
              size="wide"
              glyph="👁"
              disabled={store.workbook.visibleSheets().length <= 1}
              disabledReason="a workbook must keep one sheet in view"
              onClick={() => store.setSheetVisible(store.workbook.activeSheetId, false)}
            />
            <ToolbarButton
              label="Unhide"
              size="wide"
              glyph="👁"
              active={unhiding}
              disabled={hidden.length === 0}
              disabledReason="no sheet is hidden"
              onClick={() => setUnhiding((open) => !open)}
            />
          </RibbonColumn>
          <RibbonColumn>
            <ToolbarButton label="View Side by Side" size="wide" glyph="⇹" disabled disabledReason={NO_WINDOWS} />
            <ToolbarButton label="Synchronous Scrolling" size="wide" glyph="⇕" disabled disabledReason={NO_WINDOWS} />
            <ToolbarButton label="Reset Window Position" size="wide" glyph="⟲" disabled disabledReason={NO_WINDOWS} />
          </RibbonColumn>
          <ToolbarButton label="Switch Windows" size="large" glyph="⧉" disabled disabledReason={NO_WINDOWS} />
        </RibbonRow>

        {unhiding && hidden.length > 0 ? (
          <SelectMenu
            label="Unhide sheet"
            value={null}
            placeholder="Choose a sheet"
            width={150}
            options={hidden.map((sheet) => ({ value: sheet.id, label: sheet.name }))}
            onChange={(sheetId) => {
              store.setSheetVisible(sheetId, true);
              setUnhiding(false);
            }}
          />
        ) : null}
      </RibbonGroup>

      <RibbonGroup label="Macros">
        <ToolbarButton
          label="Macros"
          size="large"
          glyph="▶"
          disabled
          disabledReason="no macro engine in this build, and none is planned"
        />
      </RibbonGroup>
    </div>
  );
}
