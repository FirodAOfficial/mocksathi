'use client';

import { create } from 'zustand';

/**
 * Chrome state that is not part of the document.
 *
 * Kept in a store rather than React state because it is read by widely
 * separated parts of the tree — the ribbon sets the zoom, the status bar shows
 * and changes it, and the page surface renders it — and threading it through
 * props would couple every component in between.
 */

export type RibbonTabId =
  | 'home'
  | 'insert'
  | 'design'
  | 'layout'
  | 'references'
  | 'mailings'
  | 'review'
  | 'view'
  | 'help';

export type PageOrientation = 'portrait' | 'landscape';
export type MarginPreset = 'normal' | 'narrow' | 'wide';
export type PaperSize = 'letter' | 'a4' | 'legal';
/** Word's Print Layout, Web Layout and Draft. Read Mode is Print plus read-only. */
export type ViewMode = 'print' | 'web' | 'draft';

/** Paper sizes in CSS pixels, portrait, at 96 pixels per inch. */
export const PAPER_SIZES: Record<PaperSize, { width: number; height: number; label: string }> = {
  letter: { width: 816, height: 1056, label: 'Letter (8.5" × 11")' },
  a4: { width: 794, height: 1123, label: 'A4 (21 cm × 29.7 cm)' },
  legal: { width: 816, height: 1344, label: 'Legal (8.5" × 14")' },
};

/** US Letter at 96 CSS pixels per inch. */
export const PAGE_WIDTH_PX = PAPER_SIZES.letter.width;
export const PAGE_HEIGHT_PX = PAPER_SIZES.letter.height;

export const MARGIN_PRESETS: Record<MarginPreset, { top: number; right: number; bottom: number; left: number }> = {
  normal: { top: 96, right: 96, bottom: 96, left: 96 },
  narrow: { top: 48, right: 48, bottom: 48, left: 48 },
  wide: { top: 96, right: 192, bottom: 96, left: 192 },
};

export const ZOOM_LEVELS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2] as const;

/*
 * 25%, not 50%: a 320px phone showing an 816px sheet needs about 37% to fit it,
 * and a floor of 50% left the page overflowing the screen with no way to pull
 * it back. Word's own minimum is 10%.
 */
export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 2;

interface UiState {
  activeTab: RibbonTabId;
  zoom: number;
  orientation: PageOrientation;
  paper: PaperSize;
  margins: MarginPreset;
  /** Text columns across the page, as Word's Layout > Columns sets. */
  columns: 1 | 2 | 3;
  /** Page background, as Design > Page Color sets. Null is white. */
  pageColor: string | null;
  /** Diagonal text drawn behind the document. Null is none. */
  watermark: string | null;
  /** A page border drawn inside the margins, as Design > Page Borders sets. */
  pageBorder: boolean;
  viewMode: ViewMode;
  showRuler: boolean;
  showGridlines: boolean;
  /** Pilcrows and space dots, as Home's ¶ button toggles. */
  showFormattingMarks: boolean;
  /** Word's Focus: the document alone, without the ribbon or the side panels. */
  focusMode: boolean;
  readOnly: boolean;
  /** Transient message shown in the status bar, e.g. a clipboard failure. */
  notice: string | null;

  setActiveTab: (tab: RibbonTabId) => void;
  setZoom: (zoom: number) => void;
  stepZoom: (direction: 1 | -1) => void;
  setOrientation: (orientation: PageOrientation) => void;
  setPaper: (paper: PaperSize) => void;
  setMargins: (margins: MarginPreset) => void;
  setColumns: (columns: 1 | 2 | 3) => void;
  setPageColor: (color: string | null) => void;
  setWatermark: (text: string | null) => void;
  togglePageBorder: () => void;
  setViewMode: (mode: ViewMode) => void;
  toggleRuler: () => void;
  toggleGridlines: () => void;
  toggleFormattingMarks: () => void;
  toggleFocusMode: () => void;
  setReadOnly: (readOnly: boolean) => void;
  setNotice: (notice: string | null) => void;
}

const clampZoom = (value: number): number =>
  Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(value * 100) / 100));

export const useUiStore = create<UiState>((set) => ({
  activeTab: 'home',
  zoom: 1,
  orientation: 'portrait',
  paper: 'letter',
  margins: 'normal',
  columns: 1,
  pageColor: null,
  watermark: null,
  pageBorder: false,
  viewMode: 'print',
  showRuler: true,
  showGridlines: false,
  showFormattingMarks: false,
  focusMode: false,
  readOnly: false,
  notice: null,

  setActiveTab: (activeTab) => set({ activeTab }),
  setZoom: (zoom) => set({ zoom: clampZoom(zoom) }),
  stepZoom: (direction) =>
    set((state) => {
      // Step along the preset ladder so the buttons land on round percentages
      // rather than drifting to values like 87%.
      const levels = [...ZOOM_LEVELS];
      const index = levels.findIndex((level) => level >= state.zoom - 0.001);
      const base = index === -1 ? levels.length - 1 : index;
      const next = levels[Math.min(levels.length - 1, Math.max(0, base + direction))];
      return { zoom: clampZoom(next ?? state.zoom) };
    }),
  setOrientation: (orientation) => set({ orientation }),
  setPaper: (paper) => set({ paper }),
  setMargins: (margins) => set({ margins }),
  setColumns: (columns) => set({ columns }),
  setPageColor: (pageColor) => set({ pageColor }),
  setWatermark: (watermark) => set({ watermark }),
  togglePageBorder: () => set((state) => ({ pageBorder: !state.pageBorder })),
  setViewMode: (viewMode) => set({ viewMode }),
  toggleRuler: () => set((state) => ({ showRuler: !state.showRuler })),
  toggleGridlines: () => set((state) => ({ showGridlines: !state.showGridlines })),
  toggleFormattingMarks: () => set((state) => ({ showFormattingMarks: !state.showFormattingMarks })),
  toggleFocusMode: () => set((state) => ({ focusMode: !state.focusMode })),
  setReadOnly: (readOnly) => set({ readOnly }),
  setNotice: (notice) => set({ notice }),
}));

/** Page box in CSS pixels for the chosen paper and orientation. */
export function pageSize(
  orientation: PageOrientation,
  paper: PaperSize = 'letter',
): { width: number; height: number } {
  const { width, height } = PAPER_SIZES[paper];
  return orientation === 'portrait' ? { width, height } : { width: height, height: width };
}
