import { defineConfig, devices } from '@playwright/test';

import { BASE_URL } from './stack.ts';

// The stack is started by run.ts (or by hand); no webServer here (AD-11, AD-12).
export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  reporter: 'list',
  use: { baseURL: BASE_URL, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
