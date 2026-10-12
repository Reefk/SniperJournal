import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier/flat';

/**
 * `npm run lint`. Next's recommended rules (React, hooks, accessibility,
 * TypeScript), with every formatting rule switched off: formatting follows
 * .prettierrc and is not ESLint's job.
 */
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  {
    // React's newer hooks rules flag existing components: helper components
    // declared inside ReportsView and TradesView (22) and setState called
    // straight from an effect (4). Shown as warnings until those components
    // are reworked; see the roadmap. New code should not add to the count.
    rules: {
      'react-hooks/static-components': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
  globalIgnores([
    // Next's own default ignores
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    // build output and local data
    '.next-desktop/**',
    'coverage/**',
    'data/**',
    // the Android project, including the copy of the web build inside it
    'android/**',
  ]),
]);

export default eslintConfig;
