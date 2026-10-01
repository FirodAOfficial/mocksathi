import { describe, expect, it } from 'vitest';
import {
  MAX_POINTS_PER_STROKE,
  appendPoint,
  eraseAt,
  replayDuration,
  replayTimeline,
  strokeLength,
  strokePath,
  type InkStroke,
} from './ink';

const stroke = (points: number[], width = 2): InkStroke => ({
  tool: 'pen',
  colour: '#000000',
  width,
  points,
});

describe('appendPoint', () => {
  it('takes the first point whatever it is', () => {
    expect(appendPoint([], 10, 20)).toEqual([10, 20]);
  });

  /*
   * Every kept point is two more numbers in the submitted answer, and a
   * pointer reports far more positions than a line needs.
   */
  it('drops a point too close to the last to change the line', () => {
    expect(appendPoint([10, 20], 10.5, 20.5)).toEqual([10, 20]);
  });

  it('keeps a point far enough to matter', () => {
    expect(appendPoint([10, 20], 14, 20)).toEqual([10, 20, 14, 20]);
  });

  it('stops recording rather than growing without limit', () => {
    const full = Array.from({ length: MAX_POINTS_PER_STROKE * 2 }, (_, i) => i);
    expect(appendPoint(full, 9999, 9999)).toHaveLength(full.length);
  });
});

describe('strokePath', () => {
  it('draws a tap as a zero-length line, so the round cap paints a dot', () => {
    expect(strokePath([5, 6])).toBe('M5 6L5 6');
  });

  it('curves through the midpoints rather than joining samples with corners', () => {
    const path = strokePath([0, 0, 10, 0, 20, 0]);

    expect(path.startsWith('M0 0')).toBe(true);
    expect(path).toContain('Q');
    expect(path.endsWith('L20 0')).toBe(true);
  });
});

describe('eraseAt', () => {
  const horizontal = stroke([0, 0, 100, 0]);

  it('removes a stroke the eraser passes over', () => {
    expect(eraseAt([horizontal], 50, 0, 6)).toEqual([]);
  });

  it('leaves a stroke the eraser misses', () => {
    expect(eraseAt([horizontal], 50, 80, 6)).toEqual([horizontal]);
  });

  /* The nib's own width counts: a fat highlighter line is hit from further out. */
  it('hits a wide stroke from further away than a thin one', () => {
    const thin = stroke([0, 0, 100, 0], 2);
    const fat = stroke([0, 0, 100, 0], 30);

    expect(eraseAt([thin], 50, 12, 4)).toEqual([thin]);
    expect(eraseAt([fat], 50, 12, 4)).toEqual([]);
  });

  /*
   * A whole stroke goes, never a hole through it. Splitting would leave two
   * strokes where the candidate drew one.
   */
  it('takes the whole stroke, not the part under the eraser', () => {
    const long = stroke([0, 0, 200, 0]);
    expect(eraseAt([long], 10, 0, 4)).toEqual([]);
  });

  it('erases a single-point stroke by proximity to that point', () => {
    const dot = stroke([40, 40]);
    expect(eraseAt([dot], 41, 41, 4)).toEqual([]);
    expect(eraseAt([dot], 90, 90, 4)).toEqual([dot]);
  });
});

describe('replayTimeline', () => {
  it('runs the strokes one after another, never overlapping', () => {
    const timeline = replayTimeline([stroke([0, 0, 50, 0]), stroke([0, 10, 80, 10])]);

    expect(timeline).toHaveLength(2);
    expect(timeline[1]!.start).toBeGreaterThanOrEqual(timeline[0]!.start + timeline[0]!.duration);
  });

  /*
   * Nothing stored a timestamp — storing one per point would double the size
   * of every drawing for a feature used once — so the duration comes from the
   * stroke's own length. A long sweep has to take longer than a tick, or the
   * replay reads as strokes appearing rather than as drawing.
   */
  it('gives a longer stroke a longer draw', () => {
    const [short] = replayTimeline([stroke([0, 0, 20, 0])]);
    const [long] = replayTimeline([stroke([0, 0, 400, 0])]);

    expect(long!.duration).toBeGreaterThan(short!.duration);
  });

  it('is empty, and instant, with nothing drawn', () => {
    expect(replayTimeline([])).toEqual([]);
    expect(replayDuration([])).toBe(0);
  });
});

describe('strokeLength', () => {
  it('sums the segments', () => {
    expect(strokeLength([0, 0, 3, 4])).toBe(5);
    expect(strokeLength([0, 0, 3, 4, 3, 14])).toBe(15);
  });
});
