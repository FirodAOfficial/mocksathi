'use client';

import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  INK_HEIGHT,
  INK_WIDTH,
  MAX_STROKES,
  appendPoint,
  eraseAt,
  opacityFor,
  replayTimeline,
  strokePath,
  type InkStroke,
} from '@/editor/ink';
import { useUiStore } from '@/state/uiStore';
import styles from './DrawingCanvasView.module.css';

/**
 * A drawing canvas, as it appears in the document.
 *
 * An SVG rather than a `<canvas>`: the strokes are already vectors, SVG scales
 * with the sheet's zoom without being redrawn, and a stroke is a DOM element,
 * which is what makes the replay animation a stylesheet rather than a loop.
 *
 * The pointer is only taken when a pen is chosen in the Draw tab. With Select
 * — the default — this is an ordinary block: clicking it selects the node, and
 * the candidate is editing text as usual. That is the difference between a
 * drawing surface and a trap for a misplaced click.
 */
export function DrawingCanvasView({ node, updateAttributes, selected, editor }: NodeViewProps) {
  const strokes = (node.attrs.strokes ?? []) as InkStroke[];

  const inkTool = useUiStore((state) => state.inkTool);
  const inkColour = useUiStore((state) => state.inkColour);
  const inkWidth = useUiStore((state) => state.inkWidth);
  const setNotice = useUiStore((state) => state.setNotice);

  const svgRef = useRef<SVGSVGElement>(null);

  /*
   * The stroke being drawn, in a ref *and* in state.
   *
   * The ref is the truth and the state is only there to re-render the line as
   * it grows. It has to be a ref: a quick tap delivers `pointerdown` and
   * `pointerup` in the same task, React has not re-rendered in between, and a
   * handler reading the state would see the value from before the stroke
   * started — and drop it. That is not a synthetic-event quirk; it is what a
   * fast flick of a real pen does.
   */
  const liveRef = useRef<InkStroke | null>(null);
  const [live, setLive] = useState<InkStroke | null>(null);

  const setLiveStroke = (next: InkStroke | null): void => {
    liveRef.current = next;
    setLive(next);
  };
  const [replayAt, setReplayAt] = useState<number | null>(null);

  const drawing = inkTool !== null && editor.isEditable;

  /** Pointer position in the canvas's own units, whatever the sheet's zoom. */
  const pointIn = useCallback((event: ReactPointerEvent<SVGSVGElement>): [number, number] => {
    const box = svgRef.current?.getBoundingClientRect();
    if (!box || box.width === 0) return [0, 0];
    return [
      ((event.clientX - box.left) / box.width) * INK_WIDTH,
      ((event.clientY - box.top) / box.height) * INK_HEIGHT,
    ];
  }, []);

  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>): void => {
    if (!drawing) return;
    event.preventDefault();
    // Captured so a stroke that leaves the canvas still ends on this element,
    // rather than being left open when the pointer comes back.
    event.currentTarget.setPointerCapture(event.pointerId);

    const [x, y] = pointIn(event);

    if (inkTool === 'eraser') {
      updateAttributes({ strokes: eraseAt(strokes, x, y, 8) });
      return;
    }

    if (strokes.length >= MAX_STROKES) {
      setNotice(`This canvas is full at ${MAX_STROKES} strokes. Insert another, or erase some.`);
      return;
    }

    setLiveStroke({ tool: inkTool, colour: inkColour, width: inkWidth, points: [x, y] });
  };

  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>): void => {
    if (!drawing) return;
    const [x, y] = pointIn(event);

    if (inkTool === 'eraser') {
      // Only while the button is held: hovering must not rub anything out.
      if (event.buttons === 0) return;
      const left = eraseAt(strokes, x, y, 8);
      if (left.length !== strokes.length) updateAttributes({ strokes: left });
      return;
    }

    const current = liveRef.current;
    if (!current) return;
    setLiveStroke({ ...current, points: appendPoint(current.points, x, y) });
  };

  /*
   * The finished stroke goes into the document in one write.
   *
   * Writing every sample would put a hundred transactions in the undo stack
   * for one pen stroke, and Undo after drawing a line has to remove the line.
   */
  const endStroke = (): void => {
    const finished = liveRef.current;
    if (!finished) return;
    updateAttributes({ strokes: [...strokes, finished] });
    setLiveStroke(null);
  };

  const timeline = replayTimeline(strokes);

  /** Replay runs on a clock here and is drawn by `stroke-dashoffset` in CSS. */
  useEffect(() => {
    if (replayAt === null) return;
    const last = timeline[timeline.length - 1];
    const total = last ? last.start + last.duration : 0;
    const timer = setTimeout(() => setReplayAt(null), total + 200);
    return () => clearTimeout(timer);
  }, [replayAt, timeline]);

  const shown = live ? [...strokes, live] : strokes;

  return (
    <NodeViewWrapper
      className={`${styles.wrapper} ${selected ? styles.selected : ''}`}
      data-drawing-canvas=""
      data-replaying={replayAt !== null ? '' : undefined}
    >
      <svg
        ref={svgRef}
        className={`${styles.canvas} ${drawing ? styles.drawing : ''}`}
        viewBox={`0 0 ${INK_WIDTH} ${INK_HEIGHT}`}
        role="img"
        aria-label={`Drawing canvas, ${strokes.length} ${strokes.length === 1 ? 'stroke' : 'strokes'}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endStroke}
        onPointerCancel={endStroke}
      >
        {shown.map((stroke, index) => {
          const entry = timeline[index];
          return (
            <path
              key={index}
              className={styles.stroke}
              d={strokePath(stroke.points)}
              stroke={stroke.colour}
              strokeWidth={stroke.width}
              strokeOpacity={opacityFor(stroke.tool)}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={
                replayAt !== null && entry
                  ? { animationDelay: `${entry.start}ms`, animationDuration: `${entry.duration}ms` }
                  : undefined
              }
            />
          );
        })}
      </svg>

      {strokes.length === 0 && !live ? (
        <p className={styles.hint}>
          {drawing ? 'Draw here.' : 'Pick a pen on the Draw tab to write here.'}
        </p>
      ) : null}

      {/*
        Replay belongs to the canvas being replayed, not to the ribbon: the
        document may hold several, and "play the ink" has to mean one of them.
        The ribbon's Ink Replay button clicks this.
      */}
      <button
        type="button"
        className={styles.replay}
        data-ink-replay=""
        disabled={strokes.length === 0}
        title={strokes.length === 0 ? 'Nothing has been drawn here yet' : 'Replay this drawing'}
        aria-label="Replay this drawing"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setReplayAt(Date.now())}
      >
        ▶
      </button>
    </NodeViewWrapper>
  );
}
