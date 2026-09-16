import type { TourPlacement } from './tourSteps';

/**
 * Where the tooltip goes, relative to the spotlighted element.
 *
 * Pure and DOM-free — the same reasoning `otpPolicy.ts` gives for staying
 * pure applies here: the only interesting behaviour (does it flip when the
 * preferred side has no room, does it clamp inside the viewport) is a
 * boundary condition on plain numbers, and is what's worth testing without a
 * browser.
 */

export interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface PlacementResult {
  top: number;
  left: number;
  /** The side actually used — may differ from `preferred` if it didn't fit. */
  placement: TourPlacement;
}

/** Space kept between the tooltip and the element it points at. */
const GAP = 14;
/** Minimum distance the tooltip is kept from any viewport edge. */
const MARGIN = 12;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

export function computeTooltipPosition(
  target: Rect,
  preferred: TourPlacement,
  tooltip: Size,
  viewport: Size,
): PlacementResult {
  const roomAbove = target.top;
  const roomBelow = viewport.height - (target.top + target.height);
  const roomLeft = target.left;
  const roomRight = viewport.width - (target.left + target.width);

  // If the preferred side doesn't have room for the tooltip, fall back to
  // whichever side on the same axis has more of it — never abandon the
  // axis entirely, so a "left" step never surprises with a "top" tooltip.
  const vertical: TourPlacement =
    preferred === 'top' || preferred === 'bottom'
      ? (preferred === 'top' ? roomAbove : roomBelow) >= tooltip.height + GAP
        ? preferred
        : roomBelow > roomAbove
          ? 'bottom'
          : 'top'
      : preferred;

  const horizontal: TourPlacement =
    preferred === 'left' || preferred === 'right'
      ? (preferred === 'left' ? roomLeft : roomRight) >= tooltip.width + GAP
        ? preferred
        : roomRight > roomLeft
          ? 'right'
          : 'left'
      : preferred;

  const placement = preferred === 'top' || preferred === 'bottom' ? vertical : horizontal;

  if (placement === 'top' || placement === 'bottom') {
    const top = placement === 'top' ? target.top - tooltip.height - GAP : target.top + target.height + GAP;
    const idealLeft = target.left + target.width / 2 - tooltip.width / 2;
    const left = clamp(idealLeft, MARGIN, viewport.width - tooltip.width - MARGIN);
    return { top: clamp(top, MARGIN, viewport.height - tooltip.height - MARGIN), left, placement };
  }

  const left = placement === 'left' ? target.left - tooltip.width - GAP : target.left + target.width + GAP;
  const idealTop = target.top + target.height / 2 - tooltip.height / 2;
  const top = clamp(idealTop, MARGIN, viewport.height - tooltip.height - MARGIN);
  return { top, left: clamp(left, MARGIN, viewport.width - tooltip.width - MARGIN), placement };
}
