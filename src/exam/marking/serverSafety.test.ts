import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * The marking engine runs on the server, so nothing it imports may be a client
 * module.
 *
 * This is the one bug class the rest of the suite cannot see: vitest has no
 * client/server boundary, so a `'use client'` import resolves happily in tests
 * and then throws in production with "Attempted to call X from the server".
 * That is exactly what happened — `applyCase` was imported from the ribbon,
 * and every test passed while a real submission returned a 500.
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const SRC = resolve(ROOT, 'src');

/** Entry points that execute server-side. */
const SERVER_ENTRIES = [
  'src/app/api/attempts/submit/route.ts',
  'src/app/api/document/route.ts',
  'src/exam/marking/markAttempt.ts',
  'src/exam/marking/evaluate.ts',
  'src/server/marking/questionBank.ts',
  'src/exam/marking/sheet/evaluate.ts',
  'src/exam/marking/sheet/sheetMarker.ts',
  'src/server/marking/excelQuestionBank.ts',
  'src/server/marking/rubricFromOperations.ts',
  'src/db/tests.ts',
];

function resolveImport(specifier: string): string | null {
  if (!specifier.startsWith('@/')) return null;
  const base = resolve(SRC, specifier.slice(2));
  for (const candidate of [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`]) {
    try {
      readFileSync(candidate, 'utf8');
      return candidate;
    } catch {
      // try the next shape
    }
  }
  return null;
}

/** Every project module reachable from an entry point, transitively. */
function reachableFrom(entry: string): Map<string, string[]> {
  const visited = new Map<string, string[]>();
  const queue: { file: string; via: string[] }[] = [{ file: resolve(ROOT, entry), via: [entry] }];

  while (queue.length > 0) {
    const { file, via } = queue.shift()!;
    if (visited.has(file)) continue;

    let source: string;
    try {
      source = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    visited.set(file, via);

    // Relative specifiers stay inside the module's own directory.
    const specifiers = [...source.matchAll(/from\s+'([^']+)'/g)].map((match) => match[1]!);
    for (const specifier of specifiers) {
      const target = specifier.startsWith('.')
        ? ['.ts', '.tsx', '/index.ts']
            .map((suffix) => resolve(dirname(file), specifier + suffix))
            .find((candidate) => {
              try {
                readFileSync(candidate, 'utf8');
                return true;
              } catch {
                return false;
              }
            }) ?? null
        : resolveImport(specifier);

      if (target) queue.push({ file: target, via: [...via, specifier] });
    }
  }

  return visited;
}

function isClientModule(file: string): boolean {
  return /^\s*['"]use client['"]/.test(readFileSync(file, 'utf8'));
}

describe('server code imports no client modules', () => {
  it.each(SERVER_ENTRIES)('%s reaches only server-safe modules', (entry) => {
    const reachable = reachableFrom(entry);

    const offenders = [...reachable.entries()]
      .filter(([file]) => isClientModule(file))
      .map(([file, via]) => `${file.replace(`${ROOT}/`, '')} (via ${via.join(' -> ')})`);

    expect(offenders).toEqual([]);
  });

  it('actually detects a client module, so the check cannot silently pass', () => {
    // Guards the guard: if `isClientModule` ever stopped working, every case
    // above would pass vacuously.
    expect(isClientModule(resolve(SRC, 'editor/ribbonActions.ts'))).toBe(true);
    expect(isClientModule(resolve(SRC, 'utils/letterCase.ts'))).toBe(false);
  });
});
