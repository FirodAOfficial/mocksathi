import { describe, expect, it } from 'vitest';
import { computeTooltipPosition } from './tourPlacement';

const VIEWPORT = { width: 1200, height: 800 };
const TOOLTIP = { width: 280, height: 140 };

describe('computeTooltipPosition', () => {
  it('places below when there is room', () => {
    const target = { top: 100, left: 500, width: 100, height: 40 };
    const result = computeTooltipPosition(target, 'bottom', TOOLTIP, VIEWPORT);
    expect(result.placement).toBe('bottom');
    expect(result.top).toBe(100 + 40 + 14);
  });

  it('flips to top when "bottom" has no room', () => {
    const target = { top: 750, left: 500, width: 100, height: 40 };
    const result = computeTooltipPosition(target, 'bottom', TOOLTIP, VIEWPORT);
    expect(result.placement).toBe('top');
    expect(result.top).toBe(750 - 140 - 14);
  });

  it('flips to bottom when "top" has no room', () => {
    const target = { top: 20, left: 500, width: 100, height: 40 };
    const result = computeTooltipPosition(target, 'top', TOOLTIP, VIEWPORT);
    expect(result.placement).toBe('bottom');
  });

  it('flips to left when "right" has no room', () => {
    const target = { top: 300, left: 1150, width: 40, height: 40 };
    const result = computeTooltipPosition(target, 'right', TOOLTIP, VIEWPORT);
    expect(result.placement).toBe('left');
  });

  it('flips to right when "left" has no room', () => {
    const target = { top: 300, left: 20, width: 40, height: 40 };
    const result = computeTooltipPosition(target, 'left', TOOLTIP, VIEWPORT);
    expect(result.placement).toBe('right');
  });

  it('clamps horizontally rather than running off the left edge', () => {
    const target = { top: 100, left: 5, width: 20, height: 40 };
    const result = computeTooltipPosition(target, 'bottom', TOOLTIP, VIEWPORT);
    expect(result.left).toBeGreaterThanOrEqual(12);
  });

  it('clamps horizontally rather than running off the right edge', () => {
    const target = { top: 100, left: 1180, width: 20, height: 40 };
    const result = computeTooltipPosition(target, 'bottom', TOOLTIP, VIEWPORT);
    expect(result.left + TOOLTIP.width).toBeLessThanOrEqual(VIEWPORT.width - 12);
  });

  it('centers horizontally on the target for a top/bottom placement', () => {
    const target = { top: 100, left: 500, width: 100, height: 40 };
    const result = computeTooltipPosition(target, 'bottom', TOOLTIP, VIEWPORT);
    const expectedLeft = 500 + 100 / 2 - TOOLTIP.width / 2;
    expect(result.left).toBe(expectedLeft);
  });

  it('centers vertically on the target for a left/right placement', () => {
    const target = { top: 300, left: 500, width: 40, height: 40 };
    const result = computeTooltipPosition(target, 'right', TOOLTIP, VIEWPORT);
    const expectedTop = 300 + 40 / 2 - TOOLTIP.height / 2;
    expect(result.top).toBe(expectedTop);
  });
});
