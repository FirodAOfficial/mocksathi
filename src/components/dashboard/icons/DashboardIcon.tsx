/**
 * Icon set for the candidate dashboard.
 *
 * A separate set from `src/components/icons/Icon.tsx`: that one draws the
 * Office-style ribbon glyphs for the document editor, this one matches the
 * Lucide-style outline icons the dashboard mockup was designed with (thin
 * stroke, rounded joins, 24x24 grid). Kept inline for the same reason as the
 * editor's set — no extra network request, and `currentColor` picks up
 * whatever colour the nav or card around it sets.
 */
import type { JSX } from 'react';
import type { NavIconName } from '@/dashboard/types';

export type DashboardIconName =
  | NavIconName
  | 'flame'
  | 'bell'
  | 'chevron-down'
  | 'chevron-left'
  | 'chevron-right'
  | 'arrow-right'
  | 'lock';

const STROKE = {
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

const PATHS: Record<DashboardIconName, JSX.Element> = {
  'layout-dashboard': (
    <g {...STROKE}>
      <rect x="3" y="3" width="8" height="10" rx="1.5" />
      <rect x="13" y="3" width="8" height="6" rx="1.5" />
      <rect x="13" y="11" width="8" height="10" rx="1.5" />
      <rect x="3" y="15" width="8" height="6" rx="1.5" />
    </g>
  ),
  'file-check-2': (
    <g {...STROKE}>
      <path d="M6 2.5h8L19 7.5v14H6z" />
      <path d="M14 2.5v5h5" />
      <path d="m9 14 2.2 2.2L15.5 12" />
    </g>
  ),
  'calendar-days': (
    <g {...STROKE}>
      <rect x="3" y="4.5" width="18" height="16" rx="2" />
      <path d="M3 9.5h18M8 2.5v4M16 2.5v4" />
      <path d="M7.5 13.5h1M11.5 13.5h1M15.5 13.5h1M7.5 17h1M11.5 17h1M15.5 17h1" />
    </g>
  ),
  layers: (
    <g {...STROKE}>
      <path d="M12 3 21 8l-9 5-9-5z" />
      <path d="m3 13 9 5 9-5" />
      <path d="m3 17.5 9 5 9-5" />
    </g>
  ),
  'bar-chart-3': (
    <g {...STROKE}>
      <path d="M3 3v18h18" />
      <path d="M8 17V11M13 17V7M18 17v-5" />
    </g>
  ),
  history: (
    <g {...STROKE}>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v4.5H7.5" />
      <path d="M12 8v4l3 2" />
    </g>
  ),
  'git-compare': (
    <g {...STROKE}>
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="18" cy="18" r="2.5" />
      <path d="M8.5 6H15a3 3 0 0 1 3 3v6.5" />
      <path d="M15.5 15.5 18 18l2.5-2.5" />
      <path d="M15.5 18H9a3 3 0 0 1-3-3V8.5" />
      <path d="M8.5 8.5 6 6 3.5 8.5" />
    </g>
  ),
  'pie-chart': (
    <g {...STROKE}>
      <path d="M21.2 12a9.2 9.2 0 1 1-9.2-9.2v9.2z" />
      <path d="M21.2 12A9.2 9.2 0 0 0 12 2.8V12z" />
    </g>
  ),
  'book-open-check': (
    <g {...STROKE}>
      <path d="M12 6.5C10 5 7 4.5 3 5v13c4-.5 7 0 9 1.5" />
      <path d="M12 6.5c2-1.5 5-2 9-1.5v9.5" />
      <path d="m15 16.5 2 2 4-4" />
    </g>
  ),
  'git-branch': (
    <g {...STROKE}>
      <circle cx="6" cy="4.5" r="2.2" />
      <circle cx="6" cy="19.5" r="2.2" />
      <circle cx="18" cy="9.5" r="2.2" />
      <path d="M6 6.7v10.6" />
      <path d="M6 14c0-4 4-5.5 8.5-6.7" />
    </g>
  ),
  'trending-down': (
    <g {...STROKE}>
      <path d="m3 7 7 7 4-4 7 7" />
      <path d="M21 10.5V17h-6.5" />
    </g>
  ),
  star: <path d="M12 2.5 15 9l7 1-5.2 4.9L18.2 22 12 18.3 5.8 22l1.4-7.1L2 10l7-1z" {...STROKE} />,
  dumbbell: (
    <g {...STROKE}>
      <path d="M4 9v6M2.5 10.5v3M20 9v6M21.5 10.5v3" />
      <path d="M7 12h10" />
      <rect x="6.5" y="8.5" width="2" height="7" rx="0.6" />
      <rect x="15.5" y="8.5" width="2" height="7" rx="0.6" />
    </g>
  ),
  'list-checks': (
    <g {...STROKE}>
      <path d="m3 6 1.5 1.5L7.5 4.5" />
      <path d="m3 13 1.5 1.5L7.5 11.5" />
      <path d="m3 20 1.5 1.5L7.5 18.5" />
      <path d="M11 6h10M11 13h10M11 20h10" />
    </g>
  ),
  files: (
    <g {...STROKE}>
      <path d="M7 3.5h7L18.5 8v12.5H7z" />
      <path d="M4 7.5v13h9.5" opacity="0.6" />
      <path d="M14 3.5V8h4.5" />
    </g>
  ),
  bookmark: <path d="M6 3.5h12v17l-6-4-6 4z" {...STROKE} />,
  user: (
    <g {...STROKE}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />
    </g>
  ),
  settings: (
    <g {...STROKE}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 12a7.4 7.4 0 0 0-.1-1.3l2-1.5-2-3.4-2.3.9a7.6 7.6 0 0 0-2.3-1.3L14.3 3H9.7l-.4 2.4a7.6 7.6 0 0 0-2.3 1.3l-2.3-.9-2 3.4 2 1.5a7.6 7.6 0 0 0 0 2.6l-2 1.5 2 3.4 2.3-.9c.7.55 1.47 1 2.3 1.3l.4 2.4h4.6l.4-2.4a7.6 7.6 0 0 0 2.3-1.3l2.3.9 2-3.4-2-1.5c.07-.43.1-.86.1-1.3z" />
    </g>
  ),
  'circle-help': (
    <g {...STROKE}>
      <circle cx="12" cy="12" r="9.2" />
      <path d="M9.3 9a2.7 2.7 0 1 1 3.9 2.4c-.9.5-1.2 1-1.2 2" />
      <path d="M12 17v.2" />
    </g>
  ),
  'log-out': (
    <g {...STROKE}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </g>
  ),
  shield: (
    <g {...STROKE}>
      <path d="M12 2.5 4.5 5.5v6c0 5 3.2 8.2 7.5 10 4.3-1.8 7.5-5 7.5-10v-6z" />
      <path d="m8.7 12 2.3 2.3 4.3-4.6" />
    </g>
  ),
  home: (
    <g {...STROKE}>
      <path d="M3.5 10.5 12 3.5l8.5 7" />
      <path d="M5.5 9v11h13V9" />
      <path d="M9.5 20v-6h5v6" />
    </g>
  ),
  share: (
    <g {...STROKE}>
      <circle cx="18" cy="5.5" r="2.5" />
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="18.5" r="2.5" />
      <path d="m8.2 10.7 7.6-4.4M8.2 13.3l7.6 4.4" />
    </g>
  ),
  flame: (
    <path
      d="M12 2.5c.6 3-2.4 4-2.9 6.6-.3 1.6.4 2.6 1.4 3.2-.7-1.6.1-3 1-3.6-.2 1.6.9 2.2 1.5 3.4.5.9.5 2-.1 2.9 2.6-.9 4.1-3 3.9-5.6-.2-2.6-2.1-3-2.4-5.4-1 1-1.2 2.4-.8 3.6-1.2-1-1.7-3-1.6-5.1z"
      {...STROKE}
    />
  ),
  bell: (
    <g {...STROKE}>
      <path d="M6 10.5a6 6 0 0 1 12 0c0 4 1.5 5 1.5 5h-15s1.5-1 1.5-5z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </g>
  ),
  'chevron-down': <path d="m5 8.5 7 7 7-7" {...STROKE} />,
  'chevron-left': <path d="m14.5 5-7 7 7 7" {...STROKE} />,
  'chevron-right': <path d="m9.5 5 7 7-7 7" {...STROKE} />,
  'arrow-right': <path d="M4 12h15.5M14 6.5l5.5 5.5-5.5 5.5" {...STROKE} />,
  lock: (
    <g {...STROKE}>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
      <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
    </g>
  ),
};

export interface DashboardIconProps {
  name: DashboardIconName;
  size?: number;
  className?: string;
}

export function DashboardIcon({ name, size = 18, className }: DashboardIconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
