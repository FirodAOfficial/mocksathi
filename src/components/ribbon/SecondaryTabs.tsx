'use client';

import type { Editor } from '@tiptap/react';
import { useRef, type ChangeEvent } from 'react';
import {
  FONT_FAMILIES,
  changeIndent,
  insertTable,
  setDocumentFont,
  setIndents,
  setParagraphSpacing,
} from '@/editor/ribbonActions';
import {
  checkPicture,
  insertDateTime,
  insertHorizontalLine,
  insertPicture,
  insertVectorArt,
  pictureRejectionMessage,
  readPictureDataUrl,
  PICTURE_TYPES,
} from '@/editor/insertActions';
import { ICONS, SHAPES, type VectorArt } from '@/editor/vectorArt';
import { INK_COLOURS, PEN_WIDTHS } from '@/editor/ink';
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
 * The reasons are specific, because they are different reasons. Some commands
 * need a page model the document does not have; some need a service this build
 * does not talk to; some need a subsystem nobody has written. Lumping them
 * under one message hid which ones were a day's work and which were a quarter's.
 */

/** Needs pagination: the document is one continuous sheet. */
const NO_PAGES = 'the document is one continuous sheet, not paginated';

/** Needs something outside the browser — a service, a store, the desktop. */
const NO_SERVICE = 'this editor talks to no outside service';

/** Needs a whole subsystem that does not exist in this build. */
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

export interface InsertTabProps {
  editor: Editor;
  /** Opens the hyperlink dialog, which the shell owns like the other dialogs. */
  onInsertLink: () => void;
}

export function InsertTab({ editor, onInsertLink }: InsertTabProps) {
  const setNotice = useUiStore((state) => state.setNotice);
  const fileRef = useRef<HTMLInputElement>(null);

  /*
   * A picture the candidate chose, read into the document as a data URL.
   *
   * There is nowhere to upload to — the answer is one JSON payload submitted
   * at the end — so the picture travels inside it. `checkPicture` runs on the
   * file's own size and type before a byte is read, so an oversized picture is
   * refused immediately instead of after the browser has base64'd it.
   */
  const onPicked = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    // Cleared straight away, so choosing the same file twice fires again.
    event.target.value = '';
    if (!file) return;

    const rejection = checkPicture(file);
    if (rejection) {
      setNotice(pictureRejectionMessage(rejection));
      return;
    }

    try {
      insertPicture(editor, await readPictureDataUrl(file), file.name);
    } catch {
      setNotice('That picture could not be read.');
    }
  };

  return (
    <>
      <RibbonGroup label="Pages">
        <RibbonColumn>
          <ToolbarButton label="Cover Page" icon="page" size="wide" disabled disabledReason={NO_PAGES} />
          <ToolbarButton label="Blank Page" icon="page" size="wide" disabled disabledReason={NO_PAGES} />
          <ToolbarButton label="Page Break" icon="page" size="wide" disabled disabledReason={NO_PAGES} />
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
            <ToolbarButton
              label="Pictures"
              icon="picture"
              size="wide"
              onClick={() => fileRef.current?.click()}
            />
            <ArtMenu label="Shapes" icon="shapes" items={SHAPES} editor={editor} columns={4} />
            <ArtMenu label="Icons" icon="icons" items={ICONS} editor={editor} columns={4} />
          </RibbonRow>
          <RibbonRow>
            <ToolbarButton label="Online Pictures" icon="picture" size="wide" disabled disabledReason={NO_SERVICE} />
            <ToolbarButton label="3D Models" icon="shapes" size="wide" disabled disabledReason={NO_NODE} />
            <ToolbarButton label="SmartArt" icon="shapes" size="wide" disabled disabledReason={NO_NODE} />
          </RibbonRow>
          <RibbonRow>
            <ToolbarButton label="Chart" icon="chart" size="wide" disabled disabledReason={NO_NODE} />
            <ToolbarButton
              label="Screenshot"
              icon="picture"
              size="wide"
              disabled
              disabledReason="a web page cannot capture the screen behind it"
            />
          </RibbonRow>

          {/*
            Outside the ribbon's reach visually, but inside the group it belongs
            to. Clicking Pictures opens it; it is never shown, because a styled
            file input is a worse file input than the platform's own.
          */}
          <input
            ref={fileRef}
            type="file"
            accept={PICTURE_TYPES.join(',')}
            className={styles.hiddenFile}
            onChange={onPicked}
          />
        </RibbonColumn>
      </RibbonGroup>

      <RibbonGroup label="Add-ins">
        <RibbonColumn>
          <ToolbarButton label="Get Add-ins" icon="add-ins" size="wide" disabled disabledReason={NO_SERVICE} />
          <ToolbarButton label="My Add-ins" icon="add-ins" size="wide" disabled disabledReason={NO_SERVICE} />
          <ToolbarButton label="Wikipedia" icon="add-ins" size="wide" disabled disabledReason={NO_SERVICE} />
        </RibbonColumn>
      </RibbonGroup>

      <RibbonGroup label="Media">
        <ToolbarButton label="Online Video" icon="video" size="large" disabled disabledReason={NO_SERVICE} />
      </RibbonGroup>

      <RibbonGroup label="Links">
        <RibbonColumn>
          <ToolbarButton label="Link" icon="link" size="wide" onClick={onInsertLink} />
          <ToolbarButton
            label="Bookmark"
            icon="link"
            size="wide"
            disabled
            disabledReason="there is nowhere in the document to jump to"
          />
          <ToolbarButton label="Cross-reference" icon="link" size="wide" disabled disabledReason={NO_NODE} />
        </RibbonColumn>
      </RibbonGroup>

      <RibbonGroup label="Comments">
        <ToolbarButton
          label="Comment"
          icon="comment"
          size="large"
          disabled
          disabledReason="a paper is marked, not reviewed, so there are no comment threads"
        />
      </RibbonGroup>

      <RibbonGroup label="Header &amp; Footer">
        <RibbonColumn>
          <ToolbarButton label="Header" icon="page" size="wide" disabled disabledReason={NO_PAGES} />
          <ToolbarButton label="Footer" icon="page" size="wide" disabled disabledReason={NO_PAGES} />
          <ToolbarButton label="Page Number" icon="page" size="wide" disabled disabledReason={NO_PAGES} />
        </RibbonColumn>
      </RibbonGroup>

      <RibbonGroup label="Text">
        <RibbonColumn>
          <RibbonRow>
            <ToolbarButton label="Text Box" icon="borders" size="wide" disabled disabledReason={NO_NODE} />
            <ToolbarButton label="Quick Parts" icon="page" size="wide" disabled disabledReason={NO_NODE} />
          </RibbonRow>
          <RibbonRow>
            <ToolbarButton label="WordArt" icon="page" size="wide" disabled disabledReason={NO_NODE} />
            <ToolbarButton label="Drop Cap" icon="page" size="wide" disabled disabledReason={NO_NODE} />
          </RibbonRow>
          <RibbonRow>
            <ToolbarButton label="Date &amp; Time" icon="page" size="wide" onClick={() => insertDateTime(editor)} />
            <ToolbarButton
              label="Horizontal Line"
              icon="horizontal-rule"
              size="wide"
              onClick={() => insertHorizontalLine(editor)}
            />
          </RibbonRow>
          <RibbonRow>
            <ToolbarButton label="Signature Line" icon="page" size="wide" disabled disabledReason={NO_NODE} />
            <ToolbarButton label="Object" icon="page" size="wide" disabled disabledReason={NO_NODE} />
          </RibbonRow>
        </RibbonColumn>
      </RibbonGroup>

      <RibbonGroup label="Symbols">
        <RibbonColumn>
          <ToolbarButton label="Equation" icon="page" size="wide" disabled disabledReason={NO_NODE} />
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

/**
 * A gallery of shapes or icons, drawn from its own catalogue.
 *
 * The preview in the menu is the same SVG that is inserted, so what the
 * candidate picks is exactly what lands in the document.
 */
function ArtMenu({
  label,
  icon,
  items,
  editor,
  columns,
}: {
  label: string;
  icon: 'shapes' | 'icons';
  items: VectorArt[];
  editor: Editor;
  columns: number;
}) {
  return (
    <Popover
      trigger={({ open, toggle, id, controls }) => (
        <button
          id={id}
          type="button"
          data-popover-trigger
          className={`${styles.menuButton} ${open ? styles.menuButtonOpen : ''}`}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={open ? controls : undefined}
          title={label}
          onMouseDown={(event) => event.preventDefault()}
          onClick={toggle}
        >
          <Icon name={icon} size={18} />
          {label}
          <Icon name="chevron-down" size={12} />
        </button>
      )}
    >
      {({ close }) => (
        <div className={styles.artGrid} style={{ gridTemplateColumns: `repeat(${columns}, 44px)` }}>
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              className={styles.artCell}
              title={item.label}
              aria-label={item.label}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                insertVectorArt(editor, item.svg, item.label);
                close();
              }}
            >
              {/*
                Decorative: the button is already named for the shape.

                A plain `<img>`, not `next/image`: the source is an inline
                `data:image/svg+xml` of a few hundred bytes that is already in
                the bundle. There is nothing for an image loader to fetch,
                resize or cache, and routing it through one would add a network
                round trip to a drawing we are holding in memory.
              */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className={styles.artPreview}
                src={`data:image/svg+xml;utf8,${encodeURIComponent(item.svg)}`}
                alt=""
              />
            </button>
          ))}
        </div>
      )}
    </Popover>
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
/**
 * Word's Draw tab.
 *
 * The pens write into a drawing canvas (`DrawingCanvas`), which is a node in
 * the document — so ink is part of the answer, undoes with Ctrl+Z's button,
 * and is marked by the same machinery as everything else.
 *
 * Select is `null`, not a tool. With it the pointer edits text as it always
 * does; anything else makes every canvas in the document take the pointer.
 * That is the one piece of state the whole tab turns on.
 */
export function DrawTab({ editor }: { editor: Editor }) {
  const inkTool = useUiStore((state) => state.inkTool);
  const inkColour = useUiStore((state) => state.inkColour);
  const inkWidth = useUiStore((state) => state.inkWidth);
  const setInkTool = useUiStore((state) => state.setInkTool);
  const setInkColour = useUiStore((state) => state.setInkColour);
  const setInkWidth = useUiStore((state) => state.setInkWidth);
  const setNotice = useUiStore((state) => state.setNotice);

  /** The canvases in the document, in order, for the commands that need one. */
  const canvasCount = countCanvases(editor);

  return (
    <>
      <RibbonGroup label="Drawing Tools">
        <RibbonRow>
          <ToolbarButton
            label="Select"
            icon="select-all"
            size="large"
            active={inkTool === null}
            onClick={() => setInkTool(null)}
          />
          <ToolbarButton
            label="Pen"
            icon="pen"
            size="large"
            active={inkTool === 'pen'}
            onClick={() => setInkTool('pen')}
          />
          <ToolbarButton
            label="Pencil"
            icon="pencil"
            size="large"
            active={inkTool === 'pencil'}
            onClick={() => setInkTool('pencil')}
          />
          <ToolbarButton
            label="Highlighter"
            icon="highlight"
            size="large"
            active={inkTool === 'highlighter'}
            onClick={() => setInkTool('highlighter')}
          />
          <ToolbarButton
            label="Eraser"
            icon="eraser"
            size="large"
            active={inkTool === 'eraser'}
            onClick={() => setInkTool('eraser')}
          />
        </RibbonRow>
      </RibbonGroup>

      <RibbonGroup label="Pen">
        <RibbonColumn>
          <RibbonRow>
            <span className={styles.fieldLabel}>Colour</span>
            {INK_COLOURS.map((colour) => (
              <button
                key={colour.id}
                type="button"
                className={`${styles.inkSwatch} ${inkColour === colour.value ? styles.inkSwatchActive : ''}`}
                style={{ background: colour.value }}
                title={colour.label}
                aria-label={colour.label}
                aria-pressed={inkColour === colour.value}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setInkColour(colour.value)}
              />
            ))}
          </RibbonRow>
          <RibbonRow>
            <span className={styles.fieldLabel}>Width</span>
            {PEN_WIDTHS.map((width) => (
              <button
                key={width}
                type="button"
                className={`${styles.inkWidth} ${inkWidth === width ? styles.inkWidthActive : ''}`}
                title={`${width}px`}
                aria-label={`${width} pixel nib`}
                aria-pressed={inkWidth === width}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setInkWidth(width)}
              >
                <span className={styles.inkWidthBar} style={{ height: `${Math.min(width, 10)}px` }} />
              </button>
            ))}
          </RibbonRow>
        </RibbonColumn>
      </RibbonGroup>

      <RibbonGroup label="Stencils">
        <ToolbarButton
          label="Ruler"
          icon="borders"
          size="large"
          disabled
          disabledReason="a straight-edge needs a rotatable stencil this build has no model for"
        />
      </RibbonGroup>

      <RibbonGroup label="Edit">
        <RibbonColumn>
          <ToolbarButton
            label="Erase All Ink"
            icon="eraser"
            size="wide"
            disabled={canvasCount === 0}
            disabledReason="there is no drawing canvas in the document"
            onClick={() => {
              const cleared = clearAllInk(editor);
              setNotice(
                cleared === 0 ? 'There was no ink to erase.' : `Erased the ink from ${cleared} ${cleared === 1 ? 'canvas' : 'canvases'}.`,
              );
            }}
          />
          <ToolbarButton
            label="Format Background"
            icon="page"
            size="wide"
            disabled
            disabledReason={NO_NODE}
          />
        </RibbonColumn>
      </RibbonGroup>

      <RibbonGroup label="Convert">
        <RibbonRow>
          <ToolbarButton
            label="Ink to Shape"
            icon="shapes"
            size="large"
            disabled
            disabledReason="recognising a drawn shape needs a recogniser this build does not have"
          />
          <ToolbarButton
            label="Ink to Math"
            icon="page"
            size="large"
            disabled
            disabledReason="recognising handwriting needs a recogniser this build does not have"
          />
        </RibbonRow>
      </RibbonGroup>

      <RibbonGroup label="Insert">
        <ToolbarButton
          label="Drawing Canvas"
          icon="draw-canvas"
          size="large"
          onClick={() => {
            editor.chain().focus().insertDrawingCanvas().run();
            // A canvas with Select active looks inert, so the pen comes out
            // with it — which is what inserting one is for.
            if (inkTool === null) setInkTool('pen');
          }}
        />
      </RibbonGroup>

      <RibbonGroup label="Replay">
        <ToolbarButton
          label="Ink Replay"
          icon="replay"
          size="large"
          disabled={canvasCount === 0}
          disabledReason="there is no drawing canvas in the document"
          onClick={() => {
            const played = replayFirstCanvas();
            if (!played) setNotice('Nothing has been drawn yet.');
          }}
        />
      </RibbonGroup>
    </>
  );
}

/** How many drawing canvases the document holds. */
function countCanvases(editor: Editor): number {
  let count = 0;
  editor.state.doc.descendants((node) => {
    if (node.type.name === 'drawingCanvas') count += 1;
  });
  return count;
}

/** Empties every canvas in one transaction, so one Undo puts the ink back. */
function clearAllInk(editor: Editor): number {
  const positions: number[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'drawingCanvas' && (node.attrs.strokes ?? []).length > 0) positions.push(pos);
  });

  if (positions.length === 0) return 0;

  const transaction = editor.state.tr;
  for (const pos of positions) {
    transaction.setNodeAttribute(pos, 'strokes', []);
  }
  editor.view.dispatch(transaction);

  return positions.length;
}

/**
 * Plays the first canvas that has ink in it.
 *
 * The replay is the canvas's own — the document may hold several, and "play
 * the ink" has to mean one of them — so the ribbon clicks the button the node
 * view already renders rather than reaching into its state.
 */
function replayFirstCanvas(): boolean {
  const button = document.querySelector<HTMLButtonElement>('[data-ink-replay]:not([disabled])');
  if (!button) return false;
  button.click();
  return true;
}

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
