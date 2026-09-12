'use client';

import { createContext, useContext, useSyncExternalStore } from 'react';
import type { SelectionState } from './grid/SelectionModel';
import type { WorkbookStore } from './WorkbookStore';

/**
 * Reading the workbook from React, without React owning it.
 *
 * `useSyncExternalStore` is the supported way to read a mutable store: it
 * subscribes, re-reads on notification, and — unlike a `useEffect` that copies
 * into state — cannot tear during a concurrent render.
 *
 * The two hooks are deliberately separate. Selection changes on every mouse
 * move of a drag; workbook data changes only on an edit. A component that shows
 * a value (a cell) must not re-render because the cursor moved, and a component
 * that shows the cursor (the name box) must not re-render because a distant
 * cell recalculated.
 */

const WorkbookContext = createContext<WorkbookStore | null>(null);

export const WorkbookProvider = WorkbookContext.Provider;

export function useWorkbookStore(): WorkbookStore {
  const store = useContext(WorkbookContext);
  if (!store) throw new Error('useWorkbookStore must be used inside a WorkbookProvider.');
  return store;
}

/**
 * Re-renders when the workbook changes.
 *
 * Returns the version rather than the data: the caller reads whatever cells it
 * paints straight from the sheet, so handing it a snapshot would build an
 * object nobody reads.
 */
export function useWorkbookVersion(): number {
  const store = useWorkbookStore();

  return useSyncExternalStore(
    store.subscribe,
    store.getVersion,
    // The server renders version 0: a blank workbook, which is what the client
    // starts from too, so there is nothing to mismatch.
    () => 0,
  );
}

const EMPTY_SELECTION: SelectionState = Object.freeze({
  active: Object.freeze({ row: 0, col: 0 }),
  anchor: Object.freeze({ row: 0, col: 0 }),
  ranges: Object.freeze([
    Object.freeze({ start: { row: 0, col: 0 }, end: { row: 0, col: 0 } }),
  ]) as SelectionState['ranges'],
});

export function useSelection(): SelectionState {
  const store = useWorkbookStore();

  return useSyncExternalStore(
    store.selection.subscribe,
    store.selection.getSnapshot,
    () => EMPTY_SELECTION,
  );
}
