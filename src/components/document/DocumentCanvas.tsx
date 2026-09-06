'use client';

import { useEffect, useRef, useState } from 'react';
import { EditorContent, type Editor } from '@tiptap/react';
import { MARGIN_PRESETS, pageSize, useUiStore } from '@/state/uiStore';
import { Ruler } from './Ruler';
import styles from './DocumentCanvas.module.css';

export interface DocumentCanvasProps {
  editor: Editor;
  /** Reports the estimated page count so the status bar can display it. */
  onPageCountChange: (pages: number) => void;
}

/**
 * The scrollable page surface.
 *
 * The document is rendered as one continuous sheet at page width rather than
 * being split into discrete pages: real pagination requires a layout engine
 * that measures and breaks content, which this build does not have. The page
 * count in the status bar is therefore an estimate derived from content height,
 * and the README says so rather than the number implying more than it means.
 */
export function DocumentCanvas({ editor, onPageCountChange }: DocumentCanvasProps) {
  const zoom = useUiStore((state) => state.zoom);
  const orientation = useUiStore((state) => state.orientation);
  const paper = useUiStore((state) => state.paper);
  const marginPreset = useUiStore((state) => state.margins);
  const showRuler = useUiStore((state) => state.showRuler);
  const showGridlines = useUiStore((state) => state.showGridlines);
  const showFormattingMarks = useUiStore((state) => state.showFormattingMarks);
  const columns = useUiStore((state) => state.columns);
  const pageColor = useUiStore((state) => state.pageColor);
  const watermark = useUiStore((state) => state.watermark);
  const pageBorder = useUiStore((state) => state.pageBorder);
  const viewMode = useUiStore((state) => state.viewMode);

  const margins = MARGIN_PRESETS[marginPreset];
  const { width, height } = pageSize(orientation, paper);
  const usableHeight = height - margins.top - margins.bottom;

  const pageRef = useRef<HTMLDivElement>(null);
  const [pageHeight, setPageHeight] = useState(height);

  useEffect(() => {
    const element = pageRef.current;
    if (!element) return;

    // The sheet grows with its content, so the page count is recomputed
    // whenever the rendered height changes rather than on every keystroke.
    const observer = new ResizeObserver(() => {
      const contentHeight = element.scrollHeight - margins.top - margins.bottom;
      setPageHeight(Math.max(height, element.scrollHeight));
      onPageCountChange(Math.max(1, Math.ceil(contentHeight / usableHeight)));
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [height, margins.top, margins.bottom, usableHeight, onPageCountChange]);

  return (
    <div className={styles.canvas}>
      <div className={styles.scroll} data-page-column>
        {/*
          Ruler and sheet share one scroll container and one width, so they stay
          aligned when the page is wider than the column and cannot spill over
          the side panels.
        */}
        <div className={styles.content} style={{ width: width * zoom }}>
          {showRuler && viewMode === 'print' ? (
            <Ruler pageWidth={width} marginLeft={margins.left} marginRight={margins.right} zoom={zoom} />
          ) : null}

          {/* The scaled sheet is wrapped so the scroll container reserves the
              zoomed footprint — a transform alone does not affect layout size. */}
          <div className={styles.sizer} style={{ width: width * zoom, height: pageHeight * zoom }}>
            <div
              ref={pageRef}
              className={[
                styles.page,
                styles[viewMode] ?? '',
                showGridlines ? styles.gridlines : '',
                showFormattingMarks ? styles.marks : '',
              ].join(' ')}
              style={{
                width,
                minHeight: height,
                paddingTop: margins.top,
                paddingRight: margins.right,
                paddingBottom: margins.bottom,
                paddingLeft: margins.left,
                transform: `scale(${zoom})`,
                ...(pageColor ? { background: pageColor } : {}),
              }}
              onClick={() => editor.commands.focus()}
            >
              {/*
                Drawn behind the text and hidden from the accessibility tree: a
                watermark is page decoration, not content, and the document the
                candidate is marked on must not gain a word from it.
              */}
              {watermark ? (
                <span className={styles.watermark} aria-hidden="true">
                  {watermark}
                </span>
              ) : null}

              {pageBorder ? <span className={styles.pageBorder} aria-hidden="true" /> : null}

              <div className={styles.columnFlow} style={columns > 1 ? { columnCount: columns } : undefined}>
                <EditorContent editor={editor} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
