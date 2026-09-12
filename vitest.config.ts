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
    css: true,
  },
});
