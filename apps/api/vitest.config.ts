import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    env: { LOG_LEVEL: 'silent' },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // Entry point only wires env and listen.
      exclude: ['src/server.ts'],
      thresholds: { lines: 70, branches: 70 },
    },
  },
});
