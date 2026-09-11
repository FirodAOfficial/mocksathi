import '@testing-library/jest-dom/vitest';

/**
 * jsdom implements the `<dialog>` element but not its modal methods, so any
 * component that calls `showModal()` throws on mount. Shimming them here keeps
 * the components using the real platform API — the alternative would be
 * reimplementing focus trapping by hand just to satisfy the test environment.
 */
if (typeof HTMLDialogElement !== 'undefined' && typeof HTMLDialogElement.prototype.showModal !== 'function') {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement): void {
    this.open = true;
  };
  HTMLDialogElement.prototype.show = function show(this: HTMLDialogElement): void {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement): void {
    this.open = false;
    this.dispatchEvent(new Event('close'));
  };
}

/**
 * jsdom does not implement `matchMedia`, so any component that asks about the
 * viewport throws on mount. The shim reports "does not match", which is the
 * desktop layout — the one with both exam panels on the page as columns, and
 * the one worth testing by default.
 *
 * Shimmed here rather than mocked per test so a component is never tempted to
 * take a `isMobile` prop purely to be testable.
 */
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}
