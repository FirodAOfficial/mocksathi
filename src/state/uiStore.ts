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

export type RibbonTabId = 'home' | 'insert' | 'layout' | 'review' | 'view';

export type PageOrientation = 'portrait' | 'landscape';
export type MarginPreset = 'normal' | 'narrow' | 'wide';

/** US Letter at 96 CSS pixels per inch. */
export const PAGE_WIDTH_PX = 816;
export const PAGE_HEIGHT_PX = 1056;

export const MARGIN_PRESETS: Record<MarginPreset, { top: number; right: number; bottom: number; left: number }> = {
  normal: { top: 96, right: 96, bottom: 96, left: 96 },
  narrow: { top: 48, right: 48, bottom: 48, left: 48 },
  wide: { top: 96, right: 192, bottom: 96, left: 192 },
};

export const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 2;

interface UiState {
  activeTab: RibbonTabId;
  zoom: number;
  orientation: PageOrientation;
  margins: MarginPreset;
  showRuler: boolean;
  readOnly: boolean;
  /** Transient message shown in the status bar, e.g. a clipboard failure. */
  notice: string | null;

  setActiveTab: (tab: RibbonTabId) => void;
  setZoom: (zoom: number) => void;
  stepZoom: (direction: 1 | -1) => void;
  setOrientation: (orientation: PageOrientation) => void;
  setMargins: (margins: MarginPreset) => void;
  toggleRuler: () => void;
  setReadOnly: (readOnly: boolean) => void;
  setNotice: (notice: string | null) => void;
}

const clampZoom = (value: number): number =>
  Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(value * 100) / 100));

export const useUiStore = create<UiState>((set) => ({
  activeTab: 'home',
  zoom: 1,
  orientation: 'portrait',
  margins: 'normal',
  showRuler: true,
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
  setMargins: (margins) => set({ margins }),
  toggleRuler: () => set((state) => ({ showRuler: !state.showRuler })),
  setReadOnly: (readOnly) => set({ readOnly }),
  setNotice: (notice) => set({ notice }),
}));

/** Page box in CSS pixels for the current orientation. */
export function pageSize(orientation: PageOrientation): { width: number; height: number } {
  return orientation === 'portrait'
    ? { width: PAGE_WIDTH_PX, height: PAGE_HEIGHT_PX }
    : { width: PAGE_HEIGHT_PX, height: PAGE_WIDTH_PX };
}
