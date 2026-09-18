'use client';

import { useState } from 'react';
import type { Editor } from '@tiptap/react';
import { CHARACTER_SCALE_OPTIONS, type CapsMode, type TextEffect } from '@/editor/extensions/CharacterFormat';
import { UNDERLINE_STYLES, underlineCss, type UnderlineStyle } from '@/editor/functions/underline';
import {
  FONT_FAMILIES,
  FONT_SIZES,
  MAX_FONT_SIZE_PT,
  MIN_FONT_SIZE_PT,
  currentFontSize,
  setCaps,
  setCharacterScale,
  setCharacterSpacing,
  setDoubleStrike,
  setFontFamily,
  setFontSize,
  setHiddenText,
  setTextColor,
  setTextEffect,
  setUnderlineColor,
  setUnderlineStyle,
} from '@/editor/ribbonActions';
import { THEME_PALETTE } from '../controls/ColorPicker';
import { Dialog } from './Dialog';
import styles from './FontDialog.module.css';

export interface FontDialogProps {
  editor: Editor;
  onClose: () => void;
}

type SpacingMode = 'normal' | 'expanded' | 'condensed';
type FontStyleName = 'regular' | 'italic' | 'bold' | 'boldItalic';
type Tab = 'font' | 'advanced';

/**
 * Word's Font dialog, reached from the Font group's launcher arrow and from
 * More Underlines… in the underline menu.
 *
 * Two tabs, as Word has: Font carries the family, style, size, colour,
 * underline and the effects; Advanced carries character Scale and Spacing.
 * Everything applies when OK is pressed rather than as the fields change,
 * which is also Word's behaviour — a dialog is a decision, not a live control.
 */
export function FontDialog({ editor, onClose }: FontDialogProps) {
  const current = editor.getAttributes('textStyle');
  const underline = editor.getAttributes('underline');

  const [tab, setTab] = useState<Tab>('font');

  const [family, setFamily] = useState<string>(
    typeof current.fontFamily === 'string' ? current.fontFamily : '',
  );
  const [size, setSize] = useState<number>(currentFontSize(editor));
  const [fontStyle, setFontStyle] = useState<FontStyleName>(
    editor.isActive('bold') && editor.isActive('italic')
      ? 'boldItalic'
      : editor.isActive('bold')
        ? 'bold'
        : editor.isActive('italic')
          ? 'italic'
          : 'regular',
  );

  const [colour, setColour] = useState<string>(typeof current.color === 'string' ? current.color : '');
  const [underlineStyle, setUnderlineStyleValue] = useState<UnderlineStyle | ''>(
    editor.isActive('underline') ? ((underline.style as UnderlineStyle | null) ?? 'single') : '',
  );
  const [underlineColour, setUnderlineColour] = useState<string>(
    typeof underline.color === 'string' ? underline.color : '',
  );

  const [strike, setStrike] = useState(editor.isActive('strike'));
  const [doubleStrike, setDouble] = useState(current.doubleStrike === true);
  const [superscript, setSuperscript] = useState(editor.isActive('superscript'));
  const [subscript, setSubscript] = useState(editor.isActive('subscript'));
  const [caps, setCapsValue] = useState<CapsMode | null>((current.caps as CapsMode | undefined) ?? null);
  const [hidden, setHidden] = useState(current.hidden === true);
  const [effect, setEffect] = useState<TextEffect | null>((current.effect as TextEffect) ?? null);

  const [scale, setScale] = useState<number>(typeof current.charScale === 'number' ? current.charScale : 100);
  const currentSpacing = typeof current.charSpacing === 'number' ? current.charSpacing : 0;
  const [spacingMode, setSpacingMode] = useState<SpacingMode>(
    currentSpacing > 0 ? 'expanded' : currentSpacing < 0 ? 'condensed' : 'normal',
  );
  const [spacingBy, setSpacingBy] = useState<number>(Math.abs(currentSpacing) || 1);

  const apply = (): void => {
    const chain = editor.chain().focus();

    // Bold and italic are one control in Word, so both are set from it rather
    // than toggled — a dialog states what the text should be, not what to flip.
    chain.setMark('textStyle', {});
    if (fontStyle === 'bold' || fontStyle === 'boldItalic') chain.setBold();
    else chain.unsetBold();
    if (fontStyle === 'italic' || fontStyle === 'boldItalic') chain.setItalic();
    else chain.unsetItalic();

    if (strike) chain.setStrike();
    else chain.unsetStrike();

    // Superscript and subscript are mutually exclusive, as in Word.
    if (superscript) chain.setSuperscript();
    else chain.unsetSuperscript();
    if (subscript && !superscript) chain.setSubscript();
    else chain.unsetSubscript();

    chain.run();

    if (family) setFontFamily(editor, family);
    setFontSize(editor, size);
    setTextColor(editor, colour === '' ? null : colour);

    setUnderlineStyle(editor, underlineStyle === '' ? null : underlineStyle);
    if (underlineStyle !== '') setUnderlineColor(editor, underlineColour === '' ? null : underlineColour);

    setDoubleStrike(editor, doubleStrike);
    setCaps(editor, caps);
    setHiddenText(editor, hidden);
    setTextEffect(editor, effect);
    setCharacterScale(editor, scale === 100 ? null : scale);
    setCharacterSpacing(
      editor,
      spacingMode === 'normal' ? null : spacingMode === 'expanded' ? spacingBy : -spacingBy,
    );

    onClose();
  };

  const previewStyle: Record<string, string> = {
    fontFamily: family || 'inherit',
    fontSize: `${Math.min(size, 28)}pt`,
    fontWeight: fontStyle === 'bold' || fontStyle === 'boldItalic' ? '700' : '400',
    fontStyle: fontStyle === 'italic' || fontStyle === 'boldItalic' ? 'italic' : 'normal',
    ...(colour ? { color: colour } : {}),
    ...(caps === 'all' ? { textTransform: 'uppercase' } : caps === 'small' ? { fontVariant: 'small-caps' } : {}),
    ...(strike || doubleStrike ? { textDecorationLine: 'line-through' } : {}),
    ...(doubleStrike ? { textDecorationStyle: 'double' } : {}),
    ...(hidden ? { opacity: '0.45' } : {}),
    ...(spacingMode === 'normal'
      ? {}
      : { letterSpacing: `${spacingMode === 'expanded' ? spacingBy : -spacingBy}pt` }),
  };

  return (
    <Dialog
      title="Font"
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.button} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={`${styles.button} ${styles.primary}`} onClick={apply}>
            OK
          </button>
        </>
      }
    >
      <div className={styles.tabs} role="tablist" aria-label="Font settings">
        {([
          { id: 'font', label: 'Font' },
          { id: 'advanced', label: 'Advanced' },
        ] as const).map((entry) => (
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

      {tab === 'font' ? (
        <>
          <div className={styles.row}>
            <label className={styles.stack}>
              <span className={styles.caption}>Font:</span>
              <input
                className={styles.input}
                list="font-dialog-families"
                value={family}
                placeholder="+Body"
                onChange={(event) => setFamily(event.target.value)}
              />
              <datalist id="font-dialog-families">
                {FONT_FAMILIES.map((entry) => (
                  <option key={entry} value={entry} />
                ))}
              </datalist>
            </label>

            <label className={styles.stack}>
              <span className={styles.caption}>Font style:</span>
              <select
                className={styles.input}
                value={fontStyle}
                onChange={(event) => setFontStyle(event.target.value as FontStyleName)}
              >
                <option value="regular">Regular</option>
                <option value="italic">Italic</option>
                <option value="bold">Bold</option>
                <option value="boldItalic">Bold Italic</option>
              </select>
            </label>

            <label className={`${styles.stack} ${styles.narrow}`}>
              <span className={styles.caption}>Size:</span>
              <input
                type="number"
                className={styles.input}
                min={MIN_FONT_SIZE_PT}
                max={MAX_FONT_SIZE_PT}
                step={0.5}
                list="font-dialog-sizes"
                value={size}
                onChange={(event) => setSize(Number(event.target.value))}
              />
              <datalist id="font-dialog-sizes">
                {FONT_SIZES.map((entry) => (
                  <option key={entry} value={entry} />
                ))}
              </datalist>
            </label>
          </div>

          <div className={styles.row}>
            <label className={styles.stack}>
              <span className={styles.caption}>Font colour:</span>
              <ColourSelect value={colour} onChange={setColour} automaticLabel="Automatic" />
            </label>

            <label className={styles.stack}>
              <span className={styles.caption}>Underline style:</span>
              <select
                className={styles.input}
                value={underlineStyle}
                onChange={(event) => setUnderlineStyleValue(event.target.value as UnderlineStyle | '')}
              >
                <option value="">(none)</option>
                {UNDERLINE_STYLES.map((entry) => (
                  <option key={entry.value} value={entry.value}>
                    {entry.label}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.stack}>
              <span className={styles.caption}>Underline colour:</span>
              {/* Word greys this out until an underline is chosen, because a
                  colour with no line to paint is not a state a document has. */}
              <ColourSelect
                value={underlineColour}
                onChange={setUnderlineColour}
                automaticLabel="Automatic"
                disabled={underlineStyle === ''}
              />
            </label>
          </div>

          <fieldset className={styles.group}>
            <legend className={styles.legend}>Effects</legend>
            <div className={styles.effects}>
              <Check label="Strikethrough" checked={strike} onChange={setStrike} />
              <Check label="Small caps" checked={caps === 'small'} onChange={(on) => setCapsValue(on ? 'small' : null)} />
              <Check label="Double strikethrough" checked={doubleStrike} onChange={setDouble} />
              <Check label="All caps" checked={caps === 'all'} onChange={(on) => setCapsValue(on ? 'all' : null)} />
              <Check
                label="Superscript"
                checked={superscript}
                onChange={(on) => {
                  setSuperscript(on);
                  if (on) setSubscript(false);
                }}
              />
              <Check label="Hidden" checked={hidden} onChange={setHidden} />
              <Check
                label="Subscript"
                checked={subscript}
                onChange={(on) => {
                  setSubscript(on);
                  if (on) setSuperscript(false);
                }}
              />
              <label className={styles.choice}>
                <span className={styles.caption}>Emboss / Engrave:</span>
                <select
                  className={styles.input}
                  value={effect ?? ''}
                  onChange={(event) => setEffect((event.target.value || null) as TextEffect | null)}
                >
                  <option value="">None</option>
                  <option value="emboss">Emboss</option>
                  <option value="engrave">Engrave</option>
                </select>
              </label>
            </div>
          </fieldset>
        </>
      ) : (
        <fieldset className={styles.group}>
          <legend className={styles.legend}>Character Spacing</legend>

          <div className={styles.field}>
            <label htmlFor="font-scale">Scale:</label>
            <select
              id="font-scale"
              className={styles.input}
              value={scale}
              onChange={(event) => setScale(Number(event.target.value))}
            >
              {CHARACTER_SCALE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}%
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label htmlFor="font-spacing">Spacing:</label>
            <select
              id="font-spacing"
              className={styles.input}
              value={spacingMode}
              onChange={(event) => setSpacingMode(event.target.value as SpacingMode)}
            >
              <option value="normal">Normal</option>
              <option value="expanded">Expanded</option>
              <option value="condensed">Condensed</option>
            </select>

            <label htmlFor="font-spacing-by" className={styles.by}>
              By:
            </label>
            <input
              id="font-spacing-by"
              type="number"
              className={styles.number}
              min={0}
              max={20}
              step={0.1}
              value={spacingBy}
              disabled={spacingMode === 'normal'}
              onChange={(event) => setSpacingBy(Number(event.target.value))}
            />
            <span className={styles.unit}>pt</span>
          </div>
        </fieldset>
      )}

      <div className={styles.previewBox}>
        <span className={styles.previewCaption}>Preview</span>
        <p className={styles.preview} data-effect={effect ?? undefined} style={previewStyle}>
          <span
            style={
              underlineStyle === ''
                ? undefined
                : parseCss(underlineCss(underlineStyle, underlineColour || null))
            }
          >
            Sample
          </span>
        </p>
      </div>
    </Dialog>
  );
}

function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className={styles.choice}>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  );
}

/** A colour well with the palette the ribbon's pickers offer. */
function ColourSelect({
  value,
  onChange,
  automaticLabel,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  automaticLabel: string;
  disabled?: boolean;
}) {
  return (
    <select
      className={styles.input}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">{automaticLabel}</option>
      {THEME_PALETTE.flat().map((colour) => (
        <option key={colour} value={colour}>
          {colour}
        </option>
      ))}
    </select>
  );
}

/** A declaration string as React style properties. */
function parseCss(css: string): Record<string, string> {
  const properties: Record<string, string> = {};
  for (const declaration of css.split(';')) {
    const [property, ...rest] = declaration.split(':');
    if (!property || rest.length === 0) continue;
    properties[property.trim().replace(/-([a-z])/g, (_m, letter: string) => letter.toUpperCase())] = rest
      .join(':')
      .trim();
  }
  return properties;
}
