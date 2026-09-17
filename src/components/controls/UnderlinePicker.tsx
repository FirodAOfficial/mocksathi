'use client';

import { UNDERLINE_STYLES, underlineCss, type UnderlineStyle } from '@/editor/functions/underline';
import { Icon } from '../icons/Icon';
import { Popover } from './Popover';
import { THEME_PALETTE } from './ColorPicker';
import styles from './UnderlinePicker.module.css';

/** The specimen's content: spaces for the line to be drawn under. */
const NBSP = ' ';

export interface UnderlinePickerProps {
  /** Whether the selection is underlined at all. */
  active: boolean;
  /** The style in force, for the tick beside it. */
  style: UnderlineStyle;
  color: string | null;
  /** The button itself: underline, or remove the underline. */
  onToggle: () => void;
  /** A style from the list, or null for None. */
  onSelectStyle: (style: UnderlineStyle | null) => void;
  onSelectColour: (color: string | null) => void;
  /** Opens the Font dialog, where More Underlines lives. */
  onMoreUnderlines: () => void;
}

/**
 * Word's Underline split button.
 *
 * The left half underlines with a single line, as the button always did; the
 * arrow opens the styles. Each entry draws its own line rather than naming it,
 * because that is how the menu is read — you pick the line that looks right,
 * and the label under it is a fallback for a screen reader.
 */
export function UnderlinePicker({
  active,
  style,
  color,
  onToggle,
  onSelectStyle,
  onSelectColour,
  onMoreUnderlines,
}: UnderlinePickerProps) {
  return (
    <div className={styles.split}>
      <button
        type="button"
        className={`${styles.main} ${active ? styles.active : ''}`}
        title="Underline"
        aria-label="Underline"
        aria-pressed={active}
        onMouseDown={(event) => event.preventDefault()}
        onClick={onToggle}
      >
        <u>U</u>
      </button>

      <Popover
        align="start"
        trigger={({ open, toggle, id, controls }) => (
          <button
            id={id}
            type="button"
            data-popover-trigger
            className={`${styles.arrow} ${open ? styles.arrowOpen : ''}`}
            aria-haspopup="menu"
            aria-expanded={open}
            aria-controls={open ? controls : undefined}
            aria-label="Underline styles"
            title="Underline styles"
            onMouseDown={(event) => event.preventDefault()}
            onClick={toggle}
          >
            <Icon name="chevron-down" size={12} />
          </button>
        )}
      >
        {({ close }) => (
          <div className={styles.menu}>
            {UNDERLINE_STYLES.map((entry) => (
              <button
                key={entry.value}
                type="button"
                role="menuitemradio"
                aria-checked={active && style === entry.value}
                aria-label={`${entry.label} underline`}
                className={`${styles.styleItem} ${active && style === entry.value ? styles.selected : ''}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onSelectStyle(entry.value);
                  close();
                }}
              >
                {/* The specimen is the control: a line drawn the way the
                    style draws it, exactly as Word's menu shows. */}
                <span className={styles.specimen} aria-hidden="true" style={cssProperties(entry.value, color)}>
                  {NBSP.repeat(24)}
                </span>
              </button>
            ))}

            <div className={styles.separator} role="separator" />

            <button
              type="button"
              role="menuitem"
              className={styles.item}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onSelectStyle(null);
                close();
              }}
            >
              None
            </button>

            <button
              type="button"
              role="menuitem"
              className={styles.item}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onMoreUnderlines();
                close();
              }}
            >
              More Underlines…
            </button>

            <div className={styles.separator} role="separator" />

            <div className={styles.colourHeading} id="underline-colour-heading">
              Underline Colour
            </div>
            <div className={styles.palette} role="group" aria-labelledby="underline-colour-heading">
              <button
                type="button"
                className={styles.item}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onSelectColour(null);
                  close();
                }}
              >
                Automatic
              </button>
              {THEME_PALETTE.map((row, index) => (
                <div key={index} className={styles.swatchRow}>
                  {row.map((swatch) => (
                    <button
                      key={swatch}
                      type="button"
                      className={`${styles.swatch} ${color === swatch ? styles.swatchSelected : ''}`}
                      style={{ background: swatch }}
                      title={swatch}
                      aria-label={swatch}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        onSelectColour(swatch);
                        close();
                      }}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </Popover>
    </div>
  );
}

/**
 * The style's own CSS, as React style properties.
 *
 * `underlineCss` returns a declaration string because that is what the editor
 * schema needs; parsing it back here keeps one definition of how each style is
 * drawn, so the menu cannot show a line the document would not.
 */
function cssProperties(style: UnderlineStyle, colour: string | null): Record<string, string> {
  const properties: Record<string, string> = {};

  for (const declaration of underlineCss(style, colour).split(';')) {
    const [property, ...rest] = declaration.split(':');
    if (!property || rest.length === 0) continue;
    const name = property.trim().replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());
    properties[name] = rest.join(':').trim();
  }

  return properties;
}
