/**
 * Unit conversions at the OOXML boundary.
 *
 * Word measures in twips (1/1440 inch), half-points, and eighth-points. None of
 * those escape this parser: the normalised model speaks CSS pixels and points.
 */

const TWIPS_PER_INCH = 1440;
const CSS_PX_PER_INCH = 96;

export function twipsToPx(twips: number): number {
  return round2((twips * CSS_PX_PER_INCH) / TWIPS_PER_INCH);
}

export function halfPointsToPt(halfPoints: number): number {
  return round2(halfPoints / 2);
}

/** `w:spacing/@w:line` with `lineRule="auto"` is 240ths of a line. */
export function lineValueToMultiplier(line: number): number {
  return round2(line / 240);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Parses an OOXML integer attribute, returning null for absent/garbage input. */
export function parseIntAttr(value: string | undefined): number | null {
  if (value === undefined) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * OOXML booleans: a bare `<w:b/>` means on; `w:val` of 0/false/off means off.
 * Absent elements are "inherit", which is why null is distinct from false.
 */
export function parseOnOff(attrs: Record<string, string> | undefined): boolean {
  if (!attrs) return true;
  const val = attrs['w:val'] ?? attrs['val'];
  if (val === undefined) return true;
  return !(val === '0' || val === 'false' || val === 'off');
}

const HEX_COLOR = /^[0-9a-fA-F]{6}$/;

/**
 * `w:color/@w:val` is a bare 6-digit hex, or the sentinel "auto" meaning
 * "whatever the theme decides" — which we represent as no colour at all.
 */
export function normalizeHexColor(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim().replace(/^#/, '');
  if (trimmed.toLowerCase() === 'auto') return undefined;
  if (!HEX_COLOR.test(trimmed)) return undefined;
  return `#${trimmed.toLowerCase()}`;
}

/** `w:highlight` is a named enum rather than a hex value. */
const HIGHLIGHT_COLORS: Record<string, string> = {
  yellow: '#ffff00',
  green: '#00ff00',
  cyan: '#00ffff',
  magenta: '#ff00ff',
  blue: '#0000ff',
  red: '#ff0000',
  darkblue: '#000080',
  darkcyan: '#008080',
  darkgreen: '#008000',
  darkmagenta: '#800080',
  darkred: '#800000',
  darkyellow: '#808000',
  darkgray: '#808080',
  lightgray: '#c0c0c0',
  black: '#000000',
  white: '#ffffff',
};

export function normalizeHighlight(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const key = value.trim().toLowerCase();
  if (key === 'none') return undefined;
  return HIGHLIGHT_COLORS[key];
}
