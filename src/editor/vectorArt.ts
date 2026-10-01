/**
 * The shapes and icons the Insert tab can put into a document.
 *
 * A fixed catalogue drawn here rather than a picker over a library: every
 * entry is inserted as an inline `data:image/svg+xml` picture, so a paper that
 * uses one carries the drawing inside the answer and needs nothing fetched to
 * be marked or read back.
 *
 * Each `svg` is a complete, self-contained document — no CSS, no external
 * reference, no script — because that is what a data URL can carry and what an
 * `<img>` will render.
 */

export interface VectorArt {
  id: string;
  label: string;
  svg: string;
}

const box = (body: string, size = 120): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">${body}</svg>`;

/** Word's Shapes drop-down, cut to the ones a document actually uses. */
export const SHAPES: VectorArt[] = [
  { id: 'rectangle', label: 'Rectangle', svg: box('<rect x="8" y="26" width="104" height="68" fill="#2e74b5"/>') },
  {
    id: 'rounded-rectangle',
    label: 'Rounded Rectangle',
    svg: box('<rect x="8" y="26" width="104" height="68" rx="14" fill="#2e74b5"/>'),
  },
  { id: 'oval', label: 'Oval', svg: box('<ellipse cx="60" cy="60" rx="52" ry="34" fill="#2e74b5"/>') },
  { id: 'circle', label: 'Circle', svg: box('<circle cx="60" cy="60" r="52" fill="#2e74b5"/>') },
  { id: 'triangle', label: 'Triangle', svg: box('<path d="M60 10 112 108H8Z" fill="#2e74b5"/>') },
  { id: 'diamond', label: 'Diamond', svg: box('<path d="M60 8 112 60 60 112 8 60Z" fill="#2e74b5"/>') },
  {
    id: 'right-arrow',
    label: 'Right Arrow',
    svg: box('<path d="M8 44h58V26l46 34-46 34V76H8Z" fill="#2e74b5"/>'),
  },
  {
    id: 'left-arrow',
    label: 'Left Arrow',
    svg: box('<path d="M112 44H54V26L8 60l46 34V76h58Z" fill="#2e74b5"/>'),
  },
  { id: 'star', label: 'Star', svg: box('<path d="m60 8 15 34 37 4-28 25 8 37-32-19-32 19 8-37L8 46l37-4Z" fill="#2e74b5"/>') },
  {
    id: 'speech-bubble',
    label: 'Speech Bubble',
    svg: box('<path d="M12 20h96v58H56l-22 22V78H12Z" fill="#2e74b5"/>'),
  },
  { id: 'line', label: 'Line', svg: box('<path d="M8 100 112 20" stroke="#2e74b5" stroke-width="6" fill="none"/>') },
  {
    id: 'double-arrow',
    label: 'Double Arrow',
    svg: box('<path d="M8 60 34 34v18h52V34l26 26-26 26V68H34v18Z" fill="#2e74b5"/>'),
  },
];

const line = (body: string): string =>
  box(`<g fill="none" stroke="#2e74b5" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">${body}</g>`);

/** Word's Icons gallery, cut the same way. */
export const ICONS: VectorArt[] = [
  { id: 'person', label: 'Person', svg: line('<circle cx="60" cy="40" r="20"/><path d="M20 104a40 40 0 0 1 80 0"/>') },
  {
    id: 'document',
    label: 'Document',
    svg: line('<path d="M34 12h38l24 24v72H34Z"/><path d="M72 12v24h24"/><path d="M48 62h36M48 80h36"/>'),
  },
  { id: 'clock', label: 'Clock', svg: line('<circle cx="60" cy="60" r="44"/><path d="M60 32v30l20 12"/>') },
  {
    id: 'mail',
    label: 'Mail',
    svg: line('<rect x="14" y="30" width="92" height="60" rx="6"/><path d="m14 36 46 32 46-32"/>'),
  },
  { id: 'check', label: 'Tick', svg: line('<circle cx="60" cy="60" r="44"/><path d="m40 61 14 15 28-31"/>') },
  { id: 'cross', label: 'Cross', svg: line('<circle cx="60" cy="60" r="44"/><path d="M44 44 76 76M76 44 44 76"/>') },
  {
    id: 'chart',
    label: 'Chart',
    svg: line('<path d="M18 100h84"/><path d="M34 100V64M58 100V36M82 100V52"/>'),
  },
  { id: 'star-outline', label: 'Star', svg: line('<path d="m60 16 14 30 33 4-24 23 6 33-29-16-29 16 6-33-24-23 33-4Z"/>') },
  { id: 'flag', label: 'Flag', svg: line('<path d="M32 108V18"/><path d="M32 22h56l-12 18 12 18H32Z"/>') },
  {
    id: 'location',
    label: 'Location',
    svg: line('<path d="M60 108s32-34 32-56a32 32 0 1 0-64 0c0 22 32 56 32 56Z"/><circle cx="60" cy="50" r="12"/>'),
  },
  { id: 'phone', label: 'Phone', svg: line('<rect x="38" y="12" width="44" height="96" rx="8"/><path d="M54 96h12"/>') },
  {
    id: 'lightbulb',
    label: 'Idea',
    svg: line('<path d="M60 14a28 28 0 0 1 18 49v13H42V63a28 28 0 0 1 18-49Z"/><path d="M48 90h24M52 102h16"/>'),
  },
];
