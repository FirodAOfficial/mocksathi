/**
 * Naming colours, and which ones count as the same answer.
 *
 * Shared by every consumer of the function catalog — the criterion labels a
 * candidate reads, the admin form's summaries, and the Excel rubrics, which had
 * these tables to themselves before the catalog existed.
 */

/**
 * What to call a colour in feedback the candidate reads.
 *
 * "The paragraph is highlighted #00ff00" tells them nothing; "highlighted
 * green" tells them what to look for in the palette.
 */
const COLOUR_NAMES: Record<string, string> = {
  '#000000': 'black',
  '#ffffff': 'white',
  '#ff0000': 'red',
  '#c00000': 'dark red',
  '#00ff00': 'green',
  '#008000': 'dark green',
  '#0000ff': 'blue',
  '#002060': 'dark blue',
  '#1f497d': 'dark blue',
  '#ffff00': 'yellow',
  '#ffc000': 'amber',
  '#e36c0a': 'orange',
  '#7030a0': 'purple',
};

/**
 * Colours a candidate may reasonably reach for instead, and still be right.
 *
 * Office's palettes carry two reds and two dark blues, and which one a
 * candidate lands on is not what the question is testing — the hand-written
 * banks make the same allowance (`REDS`, `DARK_BLUES`). Without this an
 * authored question would be stricter than the sample papers for no reason
 * anyone could explain to the candidate who got it "wrong".
 */
const COLOUR_ALTERNATIVES: Record<string, string[]> = {
  '#ff0000': ['#ff0000', '#c00000'],
  '#c00000': ['#c00000', '#ff0000'],
  '#002060': ['#002060', '#1f497d'],
  '#1f497d': ['#1f497d', '#002060'],
  '#e36c0a': ['#e36c0a', '#ffc000'],
  '#ffc000': ['#ffc000', '#e36c0a'],
};

export function colourName(hex: string): string {
  return COLOUR_NAMES[hex.toLowerCase()] ?? hex;
}

/** The other colour a candidate might have picked, when there is one. */
export function colourAlternatives(hex: string): string[] | undefined {
  return COLOUR_ALTERNATIVES[hex.toLowerCase()];
}

export function acceptedColours(hex: string): string | string[] {
  return COLOUR_ALTERNATIVES[hex.toLowerCase()] ?? hex.toLowerCase();
}
