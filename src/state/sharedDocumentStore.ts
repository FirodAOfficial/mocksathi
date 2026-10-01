'use client';

import type { JSONContent } from '@tiptap/core';
import { create } from 'zustand';
import type { TimelineEntry } from '@/exam/document/types';

/**
 * The sitting of a single-document Word paper, visit by visit.
 *
 * Its own store rather than more fields on `examStore`, which serves every
 * paper: this exists only while a single-document paper is open, and removing
 * the flow is removing this file. `examStore.answers` is still kept up to date
 * alongside — it is what the palette's "attempted" badges read — but the
 * timeline here is what is marked.
 */

interface SharedDocumentState {
  timeline: TimelineEntry[];
  /** Starts a sitting over: nothing recorded yet. */
  reset: () => void;
  /**
   * Records what the document looks like at the end of a visit to `question`.
   *
   * Consecutive entries for the same question are one visit split by a save,
   * so the later one replaces the earlier rather than adding a segment whose
   * before is the same question's own work.
   */
  record: (question: number, document: JSONContent) => void;
  /** Puts back a timeline taken earlier — how Clear undoes a visit. */
  restore: (timeline: TimelineEntry[]) => void;
}

export const useSharedDocumentStore = create<SharedDocumentState>((set) => ({
  timeline: [],
  reset: () => set({ timeline: [] }),
  record: (question, document) =>
    set((state) => {
      const last = state.timeline[state.timeline.length - 1];
      if (last && last.question === question) {
        return { timeline: [...state.timeline.slice(0, -1), { question, document }] };
      }
      return { timeline: [...state.timeline, { question, document }] };
    }),
  restore: (timeline) => set({ timeline }),
}));
