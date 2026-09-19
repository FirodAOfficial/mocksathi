/**
 * The exam is sat full screen: entered when the candidate presses Start, left
 * the moment the paper closes.
 *
 * Browsers only grant fullscreen from inside a user gesture, so `enterFullscreen`
 * must be called from the Start button's own click handler — not from an effect
 * on the page it navigates to. The client-side navigation that follows keeps the
 * same document, so fullscreen carries over into the editor.
 *
 * Both are best-effort. A refused request (an iframe without `allowfullscreen`,
 * a browser setting, iOS Safari's missing API) must never stop the paper from
 * opening or closing, so every failure is swallowed.
 */

export function enterFullscreen(): void {
  if (typeof document === 'undefined' || document.fullscreenElement) return;
  const root = document.documentElement;
  if (typeof root.requestFullscreen !== 'function') return;
  root.requestFullscreen().catch(() => {});
}

export function exitFullscreen(): void {
  if (typeof document === 'undefined' || !document.fullscreenElement) return;
  if (typeof document.exitFullscreen !== 'function') return;
  document.exitFullscreen().catch(() => {});
}
