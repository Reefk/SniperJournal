import { fileURLToPath } from 'node:url';
import { coverageConfigDefaults, defineConfig } from 'vitest/config';

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
      // The logic, the API routes and the store's plain modules (autosave,
      // confirm, mirror, rescue, sanitize, selectors), plus the three components
      // with render tests of their own: the dialog (tests/modal.test.ts), the
      // trade form (tests/trade-form.test.ts) and the import dialog
      // (tests/import-dialog.test.ts). Other .tsx files, the providers among
      // them, only count once a render test is about them.
      include: [
        'src/lib/**/*.ts',
        'src/store/**/*.ts',
        'src/app/api/**/*.ts',
        'src/components/ui/Modal.tsx',
        'src/components/trades/TradeFormModal.tsx',
        'src/components/trades/ImportTradesModal.tsx',
      ],
      // sample.ts only makes up the demo trades of Load test data. Some tests
      // build their journals with it, which covers it without testing it, and
      // whatever it covers or not says nothing about the numbers you see.
      exclude: [...coverageConfigDefaults.exclude, 'src/lib/sample.ts'],
      reporter: ['text-summary', 'text'],
    },
  },
});
