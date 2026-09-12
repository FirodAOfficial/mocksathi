/**
 * How many browser-history entries the close button should jump back over —
 * not a target path. `router.push(path)` treats the destination as a brand
 * new navigation (a fresh RSC fetch, no cache reuse), where a real
 * `router.back()` can restore an already-rendered page near-instantly. The
 * first version of this tracked a return *path* and used `router.push`,
 * which "worked" but was visibly slower than the plain `back()` it replaced
 * — this tracks a step *count* instead, so the close button can still use
 * native history navigation (`history.go(-n)`, same mechanism `back()` uses,
 * just more than one step), skipping every intermediate legal page in one
 * native jump instead of trading speed for correctness.
 */

const KEY = 'mocksathi_legal_back_steps';

/** `/legal/*` and `/about` — the set of pages this tracking applies to. */
export function isLegalPath(path: string): boolean {
  return path.startsWith('/legal/') || path === '/about';
}

/** Entering the cluster from outside it — one step back gets out, and this resets any stale count left over from an earlier visit. */
export function rememberLegalEntry(): void {
  try {
    sessionStorage.setItem(KEY, '1');
  } catch {
    // Some private-browsing contexts throw on storage access — the close
    // button falls back to a plain "/" in that case, not fatal.
  }
}

/** Hopping from one legal page to another — one more step needed to get all the way out. */
export function recordLegalHop(): void {
  try {
    const current = Number(sessionStorage.getItem(KEY) ?? '0');
    const next = Number.isInteger(current) && current > 0 ? current + 1 : 1;
    sessionStorage.setItem(KEY, String(next));
  } catch {
    // See above.
  }
}

/** Reads and clears the stored count — meant for exactly one close-button click, not to linger for a later, unrelated visit. Null means nothing was tracked (a direct/bookmarked visit), not zero steps. */
export function consumeLegalBackSteps(): number | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    const n = raw ? Number(raw) : NaN;
    return Number.isInteger(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}
