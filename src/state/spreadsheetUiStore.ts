'use client';

import { create } from 'zustand';

/**
 * Spreadsheet chrome state — everything that is not workbook data.
 *
 * Separate from `uiStore` rather than an extension of it: the two editors share
 * no controls, and a single store would make every Word component re-render
 * when a spreadsheet toggle changed. The workbook itself is deliberately *not*
 * here; it lives in `WorkbookStore` outside React, because a million cells do
 * not belong in a store that copies on write.
 *
 * Gridlines and headings are *not* here either, though they look like chrome.
 * Excel stores them per sheet, and a question can ask a candidate to turn them
 * on — which makes them part of a submitted answer, so they live on the
 * worksheet with everything else that gets marked.
 */

export type SheetRibbonTabId =
  | 'home'
  | 'insert'
  | 'pageLayout'
  | 'formulas'
  | 'data'
  | 'review'
  | 'view';

export const SHEET_ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;
export const MIN_SHEET_ZOOM = 0.5;
export const MAX_SHEET_ZOOM = 2;

interface SpreadsheetUiState {
  activeTab: SheetRibbonTabId;
  zoom: number;
  showFormulaBar: boolean;
  /** Excel's Show Formulas: cells show their source instead of their result. */
  showFormulas: boolean;
  /**
   * Excel's Protect Sheet, as far as this build can honour it.
   *
   * No password: the real feature guards a saved file, and nothing here is
   * saved. What it does do is real — cells cannot be typed into and the
   * formatting controls go dead — which is the half a candidate can see. The
   * Word editor's Restrict Editing works the same way.
   */
  readOnly: boolean;
  /** Transient status-bar message, e.g. a refused merge. */
  notice: string | null;

  setActiveTab: (tab: SheetRibbonTabId) => void;
  setZoom: (zoom: number) => void;
  stepZoom: (direction: 1 | -1) => void;
  toggleFormulaBar: () => void;
  toggleShowFormulas: () => void;
  setReadOnly: (readOnly: boolean) => void;
  setNotice: (notice: string | null) => void;
}

export const useSpreadsheetUiStore = create<SpreadsheetUiState>((set) => ({
  activeTab: 'home',
  zoom: 1,
  showFormulaBar: true,
  showFormulas: false,
  readOnly: false,
  notice: null,

  setActiveTab: (activeTab) => set({ activeTab }),
  setZoom: (zoom) => set({ zoom: clamp(zoom, MIN_SHEET_ZOOM, MAX_SHEET_ZOOM) }),
  stepZoom: (direction) =>
    set((state) => {
      const index = SHEET_ZOOM_LEVELS.findIndex((level) => level >= state.zoom - 0.001);
      const next = SHEET_ZOOM_LEVELS[clampIndex(index + direction)];
      return { zoom: next ?? state.zoom };
    }),
  toggleFormulaBar: () => set((state) => ({ showFormulaBar: !state.showFormulaBar })),
  toggleShowFormulas: () => set((state) => ({ showFormulas: !state.showFormulas })),
  setReadOnly: (readOnly) => set({ readOnly }),
  setNotice: (notice) => set({ notice }),
}));

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clampIndex(index: number): number {
  return Math.min(SHEET_ZOOM_LEVELS.length - 1, Math.max(0, index));
}
