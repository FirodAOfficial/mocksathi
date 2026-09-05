'use client';

import styles from './Ruler.module.css';

export interface RulerProps {
  /** Page width in CSS pixels, before zoom. */
  pageWidth: number;
  marginLeft: number;
  marginRight: number;
  zoom: number;
}

/** 96 CSS pixels is one inch, which is the unit the ruler is marked in. */
const PX_PER_INCH = 96;

/**
 * The horizontal ruler.
 *
 * Purely informational — it shows where the text area sits inside the page and
 * marks each inch. It is not interactive: Word's draggable indent markers would
 * be a formatting control, and every formatting control in this build lives in
 * the ribbon.
 */
export function Ruler({ pageWidth, marginLeft, marginRight, zoom }: RulerProps) {
  const inches = Math.floor(pageWidth / PX_PER_INCH);
  const marks = Array.from({ length: inches + 1 }, (_, index) => index);

  return (
    <div className={styles.wrapper} aria-hidden="true">
      <div className={styles.ruler}>
        <div className={styles.margin} style={{ width: marginLeft * zoom }} />
        <div className={styles.marginRight} style={{ width: marginRight * zoom }} />

        {marks.map((inch) => (
          <div key={inch} className={styles.tick} style={{ left: inch * PX_PER_INCH * zoom }} />
        ))}

        {marks.slice(1, -1).map((inch) => (
          <span key={inch} className={styles.label} style={{ left: inch * PX_PER_INCH * zoom }}>
            {inch}
          </span>
        ))}
      </div>
    </div>
  );
}
