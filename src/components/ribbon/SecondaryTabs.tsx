'use client';

import type { Editor } from '@tiptap/react';
import { changeIndent, insertTable, setParagraphSpacing } from '@/editor/ribbonActions';
import { MARGIN_PRESETS, ZOOM_LEVELS, useUiStore, type MarginPreset } from '@/state/uiStore';
import { Popover } from '../controls/Popover';
import { SelectMenu } from '../controls/SelectMenu';
import { ToolbarButton } from '../controls/ToolbarButton';
import { Icon } from '../icons/Icon';
import { RibbonColumn, RibbonGroup, RibbonRow } from './RibbonGroup';
import styles from './SecondaryTabs.module.css';

/**
 * The tabs beyond Home.
 *
 * These carry only controls that genuinely do something. Word's real Insert
 * and Review tabs are far larger, but a button that looks live and does
 * nothing is worse than an absent one, so the unimplemented features are
 * described in the README rather than mocked up here.
 */

const SYMBOLS = [
  '©', '®', '™', '°', '±', '×', '÷', '≠', '≤', '≥',
  '–', '—', '“', '”', '‘', '’', '…', '•', '§', '¶',
  '€', '£', '¥', '¢', '†', '‡', '½', '¼', '¾', '→',
  'α', 'β', 'γ', 'π', 'Ω', 'µ', '∑', '√', '∞', '≈',
];

/** Points converted to the CSS pixels the model stores. */
const pt = (points: number): number => Math.round((points * 96) / 72);

const SPACING_OPTIONS = [0, 6, 12, 18, 24].map((points) => ({
  value: points,
  label: `${points} pt`,
}));

export function InsertTab({ editor }: { editor: Editor }) {
  return (
    <>
      <RibbonGroup label="Symbols">
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
              title="Symbol"
              onMouseDown={(event) => event.preventDefault()}
              onClick={toggle}
            >
              <span className={styles.symbolGlyph}>Ω</span>
              <span className={styles.largeCaption}>Symbol</span>
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
      </RibbonGroup>

      <RibbonGroup label="Tables">
        <ToolbarButton
          label="Insert Table"
          icon="borders"
          size="large"
          onClick={() => insertTable(editor, 3, 3)}
        />
      </RibbonGroup>

      <RibbonGroup label="Text">
        <ToolbarButton
          label="Date & Time"
          icon="page"
          size="large"
          onClick={() =>
            editor
              .chain()
              .focus()
              .insertContent(
                new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }),
              )
              .run()
          }
        />
      </RibbonGroup>
    </>
  );
}

export function LayoutTab({ editor }: { editor: Editor }) {
  const orientation = useUiStore((state) => state.orientation);
  const setOrientation = useUiStore((state) => state.setOrientation);
  const margins = useUiStore((state) => state.margins);
  const setMargins = useUiStore((state) => state.setMargins);

  return (
    <>
      <RibbonGroup label="Page Setup">
        <RibbonColumn>
          <SelectMenu
            label="Margins"
            width={112}
            value={margins}
            options={(Object.keys(MARGIN_PRESETS) as MarginPreset[]).map((preset) => ({
              value: preset,
              label: preset.charAt(0).toUpperCase() + preset.slice(1),
            }))}
            onChange={setMargins}
          />
          <SelectMenu
            label="Orientation"
            width={112}
            value={orientation}
            options={[
              { value: 'portrait', label: 'Portrait' },
              { value: 'landscape', label: 'Landscape' },
            ]}
            onChange={setOrientation}
          />
        </RibbonColumn>
      </RibbonGroup>

      <RibbonGroup label="Paragraph">
        <RibbonColumn>
          <RibbonRow>
            <span className={styles.fieldLabel}>Indent</span>
            <ToolbarButton label="Decrease Indent" icon="indent-decrease" onClick={() => changeIndent(editor, -1)} />
            <ToolbarButton label="Increase Indent" icon="indent-increase" onClick={() => changeIndent(editor, 1)} />
          </RibbonRow>
          <RibbonRow>
            <span className={styles.fieldLabel}>Before</span>
            <SelectMenu
              label="Space Before"
              width={70}
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
              width={70}
              value={null}
              placeholder="Spacing"
              options={SPACING_OPTIONS}
              onChange={(points) => setParagraphSpacing(editor, { after: points === 0 ? null : pt(points) })}
            />
          </RibbonRow>
        </RibbonColumn>
      </RibbonGroup>
    </>
  );
}

export function ReviewTab({ onWordCount }: { onWordCount: () => void }) {
  const readOnly = useUiStore((state) => state.readOnly);
  const setReadOnly = useUiStore((state) => state.setReadOnly);

  return (
    <>
      <RibbonGroup label="Proofing">
        <ToolbarButton label="Word Count" icon="find" size="large" onClick={onWordCount} />
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

export function ViewTab() {
  const zoom = useUiStore((state) => state.zoom);
  const setZoom = useUiStore((state) => state.setZoom);
  const showRuler = useUiStore((state) => state.showRuler);
  const toggleRuler = useUiStore((state) => state.toggleRuler);

  return (
    <>
      <RibbonGroup label="Show">
        <ToolbarButton label="Ruler" icon="borders" size="large" active={showRuler} onClick={toggleRuler} />
      </RibbonGroup>

      <RibbonGroup label="Zoom">
        <SelectMenu
          label="Zoom"
          width={88}
          value={zoom}
          options={ZOOM_LEVELS.map((level) => ({ value: level, label: `${Math.round(level * 100)}%` }))}
          onChange={setZoom}
        />
      </RibbonGroup>

      <RibbonGroup label="Print">
        <ToolbarButton label="Print" icon="print" size="large" onClick={() => window.print()} />
      </RibbonGroup>
    </>
  );
}
