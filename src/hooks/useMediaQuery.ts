'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * Subscribes to a CSS media query.
 *
 * `useSyncExternalStore` rather than `useState` + an effect: the server has no
 * viewport, so the server snapshot is always `false` and the first client render
 * matches it. React then re-renders with the real value, which keeps hydration
 * clean — reading `window.matchMedia` during render would not.
 *
 * Layout that can be expressed in CSS should stay in CSS. This is for the cases
 * that cannot be: a drawer that must not be in the accessibility tree when it is
 * closed, and a zoom level the document has to be measured for.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);

      /*
       * `resize` as well as `change`, because the change event cannot be relied
       * on alone: it does not fire under devtools viewport emulation, and older
       * Safari missed it on orientation change. React compares the snapshot
       * before re-rendering, so the extra events cost a comparison and nothing
       * else — and the layout is never left describing a viewport that has gone.
       */
      window.addEventListener('resize', onChange);

      return () => {
        list.removeEventListener('change', onChange);
        window.removeEventListener('resize', onChange);
      };
    },
    [query],
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/**
 * Phone-sized: the ribbon condenses, the ruler goes, the status bar sheds its
 * zoom slider.
 */
export const PHONE_QUERY = '(max-width: 767px)';

/**
 * Too narrow for the three-column layout, which needs about 1280px: the page is
 * 816px on its own, and the question list and summary want another ~460px
 * between them. Below that the panels become drawers — including on a tablet,
 * where three columns would squeeze the document to a slot.
 */
export const PANELS_QUERY = '(max-width: 1279px)';

export const useIsPhone = (): boolean => useMediaQuery(PHONE_QUERY);

/** True when the side panels have to be drawers rather than columns. */
export const useDrawerLayout = (): boolean => useMediaQuery(PANELS_QUERY);
