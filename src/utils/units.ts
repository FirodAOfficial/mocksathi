/**
 * The three units Word's dialogs speak, in the one the model stores.
 *
 * The normalised document model is in CSS pixels throughout (`types.ts`), but
 * nobody types a pixel into Word: the Paragraph dialog asks for indents in
 * centimetres and spacing in points, and a question asks for what the dialog
 * asks for. Converting in one place keeps a rounding difference from turning a
 * correct answer into a failed criterion.
 *
 * 96 px to the inch is the CSS reference pixel, which is what the page geometry
 * in `uiStore.ts` is already built on.
 */

export const PX_PER_INCH = 96;
export const PX_PER_CM = PX_PER_INCH / 2.54;
export const PX_PER_POINT = PX_PER_INCH / 72;

/** Rounded to a whole pixel: the model stores what the browser can lay out. */
export function cmToPx(cm: number): number {
  return Math.round(cm * PX_PER_CM);
}

export function pxToCm(px: number): number {
  // Two decimals is the precision Word's own boxes show.
  return Math.round((px / PX_PER_CM) * 100) / 100;
}

export function pointsToPx(points: number): number {
  return Math.round(points * PX_PER_POINT);
}

export function pxToPoints(px: number): number {
  return Math.round((px / PX_PER_POINT) * 10) / 10;
}

export function inchesToPx(inches: number): number {
  return Math.round(inches * PX_PER_INCH);
}

/** A measurement in whichever unit the question was written in. */
export type LengthUnit = 'cm' | 'inch';

export function lengthToPx(value: number, unit: LengthUnit): number {
  return unit === 'inch' ? inchesToPx(value) : cmToPx(value);
}

/**
 * How close two lengths have to be to count as the same answer.
 *
 * A pixel. Word's own boxes round to two decimals, and a candidate who types
 * 2.79 cm where the question said 1.1 inches has given the same answer as far
 * as anyone looking at the page is concerned — the two differ by a fifth of a
 * pixel before rounding, and by one pixel after it. Any larger tolerance would
 * start accepting indents that are visibly wrong.
 */
export const LENGTH_TOLERANCE_PX = 1;
