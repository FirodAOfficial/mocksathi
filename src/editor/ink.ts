/**
 * The ink a candidate draws, and the geometry that turns it into a drawing.
 *
 * Pure: no editor, no DOM, no clock. The Draw tab's node view handles pointer
 * events and hands the numbers here, which is what makes the parts worth
 * getting right — smoothing, erasing, replay timing — testable on their own.
 */

export type InkTool = 'pen' | 'pencil' | 'highlighter' | 'eraser';

export interface InkStroke {
  /** Which pen drew it. The eraser removes strokes; it never stores one. */
  tool: Exclude<InkTool, 'eraser'>;
  colour: string;
  /** Nib width in canvas units. */
  width: number;
  /** `[x0, y0, x1, y1, …]`, flat so a stroke stays small in the answer JSON. */
  points: number[];
}

/**
 * The drawing surface's coordinate space.
 *
 * Strokes are stored in these units and the canvas is scaled to fit, so a
 * drawing made on a laptop reads the same on a landscape phone and does not
 * have to be remade when the window changes size.
 */
export const INK_WIDTH = 816;
export const INK_HEIGHT = 320;

/** A full canvas of ink, capped so one drawing cannot swell the submission. */
export const MAX_STROKES = 400;

/** Points per stroke, past which the stroke stops recording. */
export const MAX_POINTS_PER_STROKE = 600;

export const PEN_WIDTHS = [1, 2, 4, 8] as const;

export const INK_COLOURS = [
  { id: 'black', label: 'Black', value: '#000000' },
  { id: 'blue', label: 'Blue', value: '#1c6ef2' },
  { id: 'red', label: 'Red', value: '#c0392b' },
  { id: 'green', label: 'Green', value: '#2e7d32' },
  { id: 'yellow', label: 'Yellow', value: '#f2c200' },
  { id: 'pink', label: 'Pink', value: '#e5469b' },
] as const;

/** The highlighter is wide and translucent; the pencil is thin and grainy. */
export function defaultWidthFor(tool: InkTool): number {
  if (tool === 'highlighter') return 16;
  if (tool === 'pencil') return 1;
  return 2;
}

export function opacityFor(tool: InkStroke['tool']): number {
  return tool === 'highlighter' ? 0.38 : 1;
}

/**
 * Drops points that add nothing.
 *
 * A pointer reports far more positions than a line needs, and every one of
 * them is two numbers in the submitted answer. Anything closer than
 * `minDistance` to the last kept point is the same place as far as the drawing
 * is concerned.
 */
export function appendPoint(points: number[], x: number, y: number, minDistance = 1.6): number[] {
  if (points.length >= MAX_POINTS_PER_STROKE * 2) return points;
  if (points.length === 0) return [x, y];

  const lastX = points[points.length - 2] ?? 0;
  const lastY = points[points.length - 1] ?? 0;
  if (Math.hypot(x - lastX, y - lastY) < minDistance) return points;

  return [...points, x, y];
}

/**
 * The SVG path for a stroke, smoothed through the midpoints.
 *
 * A polyline through raw pointer samples looks like what it is — a chain of
 * straight segments with visible corners. Curving each segment through the
 * midpoint of its neighbours costs one quadratic per point and turns the same
 * samples into a line that reads as handwriting.
 */
export function strokePath(points: number[]): string {
  if (points.length < 4) {
    // A tap: a dot, drawn as a zero-length line so the round cap paints it.
    const x = points[0] ?? 0;
    const y = points[1] ?? 0;
    return `M${x} ${y}L${x} ${y}`;
  }

  let path = `M${points[0]} ${points[1]}`;
  for (let i = 2; i < points.length - 2; i += 2) {
    const x = points[i] as number;
    const y = points[i + 1] as number;
    const midX = (x + (points[i + 2] as number)) / 2;
    const midY = (y + (points[i + 3] as number)) / 2;
    path += `Q${x} ${y} ${midX} ${midY}`;
  }

  return `${path}L${points[points.length - 2]} ${points[points.length - 1]}`;
}

/**
 * The strokes left after erasing at a point.
 *
 * Word's eraser takes a whole stroke, not a hole through it, and so does this:
 * a stroke whose line passes within `radius` of the point is removed entire.
 * Splitting a stroke would leave two strokes where the candidate drew one, and
 * the undo stack would then have to explain that.
 */
export function eraseAt(strokes: InkStroke[], x: number, y: number, radius: number): InkStroke[] {
  return strokes.filter((stroke) => !strokeTouches(stroke, x, y, radius));
}

function strokeTouches(stroke: InkStroke, x: number, y: number, radius: number): boolean {
  // The nib's own width counts: a fat highlighter line is hit from further out.
  const reach = radius + stroke.width / 2;
  const { points } = stroke;

  if (points.length === 2) {
    return Math.hypot(x - (points[0] as number), y - (points[1] as number)) <= reach;
  }

  for (let i = 0; i < points.length - 2; i += 2) {
    const distance = distanceToSegment(
      x,
      y,
      points[i] as number,
      points[i + 1] as number,
      points[i + 2] as number,
      points[i + 3] as number,
    );
    if (distance <= reach) return true;
  }

  return false;
}

function distanceToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;

  // A segment of no length is a point; projecting onto it would divide by zero.
  if (lengthSquared === 0) return Math.hypot(px - ax, py - ay);

  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/**
 * How long a replay of these strokes runs, and where each one starts.
 *
 * Replay is not a recording — nothing stored a timestamp, and storing one per
 * point would double the size of every drawing for a feature used once. Each
 * stroke is instead given a duration from its own length, so a long sweep
 * takes longer to redraw than a tick, which is what makes the replay read as
 * the drawing being made rather than as strokes appearing in order.
 */
export function replayTimeline(strokes: InkStroke[], msPerUnit = 1.6, gapMs = 90): { start: number; duration: number }[] {
  let cursor = 0;

  return strokes.map((stroke) => {
    const duration = Math.max(120, Math.min(1800, strokeLength(stroke.points) * msPerUnit));
    const entry = { start: cursor, duration };
    cursor += duration + gapMs;
    return entry;
  });
}

export function strokeLength(points: number[]): number {
  let total = 0;
  for (let i = 0; i < points.length - 2; i += 2) {
    total += Math.hypot(
      (points[i + 2] as number) - (points[i] as number),
      (points[i + 3] as number) - (points[i + 1] as number),
    );
  }
  return total;
}

export function replayDuration(strokes: InkStroke[]): number {
  const timeline = replayTimeline(strokes);
  const last = timeline[timeline.length - 1];
  return last ? last.start + last.duration : 0;
}
