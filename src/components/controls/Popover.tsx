'use client';

import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import styles from './Popover.module.css';

/**
 * The dismissal and positioning behaviour shared by every ribbon menu.
 *
 * The panel is rendered into `document.body` rather than beside its trigger.
 * An absolutely-positioned child is clipped by any ancestor that establishes a
 * scroll container, and the ribbon is full of them — a menu opened from the
 * Font group would be cut off at the group's edge instead of floating over the
 * document. A portal plus fixed positioning takes the panel out of that
 * hierarchy entirely, so it always overlays the page.
 */
export interface PopoverProps {
  /** Renders the trigger. `open` lets it show a pressed state. */
  trigger: (props: { open: boolean; toggle: () => void; id: string; controls: string }) => ReactNode;
  children: (props: { close: () => void }) => ReactNode;
  /** Menus that hang off the right edge of a group open right-aligned. */
  align?: 'start' | 'end';
  className?: string;
}

/** Breathing room kept between a menu and the bottom of the viewport. */
const VIEWPORT_MARGIN = 8;

export function Popover({ trigger, children, align = 'start', className }: PopoverProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<CSSProperties | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerId = useId();
  const panelId = useId();

  const close = useCallback(() => setOpen(false), []);

  const toggle = useCallback(() => {
    // Clearing the measured position here rather than in the effect keeps the
    // reset in an event handler, and means a reopened menu never paints for a
    // frame at wherever its trigger used to be.
    setPosition(null);
    setOpen((value) => !value);
  }, []);

  // Measure the trigger and pin the panel beneath it. Re-measured on scroll and
  // resize because fixed positioning does not follow the anchor on its own.
  useEffect(() => {
    if (!open) return;

    const measure = (): void => {
      const anchor = containerRef.current?.querySelector<HTMLElement>('[data-popover-trigger]');
      if (!anchor) return;

      const rect = anchor.getBoundingClientRect();
      setPosition({
        position: 'fixed',
        top: rect.bottom + 1,
        ...(align === 'end'
          ? { right: Math.max(VIEWPORT_MARGIN, window.innerWidth - rect.right) }
          : { left: Math.min(rect.left, window.innerWidth - rect.width - VIEWPORT_MARGIN) }),
        minWidth: rect.width,
        maxHeight: window.innerHeight - rect.bottom - VIEWPORT_MARGIN * 2,
      });
    };

    measure();
    window.addEventListener('resize', measure);
    // Capture phase, so scrolling of any ancestor container is picked up.
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [open, align]);

  const wasOpen = useRef(false);
  useEffect(() => {
    // Focus goes back to the trigger so keyboard users are not dropped at the
    // top of the document after using a menu. Pointer users keep their caret:
    // the menu's buttons suppress focus, so `activeElement` is still the
    // editor and this restore is skipped.
    if (wasOpen.current && !open) {
      const active = document.activeElement;
      const insideMenu =
        active === null ||
        active === document.body ||
        containerRef.current?.contains(active) ||
        panelRef.current?.contains(active);
      if (insideMenu) {
        containerRef.current?.querySelector<HTMLElement>('[data-popover-trigger]')?.focus();
      }
    }
    wasOpen.current = open;
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target as Node;
      // The panel lives in a portal, so it is not inside the container — both
      // have to be checked or clicking a menu item would dismiss the menu
      // before the item's own click handler ever ran.
      if (containerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setOpen(false);
      }
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className={`${styles.container} ${className ?? ''}`} ref={containerRef}>
      {trigger({ open, toggle, id: triggerId, controls: panelId })}

      {open && position
        ? createPortal(
            <div
              ref={panelRef}
              id={panelId}
              role="menu"
              aria-labelledby={triggerId}
              className={styles.panel}
              style={position}
            >
              {children({ close })}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
