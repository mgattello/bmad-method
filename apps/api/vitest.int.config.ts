import { defineConfig } from 'vitest/config';

// Integration specs (fastify.inject + temp SQLite) arrive in Story 1.2.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.int.test.ts'],
    env: { LOG_LEVEL: 'silent' },
  },
});
