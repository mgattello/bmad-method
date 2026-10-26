import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores([
    '**/dist/',
    '**/node_modules/',
    '**/coverage/',
    '_bmad*/',
    '.claude/',
    '**/test-results/',
    '**/playwright-report/',
  ]),
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended],
  },
]);
