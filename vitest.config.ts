import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      /*
       * `server-only` throws by design when it is resolved outside a server
       * environment. Tests exercise the marking modules directly, so they take
       * the same empty module Next hands to server components.
       */
      'server-only': fileURLToPath(new URL('./node_modules/server-only/empty.js', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    // `scripts/` as well as `src/`: the build-time migration gate lives there
    // (it is tooling, not app code) and is exactly the kind of thing that rots
    // silently once nobody is looking at it.
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
    /*
     * 15s, not vitest's 5s default.
     *
     * The suite is 2,091 tests, most of them mounting React components into
     * jsdom, run in parallel. Under that load a handful of the heaviest —
     * the spreadsheet shell, the Word marking matrix, the migration gate that
     * waits for a DNS refusal — crossed 5s and failed, then passed on their
     * own. Two sessions were spent treating that as flakiness in the tests.
     *
     * 15s is still short enough to catch a genuine hang; it is long enough
     * that a slow machine does not report a scheduling delay as a defect.
     */
    testTimeout: 15_000,
    css: true,
  },
});
