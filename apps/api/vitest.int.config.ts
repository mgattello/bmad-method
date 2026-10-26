import { defineConfig } from 'vitest/config';

// Integration specs: fastify.inject against buildApp on a temp SQLite file per spec file.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.int.test.ts'],
    env: { LOG_LEVEL: 'silent' },
  },
});
