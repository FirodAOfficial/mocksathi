'use client';

import { useEffect, useId, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import styles from './Dialog.module.css';

export interface DialogProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /**
   * Whether the document is blocked while this is open.
   *
   * Word's Font and Paragraph dialogs are modal — they are a decision about the
   * selection, and the selection must not move underneath them. Find and
   * Replace is not: you keep working while it is open, which is why it can sit
   * over the page and still let the document scroll, select and update behind
   * it. A modal dialog makes the rest of the page inert, so a modeless one is
   * not a preference here — it is the difference between Find working and Find
   * appearing to do nothing.
   */
  modal?: boolean;
  /**
   * Where it opens.
   *
   * Word puts Find and Replace near the top of the window, clear of the text
   * being searched. Centring it there would cover the match it just found.
   */
  placement?: 'center' | 'top';
}

/** Where the dialog has been dragged to, in viewport pixels. */
interface Position {
  left: number;
  top: number;
}

/**
 * A dialog, modal or modeless, draggable by its title bar.
 *
 * Uses the native `<dialog>` element so the browser provides the stacking and,
 * when modal, the focus containment — rather than reimplementing a focus trap
 * that would inevitably differ from the platform.
 *
 * Dragging is the part Word users reach for without thinking: a dialog that
 * covers the paragraph you are working on is in the way, and every one of
 * Word's own dialogs can be pulled aside by its title bar.
 */
export function Dialog({ title, onClose, children, footer, modal = true, placement = 'center' }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  const [position, setPosition] = useState<Position | null>(null);
  /** Pointer offset within the title bar while a drag is in progress. */
  const grab = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || element.open) return;

    if (modal) element.showModal();
    else element.show();
  }, [modal]);

  /*
   * A modeless dialog gets no `cancel` event, so Escape is wired up by hand.
   * Captured on the document, because the keyboard may well be in the editor
   * behind it — that is the point of a modeless dialog.
   */
  useEffect(() => {
    if (modal) return;

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [modal, onClose]);

  /*
   * The drag listeners live on the document for the dialog's whole life, and do
   * nothing until a drag is in progress.
   *
   * Attaching them on pointerdown and detaching on pointerup would mean two
   * handlers that refer to each other, which is a knot; two idle listeners for
   * as long as a dialog is open is the cheaper thing by far.
   */
  useEffect(() => {
    const onPointerMove = (event: globalThis.PointerEvent): void => {
      const offset = grab.current;
      const element = ref.current;
      if (!offset || !element) return;

      // Kept within the viewport: a dialog dragged off the top has no title bar
      // left to drag it back by.
      const maxLeft = Math.max(0, window.innerWidth - element.offsetWidth);
      const maxTop = Math.max(0, window.innerHeight - element.offsetHeight);

      setPosition({
        left: Math.min(Math.max(0, event.clientX - offset.x), maxLeft),
        top: Math.min(Math.max(0, event.clientY - offset.y), maxTop),
      });
    };

    const onPointerUp = (): void => {
      grab.current = null;
    };

    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);

    return () => {
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
    };
  }, []);

  const startDrag = (event: PointerEvent<HTMLDivElement>): void => {
    // The close button lives in the title bar and is not a handle.
    if ((event.target as HTMLElement).closest('button')) return;

    const element = ref.current;
    if (!element || event.button !== 0) return;

    const box = element.getBoundingClientRect();
    grab.current = { x: event.clientX - box.left, y: event.clientY - box.top };
    // Pin it where it already is, so the first move does not jump.
    setPosition({ left: box.left, top: box.top });
  };

  return (
    <dialog
      ref={ref}
      className={`${styles.dialog} ${placement === 'top' ? styles.top : ''} ${modal ? '' : styles.modeless}`}
      aria-labelledby={titleId}
      /*
       * Once dragged, the dialog is placed by hand: the stylesheet's centring —
       * `margin: auto` for a modal one, a translate for a modeless one — is
       * cleared, or the dialog would sit half a width away from the pointer.
       */
      style={
        position
          ? { left: `${position.left}px`, top: `${position.top}px`, margin: 0, translate: 'none' }
          : undefined
      }
      onCancel={(event) => {
        // Escape fires `cancel`; let React own the open state rather than
        // letting the element close itself out from under it.
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        // Clicking the backdrop lands on the dialog element itself. A modeless
        // dialog has no backdrop, so clicks outside it never arrive here.
        if (modal && event.target === ref.current) onClose();
      }}
    >
      <div className={styles.titleBar} onPointerDown={startDrag}>
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>

      <div className={styles.body}>{children}</div>
      {footer ? <div className={styles.footer}>{footer}</div> : null}
    </dialog>
  );
}
