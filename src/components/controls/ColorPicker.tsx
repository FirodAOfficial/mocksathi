'use client';

import { Icon, type IconName } from '../icons/Icon';
import { Popover } from './Popover';
import styles from './ColorPicker.module.css';

/**
 * Word's highlighter offers a fixed set of pure colours, not the theme palette.
 * They are the same values `w:highlight` uses in a .docx, so a highlight
 * applied here and one imported from Word compare equal.
 */
export const HIGHLIGHT_PALETTE: string[][] = [
  ['#ffff00', '#00ff00', '#00ffff', '#ff00ff', '#0000ff'],
  ['#ff0000', '#000080', '#008080', '#008000', '#800080'],
  ['#800000', '#808000', '#808080', '#c0c0c0', '#000000'],
];

/** Office 2010's standard-colour row, plus a grey ramp. */
export const THEME_PALETTE: string[][] = [
  ['#000000', '#404040', '#7f7f7f', '#bfbfbf', '#d9d9d9', '#f2f2f2', '#ffffff'],
  ['#c00000', '#ff0000', '#ffc000', '#ffff00', '#92d050', '#00b050', '#00b0f0'],
  ['#0070c0', '#002060', '#7030a0', '#e36c0a', '#4f6228', '#1f497d', '#948a54'],
];

export interface ColorPickerProps {
  label: string;
  icon: IconName;
  /** The bar under the icon, showing the colour the button would apply. */
  currentColor: string | null;
  /** Applied when the swatch bar itself is clicked. */
  defaultColor: string;
  onSelect: (color: string | null) => void;
  /** Label for the entry that removes the colour. */
  clearLabel: string;
  /** Defaults to the theme palette; the highlighter passes its own set. */
  palette?: string[][];
}

/**
 * Word's split colour button: clicking the icon reapplies the last colour,
 * clicking the arrow opens the palette. Both halves are real buttons so each
 * gets its own accessible name and keyboard stop.
 */
export function ColorPicker({
  label,
  icon,
  currentColor,
  defaultColor,
  onSelect,
  clearLabel,
  palette = THEME_PALETTE,
}: ColorPickerProps) {
  const applied = currentColor ?? defaultColor;

  return (
    <div className={styles.split}>
      <button
        type="button"
        className={styles.main}
        title={`${label} (${applied})`}
        aria-label={`${label}, currently ${applied}`}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => onSelect(applied)}
      >
        <Icon name={icon} size={18} />
        <span className={styles.bar} style={{ background: applied }} />
      </button>

      <Popover
        align="end"
        trigger={({ open, toggle, id, controls }) => (
          <button
            id={id}
            type="button"
            data-popover-trigger
            className={`${styles.arrow} ${open ? styles.arrowOpen : ''}`}
            aria-haspopup="menu"
            aria-expanded={open}
            aria-controls={open ? controls : undefined}
            aria-label={`${label} options`}
            title={`${label} options`}
            onMouseDown={(event) => event.preventDefault()}
            onClick={toggle}
          >
            <Icon name="chevron-down" size={12} />
          </button>
        )}
      >
        {({ close }) => (
          <div className={styles.palette}>
            <button
              type="button"
              role="menuitem"
              className={styles.clear}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onSelect(null);
                close();
              }}
            >
              {clearLabel}
            </button>

            {palette.map((row, index) => (
              <div key={index} className={styles.row}>
                {row.map((color) => (
                  <button
                    key={color}
                    type="button"
                    role="menuitemradio"
                    aria-checked={color === currentColor}
                    className={`${styles.swatch} ${color === currentColor ? styles.swatchSelected : ''}`}
                    style={{ background: color }}
                    title={color}
                    aria-label={color}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      onSelect(color);
                      close();
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
        )}
      </Popover>
    </div>
  );
}
