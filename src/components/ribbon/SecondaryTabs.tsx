'use client';

import type { Editor } from '@tiptap/react';
import { useRef, useState, type ChangeEvent, type CSSProperties } from 'react';
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
import {
  accessibilityIssues,
  describeAccessibility,
  insertCaption,
  insertTableOfContents,
  readableText,
} from '@/editor/referenceActions';
import { BLOCK_FORMAT_TYPES } from '@/editor/extensions/BlockFormat';
import { INK_COLOURS, PEN_WIDTHS } from '@/editor/ink';
import {
  STYLE_SETS,
  THEMES,
  THEME_COLOURS,
  headingStyleVars,
  type HeadingStyle,
} from '@/editor/themes';
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

/** Acts on a floating object; a picture here is a block in the text flow. */
const NO_FLOAT = 'pictures sit in the text flow here, so there is nothing to float';

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

/** The presets the spacing combos offer; any value in range may be typed. */
const SPACING_POINTS = [0, 6, 8, 10, 12, 18, 24] as const;

/** Paragraph spacing is stored in pixels; Word states it in points. */
const toPt = (pixels: number | null | undefined): number =>
  pixels == null ? 0 : Math.round((pixels * 72) / 96 * 2) / 2;

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
  const heading = useUiStore((state) => state.heading);
  const setHeading = useUiStore((state) => state.setHeading);

  return (
    <>
      <RibbonGroup label="Document Formatting">
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
              title="Themes"
              onMouseDown={(event) => event.preventDefault()}
              onClick={toggle}
            >
              <Icon name="theme" size={24} />
              <span className={styles.largeCaption}>Themes</span>
              <Icon name="chevron-down" size={12} />
            </button>
          )}
        >
          {({ close }) => (
            <div className={styles.themeGrid}>
              {THEMES.map((theme) => (
                <button
                  key={theme.id}
                  type="button"
                  role="menuitem"
                  className={styles.themeCell}
                  title={theme.label}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    // A theme is both: the body font is document content, the
                    // heading look is page decoration.
                    setDocumentFont(editor, theme.bodyFont);
                    setHeading(theme.heading);
                    close();
                  }}
                >
                  <HeadingSpecimen style={theme.heading} />
                  <span className={styles.themeLabel}>{theme.label}</span>
                </button>
              ))}
            </div>
          )}
        </Popover>

        {/*
          Word's style-set gallery: the same body text under a different
          heading. A swatch could not show that, which is why each one previews
          as a title over a line of text.
        */}
        <div className={styles.styleSets} role="radiogroup" aria-label="Style sets">
          {STYLE_SETS.map((set) => {
            const current = set.heading.colour === heading.colour && set.heading.font === heading.font;
            return (
              <button
                key={set.id}
                type="button"
                role="radio"
                aria-checked={current}
                className={`${styles.styleSet} ${current ? styles.styleSetActive : ''}`}
                title={set.label}
                aria-label={set.label}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setHeading(set.heading)}
              >
                <HeadingSpecimen style={set.heading} />
              </button>
            );
          })}
        </div>

        <RibbonColumn>
          <RibbonRow>
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
                  title="Colours"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={toggle}
                >
                  <span className={styles.themeSwatch} style={{ background: heading.colour }} />
                  Colours
                  <Icon name="chevron-down" size={12} />
                </button>
              )}
            >
              {({ close }) => (
                <div className={styles.colourList}>
                  {THEME_COLOURS.map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={entry.colour === heading.colour}
                      className={styles.colourRow}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        setHeading({ colour: entry.colour });
                        close();
                      }}
                    >
                      <span className={styles.themeSwatch} style={{ background: entry.colour }} />
                      {entry.label}
                    </button>
                  ))}
                </div>
              )}
            </Popover>

            <SelectMenu
              label="Fonts"
              width={132}
              value={null}
              placeholder="Fonts"
              options={FONT_FAMILIES.map((family) => ({
                value: family,
                label: family,
                optionStyle: { fontFamily: family },
              }))}
              onChange={(family) => {
                setDocumentFont(editor, family);
                setHeading({ font: family });
              }}
            />
          </RibbonRow>

          <RibbonRow>
            <SelectMenu
              label="Paragraph Spacing"
              width={132}
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
            <ToolbarButton
              label="Effects"
              icon="shapes"
              size="wide"
              disabled
              disabledReason="theme effects style shapes and SmartArt, which this build has none of"
            />
          </RibbonRow>

          <RibbonRow>
            <ToolbarButton
              label="Set as Default"
              icon="check"
              size="wide"
              disabled
              disabledReason="a paper opens from its own template, so there is no default to set"
            />
          </RibbonRow>
        </RibbonColumn>
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

/**
 * A theme's or style set's heading, drawn as Word draws it in the gallery.
 *
 * Built from `headingStyleVars`, the same function the page uses, so a preview
 * cannot drift from what picking it actually does.
 */
function HeadingSpecimen({ style }: { style: HeadingStyle }) {
  return (
    <span className={styles.specimen} style={headingStyleVars(style) as CSSProperties} aria-hidden="true">
      <span className={styles.specimenTitle}>Title</span>
      <span className={styles.specimenBody} />
      <span className={styles.specimenBody} />
    </span>
  );
}

/* ---------------------------------------------------------------------- */

/** The attributes of the nearest block `BlockFormat` styles, from the cursor. */
function currentBlockAttrs(editor: Editor): Record<string, unknown> {
  const { $from } = editor.state.selection;

  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth);
    if ((BLOCK_FORMAT_TYPES as readonly string[]).includes(node.type.name)) return node.attrs;
  }

  return {};
}

export function LayoutTab({ editor }: { editor: Editor }) {
  const orientation = useUiStore((state) => state.orientation);
  const setOrientation = useUiStore((state) => state.setOrientation);
  const paper = useUiStore((state) => state.paper);
  const setPaper = useUiStore((state) => state.setPaper);
  const margins = useUiStore((state) => state.margins);
  const setMargins = useUiStore((state) => state.setMargins);
  const columns = useUiStore((state) => state.columns);
  const setColumns = useUiStore((state) => state.setColumns);

  /*
   * The block the cursor is in, not whatever `paragraph` happens to say.
   *
   * These boxes read `getAttributes('paragraph')`, which returns nothing when
   * the cursor is in a heading or a quotation — so setting 18pt of space
   * before a heading applied it to the document and left the box reading 0.
   * Every type `BlockFormat` styles can carry these attributes, so the one
   * under the cursor is the one to show.
   */
  const attrs = currentBlockAttrs(editor);

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
          <ToolbarButton label="Breaks" icon="page" size="wide" disabled disabledReason={NO_PAGES} />
          <ToolbarButton
            label="Line Numbers"
            icon="line-numbers"
            size="wide"
            disabled
            /* Word numbers laid-out lines, not paragraphs. Nothing in CSS can
               count where the text wrapped, so this needs the same line boxes
               pagination needs — numbering paragraphs instead would be a
               different feature wearing this one's name. */
            disabledReason="numbering laid-out lines needs the line boxes pagination would provide"
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
          {/*
            Word shows the paragraph's own spacing in these boxes, and these
            did not: they were pickers with a placeholder, so the candidate
            could set a value and had no way to read one back. Combos, like the
            indent boxes beside them, which also makes a spacing the list does
            not offer typeable.
          */}
          <RibbonRow>
            <span className={styles.fieldLabel}>Before</span>
            <NumberCombo
              label="Space Before"
              width={78}
              value={toPt(attrs.spaceBefore as number | null)}
              options={SPACING_POINTS}
              min={0}
              max={200}
              onChange={(points) => setParagraphSpacing(editor, { before: points === 0 ? null : pt(points) })}
            />
          </RibbonRow>
          <RibbonRow>
            <span className={styles.fieldLabel}>After</span>
            <NumberCombo
              label="Space After"
              width={78}
              value={toPt(attrs.spaceAfter as number | null)}
              options={SPACING_POINTS}
              min={0}
              max={200}
              onChange={(points) => setParagraphSpacing(editor, { after: points === 0 ? null : pt(points) })}
            />
          </RibbonRow>
        </RibbonColumn>
      </RibbonGroup>

      {/*
        Every command here acts on a floating object — one positioned over the
        text rather than flowing in it. A picture in this build is a block in
        the flow, so there is nothing to position, wrap round, stack or rotate.
        That is one reason, said once.
      */}
      <RibbonGroup label="Arrange">
        <RibbonColumn>
          <RibbonRow>
            <ToolbarButton label="Position" icon="picture" size="wide" disabled disabledReason={NO_FLOAT} />
            <ToolbarButton label="Wrap Text" icon="page" size="wide" disabled disabledReason={NO_FLOAT} />
            <ToolbarButton label="Selection Pane" icon="select-all" size="wide" disabled disabledReason={NO_FLOAT} />
          </RibbonRow>
          <RibbonRow>
            <ToolbarButton label="Bring Forward" icon="shapes" size="wide" disabled disabledReason={NO_FLOAT} />
            <ToolbarButton label="Send Backward" icon="shapes" size="wide" disabled disabledReason={NO_FLOAT} />
            <ToolbarButton label="Align" icon="align-objects" size="wide" disabled disabledReason={NO_FLOAT} />
          </RibbonRow>
          <RibbonRow>
            <ToolbarButton label="Group" icon="group" size="wide" disabled disabledReason={NO_FLOAT} />
            <ToolbarButton label="Rotate" icon="rotate" size="wide" disabled disabledReason={NO_FLOAT} />
          </RibbonRow>
        </RibbonColumn>
      </RibbonGroup>
    </>
  );
}

/* ---------------------------------------------------------------------- */

export function ReviewTab({ editor, onWordCount }: { editor: Editor; onWordCount: () => void }) {
  const readOnly = useUiStore((state) => state.readOnly);
  const setReadOnly = useUiStore((state) => state.setReadOnly);
  const setNotice = useUiStore((state) => state.setNotice);
  const [speaking, setSpeaking] = useState(false);

  /*
   * Read Aloud, through the browser's own speech engine.
   *
   * No service and no model: `speechSynthesis` ships with the browser, which
   * is why this one is real where Translate is not. It stops as well as
   * starts, because a paper that reads itself aloud with no way to silence it
   * would be worse than no button.
   */
  const toggleReadAloud = (): void => {
    const speech = typeof window === 'undefined' ? null : window.speechSynthesis;
    if (!speech) {
      setNotice('This browser cannot read text aloud.');
      return;
    }

    if (speaking || speech.speaking) {
      speech.cancel();
      setSpeaking(false);
      return;
    }

    const text = readableText(editor.getJSON());
    if (text.length === 0) {
      setNotice('There is nothing to read yet.');
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    speech.speak(utterance);
    setSpeaking(true);
  };

  return (
    <>
      <RibbonGroup label="Proofing">
        <RibbonRow>
          <ToolbarButton label="Word Count" icon="find" size="large" onClick={onWordCount} />
          <ToolbarButton
            label="Spelling &amp; Grammar"
            icon="find"
            size="large"
            disabled
            disabledReason="no dictionary in this build"
          />
          <ToolbarButton
            label="Thesaurus"
            icon="find"
            size="large"
            disabled
            disabledReason="no dictionary in this build"
          />
        </RibbonRow>
      </RibbonGroup>

      <RibbonGroup label="Speech">
        <ToolbarButton
          label={speaking ? 'Stop Reading' : 'Read Aloud'}
          icon="speech"
          size="large"
          active={speaking}
          onClick={toggleReadAloud}
        />
      </RibbonGroup>

      <RibbonGroup label="Accessibility">
        <ToolbarButton
          label="Check Accessibility"
          icon="check"
          size="large"
          onClick={() => setNotice(describeAccessibility(accessibilityIssues(editor.getJSON())))}
        />
      </RibbonGroup>

      <RibbonGroup label="Language">
        <RibbonColumn>
          <ToolbarButton label="Translate" icon="page" size="wide" disabled disabledReason={NO_SERVICE} />
          <ToolbarButton
            label="Language"
            icon="page"
            size="wide"
            disabled
            disabledReason="the paper's language is chosen before it starts and fixed for the sitting"
          />
        </RibbonColumn>
      </RibbonGroup>

      <RibbonGroup label="Comments">
        <ToolbarButton label="New Comment" icon="comment" size="large" disabled disabledReason={NO_NODE} />
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

      <RibbonGroup label="Compare">
        <ToolbarButton
          label="Compare"
          icon="page"
          size="large"
          disabled
          disabledReason="there is only ever one version of a paper to compare"
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

/**
 * Word's References tab.
 *
 * Two of its commands survive without pagination, and they are the two worth
 * having: a contents list built from the document's own headings, and numbered
 * captions. Everything else here needs either page numbers or a bibliography
 * store, and says which.
 */
export function ReferencesTab({ editor }: { editor: Editor }) {
  const setNotice = useUiStore((state) => state.setNotice);

  return (
    <>
      <RibbonGroup label="Table of Contents">
        <ToolbarButton
          label="Table of Contents"
          icon="line-numbers"
          size="large"
          onClick={() => {
            const count = insertTableOfContents(editor);
            setNotice(
              count === 0
                ? 'Give the document some headings first — the contents list is built from them.'
                : `Contents built from ${count} heading${count === 1 ? '' : 's'}. Page numbers need pagination, so there are none.`,
            );
          }}
        />
      </RibbonGroup>

      <RibbonGroup label="Footnotes">
        <RibbonColumn>
          <ToolbarButton label="Insert Footnote" icon="page" size="wide" disabled disabledReason={NO_PAGES} />
          <ToolbarButton label="Insert Endnote" icon="page" size="wide" disabled disabledReason={NO_NODE} />
        </RibbonColumn>
      </RibbonGroup>

      <RibbonGroup label="Citations &amp; Bibliography">
        <RibbonColumn>
          <ToolbarButton
            label="Insert Citation"
            icon="page"
            size="wide"
            disabled
            disabledReason="there is no source list to cite from"
          />
          <ToolbarButton
            label="Bibliography"
            icon="page"
            size="wide"
            disabled
            disabledReason="there is no source list to build one from"
          />
        </RibbonColumn>
      </RibbonGroup>

      <RibbonGroup label="Captions">
        <RibbonColumn>
          <RibbonRow>
            <ToolbarButton
              label="Insert Caption"
              icon="picture"
              size="wide"
              onClick={() => setNotice(`Figure ${insertCaption(editor, 'Figure')} caption added.`)}
            />
            <ToolbarButton
              label="Insert Table Caption"
              icon="borders"
              size="wide"
              onClick={() => setNotice(`Table ${insertCaption(editor, 'Table')} caption added.`)}
            />
          </RibbonRow>
          <ToolbarButton
            label="Table of Figures"
            icon="page"
            size="wide"
            disabled
            disabledReason={NO_PAGES}
          />
        </RibbonColumn>
      </RibbonGroup>

      <RibbonGroup label="Index">
        <RibbonColumn>
          <ToolbarButton label="Mark Entry" icon="page" size="wide" disabled disabledReason={NO_NODE} />
          <ToolbarButton label="Insert Index" icon="page" size="wide" disabled disabledReason={NO_PAGES} />
        </RibbonColumn>
      </RibbonGroup>
    </>
  );
}

/* ---------------------------------------------------------------------- */

/**
 * Word's Mailings tab, in full and entirely unavailable.
 *
 * Nothing here can work without a data source and a merge engine, and the tab
 * is drawn anyway: a candidate who expects Mailings to be the sixth tab should
 * find it there, with each command saying what it would need.
 */
export function MailingsTab() {
  const NO_MERGE = 'mail merge needs a data source this build has no way to open';

  return (
    <>
      <RibbonGroup label="Create">
        <RibbonColumn>
          <ToolbarButton label="Envelopes" icon="page" size="wide" disabled disabledReason={NO_MERGE} />
          <ToolbarButton label="Labels" icon="page" size="wide" disabled disabledReason={NO_MERGE} />
        </RibbonColumn>
      </RibbonGroup>

      <RibbonGroup label="Start Mail Merge">
        <RibbonColumn>
          <ToolbarButton label="Start Mail Merge" icon="page" size="wide" disabled disabledReason={NO_MERGE} />
          <ToolbarButton label="Select Recipients" icon="page" size="wide" disabled disabledReason={NO_MERGE} />
          <ToolbarButton label="Edit Recipient List" icon="page" size="wide" disabled disabledReason={NO_MERGE} />
        </RibbonColumn>
      </RibbonGroup>

      <RibbonGroup label="Write &amp; Insert Fields">
        <RibbonColumn>
          <ToolbarButton label="Address Block" icon="page" size="wide" disabled disabledReason={NO_MERGE} />
          <ToolbarButton label="Greeting Line" icon="page" size="wide" disabled disabledReason={NO_MERGE} />
          <ToolbarButton label="Insert Merge Field" icon="page" size="wide" disabled disabledReason={NO_MERGE} />
        </RibbonColumn>
      </RibbonGroup>

      <RibbonGroup label="Preview Results">
        <ToolbarButton label="Preview Results" icon="find" size="large" disabled disabledReason={NO_MERGE} />
      </RibbonGroup>

      <RibbonGroup label="Finish">
        <ToolbarButton label="Finish &amp; Merge" icon="check" size="large" disabled disabledReason={NO_MERGE} />
      </RibbonGroup>
    </>
  );
}

/* ---------------------------------------------------------------------- */

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
