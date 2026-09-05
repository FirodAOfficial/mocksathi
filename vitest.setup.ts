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
