import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Unit and integration tests for the journal's logic. They run in Node, never
 * touch a real journal, and use synthetic data only (see tests/helpers.ts).
 *
 *   npm test           run everything once
 *   npm run coverage   the same, with a coverage report
 *   npm run bench      the performance measurements in tests/bench
 */
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    // `npm run bench` runs the timings in tests/bench instead of the tests
    include: process.env.npm_lifecycle_event === 'bench' ? ['tests/bench/**/*.bench.ts'] : ['tests/**/*.test.ts'],
    environment: 'node',
    // wall-clock dates are stored without a zone, so pin one: results must not
    // depend on the machine running the tests. Tests that need a particular
    // zone (DST and so on) set it themselves.
    env: { TZ: 'UTC' },
    coverage: {
      provider: 'v8',
      include: ['src/lib/**/*.ts', 'src/store/sanitize.ts', 'src/app/api/**/*.ts'],
      reporter: ['text-summary', 'text'],
    },
  },
});
