import type { JSX } from 'react';

/**
 * The application's icon set, drawn inline.
 *
 * Inline SVG rather than an icon font or sprite sheet: there are a few dozen
 * glyphs, they need to inherit `currentColor` for disabled states, and shipping
 * them inline keeps the ribbon free of a second network request on first paint.
 */
export type IconName =
  | 'undo'
  | 'redo'
  | 'save'
  | 'cut'
  | 'copy'
  | 'paste'
  | 'format-painter'
  | 'grow-font'
  | 'shrink-font'
  | 'clear-format'
  | 'text-color'
  | 'highlight'
  | 'bullet-list'
  | 'ordered-list'
  | 'align-left'
  | 'align-center'
  | 'align-right'
  | 'align-justify'
  | 'indent-increase'
  | 'indent-decrease'
  | 'line-spacing'
  | 'borders'
  | 'find'
  | 'replace'
  | 'select-all'
  | 'chevron-down'
  | 'print'
  | 'page'
  | 'error'
  | 'warning';

const STROKE = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.4,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

const PATHS: Record<IconName, JSX.Element> = {
  undo: <path d="M3 8h7a4 4 0 1 1 0 8H7M3 8l3-3M3 8l3 3" {...STROKE} />,
  redo: <path d="M17 8h-7a4 4 0 1 0 0 8h3M17 8l-3-3M17 8l-3 3" {...STROKE} />,
  save: (
    <g {...STROKE}>
      <path d="M3.5 3.5h10L16.5 6.5v10h-13z" />
      <path d="M6.5 3.5v4h7v-4M6.5 16.5v-5h7v5" />
    </g>
  ),
  cut: (
    <g {...STROKE}>
      <circle cx="5.5" cy="14.5" r="2" />
      <circle cx="14.5" cy="14.5" r="2" />
      <path d="M6.8 13 14 3.5M13.2 13 6 3.5" />
    </g>
  ),
  copy: (
    <g {...STROKE}>
      <rect x="3.5" y="3.5" width="9" height="11" rx="1" />
      <path d="M6.5 16.5h8a1 1 0 0 0 1-1v-9" />
    </g>
  ),
  paste: (
    <g {...STROKE}>
      <path d="M6.5 4.5h-2a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-10a1 1 0 0 0-1-1h-2" />
      <rect x="6.5" y="2.5" width="5" height="3" rx="0.6" />
    </g>
  ),
  'format-painter': (
    <g {...STROKE}>
      <path d="M4 3.5h9v4H4z" />
      <path d="M8.5 7.5v3h2v2.5h-3v4h2" />
    </g>
  ),
  'grow-font': (
    <g {...STROKE}>
      <path d="M2 15 7 5l5 10M3.6 12h6.8" />
      <path d="M15.5 14V8M13 10.5l2.5-2.5 2.5 2.5" />
    </g>
  ),
  'shrink-font': (
    <g {...STROKE}>
      <path d="M2 15 7 5l5 10M3.6 12h6.8" />
      <path d="M15.5 8v6M13 11.5l2.5 2.5 2.5-2.5" />
    </g>
  ),
  'clear-format': (
    <g {...STROKE}>
      <path d="M5 4h9M9 4l-2 9M6 16h5" />
      <path d="M12.5 11.5 17 16M17 11.5l-4.5 4.5" />
    </g>
  ),
  'text-color': (
    <g>
      <path d="M4 12 8 3l4 9M5.3 9.6h5.4" {...STROKE} />
      <rect x="3" y="14.5" width="14" height="3" fill="currentColor" />
    </g>
  ),
  highlight: (
    <g>
      <path d="M5 11.5 11.5 5l3.5 3.5L8.5 15H5z" {...STROKE} />
      <rect x="3" y="16.5" width="14" height="2" fill="currentColor" />
    </g>
  ),
  'bullet-list': (
    <g>
      <circle cx="4" cy="5.5" r="1.4" fill="currentColor" />
      <circle cx="4" cy="10" r="1.4" fill="currentColor" />
      <circle cx="4" cy="14.5" r="1.4" fill="currentColor" />
      <path d="M8 5.5h9M8 10h9M8 14.5h9" {...STROKE} />
    </g>
  ),
  'ordered-list': (
    <g>
      <text x="1.5" y="7.5" fontSize="6" fill="currentColor" fontFamily="var(--ui-font)">
        1
      </text>
      <text x="1.5" y="12.2" fontSize="6" fill="currentColor" fontFamily="var(--ui-font)">
        2
      </text>
      <text x="1.5" y="16.9" fontSize="6" fill="currentColor" fontFamily="var(--ui-font)">
        3
      </text>
      <path d="M8 5.5h9M8 10h9M8 14.5h9" {...STROKE} />
    </g>
  ),
  'align-left': <path d="M3 4.5h14M3 8h9M3 11.5h14M3 15h9" {...STROKE} />,
  'align-center': <path d="M3 4.5h14M5.5 8h9M3 11.5h14M5.5 15h9" {...STROKE} />,
  'align-right': <path d="M3 4.5h14M8 8h9M3 11.5h14M8 15h9" {...STROKE} />,
  'align-justify': <path d="M3 4.5h14M3 8h14M3 11.5h14M3 15h14" {...STROKE} />,
  'indent-increase': (
    <g {...STROKE}>
      <path d="M8 4.5h9M8 10h9M8 15.5h9M3 4.5h2M3 15.5h2" />
      <path d="M3 7.5 6 10l-3 2.5z" fill="currentColor" stroke="none" />
    </g>
  ),
  'indent-decrease': (
    <g {...STROKE}>
      <path d="M8 4.5h9M8 10h9M8 15.5h9M3 4.5h2M3 15.5h2" />
      <path d="M6 7.5 3 10l3 2.5z" fill="currentColor" stroke="none" />
    </g>
  ),
  'line-spacing': (
    <g {...STROKE}>
      <path d="M8 4.5h9M8 10h9M8 15.5h9" />
      <path d="M4 3.5v13M2 5.5 4 3.5l2 2M2 14.5l2 2 2-2" />
    </g>
  ),
  borders: (
    <g {...STROKE}>
      <rect x="3" y="3.5" width="14" height="13" />
      <path d="M3 10h14M10 3.5v13" strokeDasharray="2 2" />
    </g>
  ),
  find: (
    <g {...STROKE}>
      <circle cx="8.5" cy="8.5" r="5" />
      <path d="M12.4 12.4 17 17" />
    </g>
  ),
  replace: (
    <g {...STROKE}>
      <path d="M3 6h9a3 3 0 0 1 0 6H9M3 6l2.5-2.5M3 6l2.5 2.5" />
      <path d="M17 15H8" />
    </g>
  ),
  'select-all': (
    <g {...STROKE}>
      <rect x="3.5" y="3.5" width="13" height="13" strokeDasharray="2.5 2" />
      <path d="M6.5 10.2 9 12.6l4.5-5" />
    </g>
  ),
  'chevron-down': <path d="m4 7 4 4 4-4" {...STROKE} />,
  print: (
    <g {...STROKE}>
      <path d="M5.5 7.5v-4h9v4" />
      <rect x="3" y="7.5" width="14" height="6" rx="1" />
      <path d="M5.5 11.5h9v5h-9z" />
    </g>
  ),
  page: (
    <g {...STROKE}>
      <path d="M5 2.5h6L15 6.5v11H5z" />
      <path d="M11 2.5v4h4" />
    </g>
  ),
  error: (
    <g {...STROKE}>
      <circle cx="10" cy="10" r="7.5" />
      <path d="M10 6v5M10 13.6v.4" />
    </g>
  ),
  warning: (
    <g {...STROKE}>
      <path d="M10 3 18 16.5H2z" />
      <path d="M10 8v4M10 14.6v.4" />
    </g>
  ),
};

export interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
}

export function Icon({ name, size = 20, className }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 20 20"
      // Icons always sit beside or inside a labelled control, so announcing
      // them again would just duplicate the accessible name.
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
