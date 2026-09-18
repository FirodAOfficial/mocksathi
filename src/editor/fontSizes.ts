/**
 * The font-size ladder, and the range the size box accepts.
 *
 * Its own module because both the ribbon and the keyboard step along it, and
 * the keyboard's bindings live in an extension — which must not import the
 * ribbon's action module, since that is a client module the editor schema is
 * built from.
 */

/** The size ladder Word's Grow/Shrink Font buttons step through. */
export const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72] as const;

export const DEFAULT_FONT_SIZE_PT = 11;

/**
 * The range the size box accepts, matching Word.
 *
 * `FONT_SIZES` is only the drop-down's shortlist — it skips 13 and 15, so a
 * question asking for either is answered by typing into the box.
 */
export const MIN_FONT_SIZE_PT = 1;
export const MAX_FONT_SIZE_PT = 1638;

/** The next size up or down the ladder from `current`. */
export function steppedFontSize(current: number, direction: 1 | -1): number {
  const sizes = [...FONT_SIZES];
  const index = sizes.findIndex((size) => size >= current);
  const base = index === -1 ? sizes.length - 1 : index;
  return sizes[Math.min(sizes.length - 1, Math.max(0, base + direction))] ?? DEFAULT_FONT_SIZE_PT;
}
