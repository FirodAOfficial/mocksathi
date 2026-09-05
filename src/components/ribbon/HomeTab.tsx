'use client';

import type { Editor } from '@tiptap/react';
import {
  FONT_FAMILIES,
  FONT_SIZES,
  LINE_SPACING_OPTIONS,
  changeIndent,
  clearFormatting,
  setAlignment,
  setBorders,
  setFontFamily,
  setFontSize,
  setHighlightColor,
  setLineSpacing,
  setParagraphStyle,
  setTextColor,
  stepFontSize,
  toggleBulletList,
  toggleOrderedList,
} from '@/editor/ribbonActions';
import type { ClipboardActions } from '@/editor/useClipboard';
import type { FormatState } from '@/editor/useFormatState';
import type { NormalizedStyleId, ParagraphBorders } from '@/services/document/types';
import { ColorPicker } from '../controls/ColorPicker';
import { SelectMenu } from '../controls/SelectMenu';
import { ToolbarButton } from '../controls/ToolbarButton';
import { Popover } from '../controls/Popover';
import { Icon } from '../icons/Icon';
import { RibbonColumn, RibbonGroup, RibbonRow } from './RibbonGroup';
import styles from './HomeTab.module.css';

export interface HomeTabProps {
  editor: Editor;
  format: FormatState;
  clipboard: ClipboardActions;
  onFind: () => void;
  onReplace: () => void;
}

// `noUncheckedIndexedAccess` makes CSS-module lookups optional; the class is
// only ever used in a template literal, where an absent value is harmless.
const STYLE_GALLERY: { id: NormalizedStyleId; label: string; className: string | undefined }[] = [
  { id: 'Normal', label: 'Normal', className: styles.previewNormal },
  { id: 'NoSpacing', label: 'No Spacing', className: styles.previewNormal },
  { id: 'Heading1', label: 'Heading 1', className: styles.previewHeading1 },
  { id: 'Heading2', label: 'Heading 2', className: styles.previewHeading2 },
  { id: 'Heading3', label: 'Heading 3', className: styles.previewHeading3 },
  { id: 'Title', label: 'Title', className: styles.previewTitle },
  { id: 'Subtitle', label: 'Subtitle', className: styles.previewSubtitle },
  { id: 'Quote', label: 'Quote', className: styles.previewQuote },
];

const BORDER_OPTIONS: { label: string; value: ParagraphBorders | null }[] = [
  { label: 'No Border', value: null },
  { label: 'Bottom Border', value: { top: false, bottom: true, left: false, right: false } },
  { label: 'Top Border', value: { top: true, bottom: false, left: false, right: false } },
  { label: 'Left Border', value: { top: false, bottom: false, left: true, right: false } },
  { label: 'Right Border', value: { top: false, bottom: false, left: false, right: true } },
  { label: 'All Borders', value: { top: true, bottom: true, left: true, right: true } },
];

/**
 * The Home tab.
 *
 * Every control here maps to a single call in `ribbonActions`; the component
 * itself holds no editing logic, which keeps it readable at this size and means
 * the command behaviour is testable without mounting the ribbon.
 */
export function HomeTab({ editor, format, clipboard, onFind, onReplace }: HomeTabProps) {
  return (
    <>
      <RibbonGroup label="Clipboard">
        <ToolbarButton label="Paste" icon="paste" size="large" onClick={clipboard.paste} />
        <RibbonColumn>
          <ToolbarButton label="Cut" icon="cut" onClick={clipboard.cut} disabled={!format.hasSelection} disabledReason="select text first" />
          <ToolbarButton label="Copy" icon="copy" onClick={clipboard.copy} disabled={!format.hasSelection} disabledReason="select text first" />
          <ToolbarButton
            label="Format Painter"
            icon="format-painter"
            active={clipboard.formatPainterActive}
            onClick={clipboard.toggleFormatPainter}
          />
        </RibbonColumn>
      </RibbonGroup>

      <RibbonGroup label="Font">
        <RibbonColumn>
          <RibbonRow>
            <SelectMenu
              label="Font"
              width={132}
              value={format.fontFamily}
              placeholder="Calibri"
              options={FONT_FAMILIES.map((family) => ({
                value: family,
                label: family,
                optionStyle: { fontFamily: family },
              }))}
              onChange={(family) => setFontFamily(editor, family)}
            />
            <SelectMenu
              label="Font Size"
              width={52}
              value={format.fontSize}
              options={FONT_SIZES.map((size) => ({ value: size, label: String(size) }))}
              onChange={(size) => setFontSize(editor, size)}
            />
            <ToolbarButton label="Grow Font" icon="grow-font" onClick={() => stepFontSize(editor, 1)} />
            <ToolbarButton label="Shrink Font" icon="shrink-font" onClick={() => stepFontSize(editor, -1)} />
            <ToolbarButton label="Clear Formatting" icon="clear-format" onClick={() => clearFormatting(editor)} />
          </RibbonRow>

          <RibbonRow>
            <ToolbarButton
              label="Bold"
              glyph={<strong>B</strong>}
              active={format.bold}
              onClick={() => editor.chain().focus().toggleBold().run()}
            />
            <ToolbarButton
              label="Italic"
              glyph={<em>I</em>}
              active={format.italic}
              onClick={() => editor.chain().focus().toggleItalic().run()}
            />
            <ToolbarButton
              label="Underline"
              glyph={<u>U</u>}
              active={format.underline}
              onClick={() => editor.chain().focus().toggleUnderline().run()}
            />
            <ToolbarButton
              label="Strikethrough"
              glyph={<s>abc</s>}
              className={styles.wideGlyph}
              active={format.strike}
              onClick={() => editor.chain().focus().toggleStrike().run()}
            />
            <ToolbarButton
              label="Subscript"
              glyph={
                <span>
                  X<sub>2</sub>
                </span>
              }
              active={format.subscript}
              onClick={() => editor.chain().focus().toggleSubscript().run()}
            />
            <ToolbarButton
              label="Superscript"
              glyph={
                <span>
                  X<sup>2</sup>
                </span>
              }
              active={format.superscript}
              onClick={() => editor.chain().focus().toggleSuperscript().run()}
            />
            <ColorPicker
              label="Text Highlight Colour"
              icon="highlight"
              currentColor={format.highlight}
              defaultColor="#ffff00"
              clearLabel="No Colour"
              onSelect={(color) => setHighlightColor(editor, color)}
            />
            <ColorPicker
              label="Font Colour"
              icon="text-color"
              currentColor={format.color}
              defaultColor="#c00000"
              clearLabel="Automatic"
              onSelect={(color) => setTextColor(editor, color)}
            />
          </RibbonRow>
        </RibbonColumn>
      </RibbonGroup>

      <RibbonGroup label="Paragraph">
        <RibbonColumn>
          <RibbonRow>
            <ToolbarButton label="Bullets" icon="bullet-list" active={format.bulletList} onClick={() => toggleBulletList(editor)} />
            <ToolbarButton label="Numbering" icon="ordered-list" active={format.orderedList} onClick={() => toggleOrderedList(editor)} />
            <span className={styles.divider} />
            <ToolbarButton label="Decrease Indent" icon="indent-decrease" onClick={() => changeIndent(editor, -1)} />
            <ToolbarButton label="Increase Indent" icon="indent-increase" onClick={() => changeIndent(editor, 1)} />
          </RibbonRow>

          <RibbonRow>
            <ToolbarButton label="Align Text Left" icon="align-left" active={format.align === 'left'} onClick={() => setAlignment(editor, 'left')} />
            <ToolbarButton label="Center" icon="align-center" active={format.align === 'center'} onClick={() => setAlignment(editor, 'center')} />
            <ToolbarButton label="Align Text Right" icon="align-right" active={format.align === 'right'} onClick={() => setAlignment(editor, 'right')} />
            <ToolbarButton label="Justify" icon="align-justify" active={format.align === 'justify'} onClick={() => setAlignment(editor, 'justify')} />
            <span className={styles.divider} />

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
                  aria-label="Line and Paragraph Spacing"
                  title="Line and Paragraph Spacing"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={toggle}
                >
                  <Icon name="line-spacing" size={18} />
                  <Icon name="chevron-down" size={12} />
                </button>
              )}
            >
              {({ close }) => (
                <div className={styles.menu}>
                  {LINE_SPACING_OPTIONS.map((value) => (
                    <button
                      key={value}
                      type="button"
                      role="menuitemradio"
                      aria-checked={format.lineHeight === value}
                      className={`${styles.menuItem} ${format.lineHeight === value ? styles.menuItemSelected : ''}`}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        setLineSpacing(editor, value);
                        close();
                      }}
                    >
                      {value.toFixed(2).replace(/\.00$/, '.0')}
                    </button>
                  ))}
                </div>
              )}
            </Popover>

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
                  aria-label="Borders"
                  title="Borders"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={toggle}
                >
                  <Icon name="borders" size={18} />
                  <Icon name="chevron-down" size={12} />
                </button>
              )}
            >
              {({ close }) => (
                <div className={styles.menu}>
                  {BORDER_OPTIONS.map((option) => (
                    <button
                      key={option.label}
                      type="button"
                      role="menuitem"
                      className={styles.menuItem}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        setBorders(editor, option.value);
                        close();
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </Popover>
          </RibbonRow>
        </RibbonColumn>
      </RibbonGroup>

      <RibbonGroup label="Styles">
        <div className={styles.gallery} role="radiogroup" aria-label="Paragraph styles">
          {STYLE_GALLERY.map((style) => (
            <button
              key={style.id}
              type="button"
              role="radio"
              aria-checked={format.style === style.id}
              className={`${styles.galleryItem} ${format.style === style.id ? styles.galleryItemActive : ''}`}
              title={style.label}
              // The "AaBb" specimen is a visual preview; naming the control
              // explicitly keeps the style name from being read as "AaBb Heading 1".
              aria-label={style.label}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setParagraphStyle(editor, style.id)}
            >
              <span className={`${styles.preview} ${style.className}`} aria-hidden="true">
                AaBb
              </span>
              <span className={styles.galleryLabel} aria-hidden="true">
                {style.label}
              </span>
            </button>
          ))}
        </div>
      </RibbonGroup>

      <RibbonGroup label="Editing">
        <RibbonColumn>
          <ToolbarButton label="Find" icon="find" onClick={onFind} />
          <ToolbarButton label="Replace" icon="replace" onClick={onReplace} />
          <ToolbarButton label="Select All" icon="select-all" onClick={() => editor.chain().focus().selectAll().run()} />
        </RibbonColumn>
      </RibbonGroup>
    </>
  );
}
