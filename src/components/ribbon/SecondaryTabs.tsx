'use client';

import type { Editor } from '@tiptap/react';
import {
  FONT_FAMILIES,
  changeIndent,
  insertTable,
  setDocumentFont,
  setIndents,
  setParagraphSpacing,
} from '@/editor/ribbonActions';
import {
  MARGIN_PRESETS,
  PAPER_SIZES,
  ZOOM_LEVELS,
  pageSize,
  useUiStore,
  type MarginPreset,
  type PaperSize,
  type ViewMode,
} from '@/state/uiStore';
import { NumberCombo } from '../controls/NumberCombo';
import { ColorPicker } from '../controls/ColorPicker';
import { Popover } from '../controls/Popover';
import { SelectMenu } from '../controls/SelectMenu';
import { ToolbarButton } from '../controls/ToolbarButton';
import { Icon } from '../icons/Icon';
import { RibbonColumn, RibbonGroup, RibbonRow } from './RibbonGroup';
import styles from './SecondaryTabs.module.css';

/**
 * The tabs beyond Home.
 *
 * These follow Word's tab and group structure, but every control here either
 * works or is visibly disabled with the reason in its tooltip — which is what
 * Word itself does with commands that do not apply. A button that looks live
 * and quietly does nothing would be worse than either.
 *
 * What is disabled is disabled for one reason: this editor's schema has no node
 * for it. Pictures, links, headers and footers, floating shapes and equations
 * all need a node type that does not exist here, so no amount of ribbon wiring
 * would make them work.
 */

const NO_NODE = 'this build has no node type for it';

const SYMBOLS = [
  '©', '®', '™', '°', '±', '×', '÷', '≠', '≤', '≥',
  '–', '—', '“', '”', '‘', '’', '…', '•', '§', '¶',
  '€', '£', '¥', '¢', '†', '‡', '½', '¼', '¾', '→',
  'α', 'β', 'γ', 'π', 'Ω', 'µ', '∑', '√', '∞', '≈',
];

/** Points converted to the CSS pixels the model stores. */
const pt = (points: number): number => Math.round((points * 96) / 72);

/** CSS pixels back to centimetres, which is what Word's Indent boxes show. */
const toCm = (pixels: number | null | undefined): number =>
  Math.round((((pixels ?? 0) / 96) * 2.54) * 100) / 100;

const fromCm = (cm: number): number | null => (cm === 0 ? null : Math.round((cm / 2.54) * 96));

const SPACING_OPTIONS = [0, 6, 12, 18, 24].map((points) => ({
  value: points,
  label: `${points} pt`,
}));

/* ---------------------------------------------------------------------- */

export function InsertTab({ editor }: { editor: Editor }) {
  return (
    <>
      <RibbonGroup label="Pages">
        <RibbonColumn>
          <ToolbarButton label="Cover Page" icon="page" size="wide"
            disabled disabledReason={NO_NODE} />
          <ToolbarButton label="Blank Page" icon="page" size="wide"
            disabled disabledReason={NO_NODE} />
          <ToolbarButton
            label="Page Break"
            icon="page"
            size="wide"
            disabled
            disabledReason="the document is one continuous sheet, not paginated"
          />
        </RibbonColumn>
      </RibbonGroup>

      <RibbonGroup label="Tables">
        <Popover
          trigger={({ open, toggle, id, controls }) => (
            <button
              id={id}
              type="button"
              data-popover-trigger
              className={`${styles.largeMenuButton} ${open ? styles.largeMenuButtonOpen : ''}`}
              aria-haspopup="menu"
              aria-expanded={open}
              aria-controls={open ? controls : undefined}
              title="Table"
              onMouseDown={(event) => event.preventDefault()}
              onClick={toggle}
            >
              <Icon name="borders" size={24} />
              <span className={styles.largeCaption}>Table</span>
              <Icon name="chevron-down" size={12} />
            </button>
          )}
        >
          {({ close }) => (
            <TableGrid
              onPick={(rows, cols) => {
                insertTable(editor, rows, cols);
                close();
              }}
            />
          )}
        </Popover>
      </RibbonGroup>

      <RibbonGroup label="Illustrations">
        <RibbonColumn>
          <RibbonRow>
            <ToolbarButton label="Pictures" icon="page" size="wide"
            disabled disabledReason={NO_NODE} />
            <ToolbarButton label="Shapes" icon="borders" size="wide"
            disabled disabledReason={NO_NODE} />
            <ToolbarButton label="Icons" icon="borders" size="wide"
            disabled disabledReason={NO_NODE} />
          </RibbonRow>
          <RibbonRow>
            <ToolbarButton label="SmartArt" icon="borders" size="wide"
            disabled disabledReason={NO_NODE} />
            <ToolbarButton label="Chart" icon="borders" size="wide"
            disabled disabledReason={NO_NODE} />
            <ToolbarButton label="Screenshot" icon="page" size="wide"
            disabled disabledReason={NO_NODE} />
          </RibbonRow>
        </RibbonColumn>
      </RibbonGroup>

      <RibbonGroup label="Links">
        <ToolbarButton label="Link" icon="page" size="large" disabled disabledReason={NO_NODE} />
      </RibbonGroup>

      <RibbonGroup label="Header & Footer">
        <RibbonColumn>
          <ToolbarButton label="Header" icon="page" size="wide"
            disabled disabledReason={NO_NODE} />
          <ToolbarButton label="Footer" icon="page" size="wide"
            disabled disabledReason={NO_NODE} />
          <ToolbarButton label="Page Number" icon="page" size="wide"
            disabled disabledReason={NO_NODE} />
        </RibbonColumn>
      </RibbonGroup>

      <RibbonGroup label="Text">
        <RibbonColumn>
          <ToolbarButton label="Text Box" icon="borders" size="wide"
            disabled disabledReason={NO_NODE} />
          <ToolbarButton
            label="Date & Time"
            icon="page"
            size="wide"
            onClick={() =>
              editor
                .chain()
                .focus()
                .insertContent(
                  new Date().toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  }),
                )
                .run()
            }
          />
        </RibbonColumn>
      </RibbonGroup>

      <RibbonGroup label="Symbols">
        <RibbonColumn>
          <ToolbarButton label="Equation" icon="page" size="wide"
            disabled disabledReason={NO_NODE} />
          <Popover
            align="end"
            trigger={({ open, toggle, id, controls }) => (
              <button
                id={id}
                type="button"
                data-popover-trigger
                className={`${styles.menuButton} ${open ? styles.menuButtonOpen : ''}`}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-controls={open ? controls : undefined}
                title="Symbol"
                onMouseDown={(event) => event.preventDefault()}
                onClick={toggle}
              >
                <span className={styles.symbolGlyph}>Ω</span> Symbol
                <Icon name="chevron-down" size={12} />
              </button>
            )}
          >
            {({ close }) => (
              <div className={styles.symbolGrid}>
                {SYMBOLS.map((symbol) => (
                  <button
                    key={symbol}
                    type="button"
                    role="menuitem"
                    className={styles.symbolCell}
                    title={symbol}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      editor.chain().focus().insertContent(symbol).run();
                      close();
                    }}
                  >
                    {symbol}
                  </button>
                ))}
              </div>
            )}
          </Popover>
        </RibbonColumn>
      </RibbonGroup>
    </>
  );
}

/** Word's drag-a-grid table picker. */
function TableGrid({ onPick }: { onPick: (rows: number, cols: number) => void }) {
  const rows = 8;
  const cols = 10;

  return (
    <div className={styles.tableGrid}>
      {Array.from({ length: rows * cols }, (_, index) => {
        const row = Math.floor(index / cols) + 1;
        const col = (index % cols) + 1;
        return (
          <button
            key={index}
            type="button"
            role="menuitem"
            className={styles.tableCell}
            aria-label={`${row} by ${col} table`}
            title={`${row} × ${col}`}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onPick(row, col)}
          />
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------------- */

/** Word's Design tab: the document's overall look, not one paragraph's. */
export function DesignTab({ editor }: { editor: Editor }) {
  const pageColor = useUiStore((state) => state.pageColor);
  const setPageColor = useUiStore((state) => state.setPageColor);
  const watermark = useUiStore((state) => state.watermark);
  const setWatermark = useUiStore((state) => state.setWatermark);
  const pageBorder = useUiStore((state) => state.pageBorder);
  const togglePageBorder = useUiStore((state) => state.togglePageBorder);

  return (
    <>
      <RibbonGroup label="Document Formatting">
        <RibbonRow>
          <SelectMenu
            label="Fonts"
            width={150}
            value={null}
            placeholder="Fonts"
            options={FONT_FAMILIES.map((family) => ({
              value: family,
              label: family,
              optionStyle: { fontFamily: family },
            }))}
            onChange={(family) => setDocumentFont(editor, family)}
          />
          <SelectMenu
            label="Paragraph Spacing"
            width={150}
            value={null}
            placeholder="Paragraph Spacing"
            options={[
              { value: 'none', label: 'No Paragraph Space' },
              { value: 'compact', label: 'Compact' },
              { value: 'open', label: 'Open' },
              { value: 'relaxed', label: 'Relaxed' },
            ]}
            onChange={(preset) => {
              const points = { none: 0, compact: 4, open: 10, relaxed: 18 }[preset] ?? 0;
              setParagraphSpacing(editor, {
                before: points === 0 ? null : pt(points),
                after: points === 0 ? null : pt(points),
              });
            }}
          />
        </RibbonRow>
      </RibbonGroup>

      <RibbonGroup label="Page Background">
        <RibbonRow>
          <ToolbarButton
            label="Watermark"
            icon="page"
            size="large"
            active={watermark !== null}
            onClick={() => setWatermark(watermark === null ? 'Sample' : null)}
          />
          <span className={styles.stacked}>
            <span className={styles.fieldLabel}>Page Color</span>
            <ColorPicker
              label="Page Color"
              icon="highlight"
              currentColor={pageColor}
              defaultColor="#fff2cc"
              clearLabel="No Color"
              onSelect={setPageColor}
            />
          </span>
          <ToolbarButton
            label="Page Borders"
            icon="borders"
            size="large"
            active={pageBorder}
            onClick={togglePageBorder}
          />
        </RibbonRow>
      </RibbonGroup>
    </>
  );
}

/* ---------------------------------------------------------------------- */

export function LayoutTab({ editor }: { editor: Editor }) {
  const orientation = useUiStore((state) => state.orientation);
  const setOrientation = useUiStore((state) => state.setOrientation);
  const paper = useUiStore((state) => state.paper);
  const setPaper = useUiStore((state) => state.setPaper);
  const margins = useUiStore((state) => state.margins);
  const setMargins = useUiStore((state) => state.setMargins);
  const columns = useUiStore((state) => state.columns);
  const setColumns = useUiStore((state) => state.setColumns);

  const attrs = editor.getAttributes('paragraph');

  return (
    <>
      <RibbonGroup label="Page Setup">
        <RibbonColumn>
          <SelectMenu
            label="Margins"
            width={124}
            value={margins}
            options={(Object.keys(MARGIN_PRESETS) as MarginPreset[]).map((preset) => ({
              value: preset,
              label: preset.charAt(0).toUpperCase() + preset.slice(1),
            }))}
            onChange={setMargins}
          />
          <SelectMenu
            label="Orientation"
            width={124}
            value={orientation}
            options={[
              { value: 'portrait', label: 'Portrait' },
              { value: 'landscape', label: 'Landscape' },
            ]}
            onChange={setOrientation}
          />
          <SelectMenu
            label="Size"
            width={124}
            value={paper}
            options={(Object.keys(PAPER_SIZES) as PaperSize[]).map((size) => ({
              value: size,
              label: PAPER_SIZES[size].label,
            }))}
            onChange={setPaper}
          />
        </RibbonColumn>

        <RibbonColumn>
          <SelectMenu
            label="Columns"
            width={110}
            value={columns}
            options={[
              { value: 1, label: 'One' },
              { value: 2, label: 'Two' },
              { value: 3, label: 'Three' },
            ]}
            onChange={(value) => setColumns(value as 1 | 2 | 3)}
          />
          <ToolbarButton
            label="Breaks"
            icon="page"
            size="wide"
            disabled
            disabledReason="the document is one continuous sheet, not paginated"
          />
          <ToolbarButton
            label="Hyphenation"
            icon="page"
            size="wide"
            disabled
            disabledReason="no hyphenation engine in this build"
          />
        </RibbonColumn>
      </RibbonGroup>

      <RibbonGroup label="Paragraph">
        <RibbonColumn>
          <RibbonRow>
            <span className={styles.fieldLabel}>Left</span>
            <NumberCombo
              label="Indent Left"
              width={78}
              value={toCm(attrs.indentLeft as number | null)}
              options={[0, 0.5, 1, 1.27, 2, 2.54]}
              min={0}
              max={15}
              onChange={(cm) => setIndents(editor, { left: fromCm(cm) })}
            />
            <ToolbarButton label="Decrease Indent" icon="indent-decrease" onClick={() => changeIndent(editor, -1)} />
            <ToolbarButton label="Increase Indent" icon="indent-increase" onClick={() => changeIndent(editor, 1)} />
          </RibbonRow>
          <RibbonRow>
            <span className={styles.fieldLabel}>Right</span>
            <NumberCombo
              label="Indent Right"
              width={78}
              value={toCm(attrs.indentRight as number | null)}
              options={[0, 0.5, 1, 1.27, 2, 2.54]}
              min={0}
              max={15}
              onChange={(cm) => setIndents(editor, { right: fromCm(cm) })}
            />
          </RibbonRow>
        </RibbonColumn>

        <RibbonColumn>
          <RibbonRow>
            <span className={styles.fieldLabel}>Before</span>
            <SelectMenu
              label="Space Before"
              width={78}
              value={null}
              placeholder="Spacing"
              options={SPACING_OPTIONS}
              onChange={(points) => setParagraphSpacing(editor, { before: points === 0 ? null : pt(points) })}
            />
          </RibbonRow>
          <RibbonRow>
            <span className={styles.fieldLabel}>After</span>
            <SelectMenu
              label="Space After"
              width={78}
              value={null}
              placeholder="Spacing"
              options={SPACING_OPTIONS}
              onChange={(points) => setParagraphSpacing(editor, { after: points === 0 ? null : pt(points) })}
            />
          </RibbonRow>
        </RibbonColumn>
      </RibbonGroup>

      <RibbonGroup label="Arrange">
        <RibbonColumn>
          <RibbonRow>
            <ToolbarButton label="Position" icon="page" size="wide"
            disabled disabledReason={NO_NODE} />
            <ToolbarButton label="Wrap Text" icon="page" size="wide"
            disabled disabledReason={NO_NODE} />
          </RibbonRow>
          <RibbonRow>
            <ToolbarButton label="Bring Forward" icon="page" size="wide"
            disabled disabledReason={NO_NODE} />
            <ToolbarButton label="Send Backward" icon="page" size="wide"
            disabled disabledReason={NO_NODE} />
          </RibbonRow>
        </RibbonColumn>
      </RibbonGroup>
    </>
  );
}

/* ---------------------------------------------------------------------- */

export function ReviewTab({ onWordCount }: { onWordCount: () => void }) {
  const readOnly = useUiStore((state) => state.readOnly);
  const setReadOnly = useUiStore((state) => state.setReadOnly);

  return (
    <>
      <RibbonGroup label="Proofing">
        <RibbonRow>
          <ToolbarButton label="Word Count" icon="find" size="large" onClick={onWordCount} />
          <ToolbarButton
            label="Spelling & Grammar"
            icon="find"
            size="large"
            disabled
            disabledReason="no dictionary in this build"
          />
        </RibbonRow>
      </RibbonGroup>

      <RibbonGroup label="Comments">
        <ToolbarButton label="New Comment" icon="page" size="large" disabled disabledReason={NO_NODE} />
      </RibbonGroup>

      <RibbonGroup label="Tracking">
        <ToolbarButton
          label="Track Changes"
          icon="page"
          size="large"
          disabled
          disabledReason="revisions are not recorded in this build"
        />
      </RibbonGroup>

      <RibbonGroup label="Protect">
        <ToolbarButton
          label="Restrict Editing"
          icon="save"
          size="large"
          active={readOnly}
          onClick={() => setReadOnly(!readOnly)}
        />
      </RibbonGroup>
    </>
  );
}

/* ---------------------------------------------------------------------- */

const VIEWS: { value: ViewMode; label: string }[] = [
  { value: 'print', label: 'Print Layout' },
  { value: 'web', label: 'Web Layout' },
  { value: 'draft', label: 'Draft' },
];

export function ViewTab() {
  const zoom = useUiStore((state) => state.zoom);
  const setZoom = useUiStore((state) => state.setZoom);
  const showRuler = useUiStore((state) => state.showRuler);
  const toggleRuler = useUiStore((state) => state.toggleRuler);
  const showGridlines = useUiStore((state) => state.showGridlines);
  const toggleGridlines = useUiStore((state) => state.toggleGridlines);
  const viewMode = useUiStore((state) => state.viewMode);
  const setViewMode = useUiStore((state) => state.setViewMode);
  const focusMode = useUiStore((state) => state.focusMode);
  const toggleFocusMode = useUiStore((state) => state.toggleFocusMode);
  const readOnly = useUiStore((state) => state.readOnly);
  const setReadOnly = useUiStore((state) => state.setReadOnly);
  const orientation = useUiStore((state) => state.orientation);
  const paper = useUiStore((state) => state.paper);

  /** Word's Page Width: the sheet filled to the reading column. */
  const fitToWidth = (): void => {
    const available = document.querySelector('[data-page-column]')?.clientWidth;
    const { width } = pageSize(orientation, paper);
    if (available) setZoom(available / width);
  };

  return (
    <>
      <RibbonGroup label="Views">
        <RibbonColumn>
          <ToolbarButton
            label="Read Mode"
            icon="page"
            size="wide"
            active={readOnly}
            onClick={() => setReadOnly(!readOnly)}
          />
          {VIEWS.map((view) => (
            <ToolbarButton
              key={view.value}
              label={view.label}
              icon="page"
              size="wide"
              active={viewMode === view.value}
              onClick={() => setViewMode(view.value)}
            />
          ))}
        </RibbonColumn>
      </RibbonGroup>

      <RibbonGroup label="Immersive">
        <ToolbarButton
          label="Focus"
          icon="page"
          size="large"
          active={focusMode}
          onClick={toggleFocusMode}
        />
      </RibbonGroup>

      <RibbonGroup label="Show">
        <RibbonColumn>
          <ToolbarButton label="Ruler" icon="borders" size="wide"
            active={showRuler} onClick={toggleRuler} />
          <ToolbarButton label="Gridlines" icon="borders" size="wide"
            active={showGridlines} onClick={toggleGridlines} />
          <ToolbarButton
            label="Navigation Pane"
            icon="find"
            size="wide"
            disabled
            disabledReason="no outline index in this build"
          />
        </RibbonColumn>
      </RibbonGroup>

      <RibbonGroup label="Zoom">
        <RibbonColumn>
          <SelectMenu
            label="Zoom"
            width={96}
            value={zoom}
            options={ZOOM_LEVELS.map((level) => ({ value: level, label: `${Math.round(level * 100)}%` }))}
            onChange={setZoom}
          />
          <RibbonRow>
            <ToolbarButton label="100%" glyph={<span>100%</span>} onClick={() => setZoom(1)} />
            <ToolbarButton label="Page Width" icon="align-justify" size="wide" onClick={fitToWidth} />
          </RibbonRow>
        </RibbonColumn>
      </RibbonGroup>

      <RibbonGroup label="Print">
        <ToolbarButton label="Print" icon="print" size="large" onClick={() => window.print()} />
      </RibbonGroup>
    </>
  );
}

/* ---------------------------------------------------------------------- */

/**
 * Word's References, Mailings and Help tabs.
 *
 * They are present because their absence from the strip is itself confusing —
 * a candidate practising for a Word paper should find the tab where they expect
 * it — but there is nothing behind them to wire up, and saying so is better
 * than a row of grey buttons implying there nearly is.
 */
export function EmptyTab({ title, body }: { title: string; body: string }) {
  return (
    <div className={styles.emptyTab} role="note">
      <strong className={styles.emptyTitle}>{title}</strong>
      <span>{body}</span>
    </div>
  );
}
