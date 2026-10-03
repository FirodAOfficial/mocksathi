'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { Popover } from '@/components/controls/Popover';
import { Icon, type IconName } from '@/components/icons/Icon';
import { RibbonGroup } from '@/components/ribbon/RibbonGroup';
import styles from './SpreadsheetRibbon.module.css';

/**
 * A Home tab group that folds into one button when the ribbon runs out of room.
 *
 * Excel does this on a narrow window: Font becomes a single "A" with an arrow,
 * and the arrow drops the whole Font group down beneath it — the same controls,
 * the same launcher, just not taking a ribbon's width all the time.
 */

/**
 * The order groups fold in, first to last — Excel's: the galleries go before
 * the formatting a candidate reaches for most.
 */
export const COLLAPSE_ORDER = ['Styles', 'Cells', 'Editing', 'Number', 'Alignment', 'Font'] as const;
export type CollapsibleGroupName = (typeof COLLAPSE_ORDER)[number];

/** How many of `COLLAPSE_ORDER` are folded right now; set by the ribbon. */
export const RibbonCollapseContext = createContext(0);

export interface CollapsibleGroupProps {
  label: CollapsibleGroupName;
  glyph?: ReactNode;
  icon?: IconName;
  onLaunch?: () => void;
  launchLabel?: string;
  children: ReactNode;
}

export function CollapsibleGroup({ label, glyph, icon, onLaunch, launchLabel, children }: CollapsibleGroupProps) {
  const folded = COLLAPSE_ORDER.indexOf(label) < useContext(RibbonCollapseContext);

  const group = (
    <RibbonGroup label={label} {...(onLaunch ? { onLaunch, launchLabel } : {})}>
      {children}
    </RibbonGroup>
  );

  if (!folded) return group;

  return (
    <section className={styles.foldedGroup} aria-label={`${label} group`}>
      <Popover
        trigger={({ open, toggle, id, controls }) => (
          <button
            id={id}
            type="button"
            data-popover-trigger
            className={`${styles.menuTrigger} ${styles.foldedTrigger} ${open ? styles.menuTriggerOpen : ''}`}
            aria-haspopup="true"
            aria-expanded={open}
            aria-controls={open ? controls : undefined}
            title={label}
            onMouseDown={(event) => event.preventDefault()}
            onClick={toggle}
          >
            <span className={styles.foldedGlyph} aria-hidden="true">
              {icon ? <Icon name={icon} size={26} /> : glyph}
            </span>
            <span className={styles.menuCaption}>{label}</span>
            <span className={styles.menuCaret} aria-hidden="true">
              ▾
            </span>
          </button>
        )}
      >
        {() => <div className={styles.foldedPanel}>{group}</div>}
      </Popover>
    </section>
  );
}
