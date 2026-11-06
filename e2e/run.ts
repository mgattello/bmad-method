import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { compose } from './stack.ts';

// Lifecycle runner (AD-11): down -v, up --build --wait, Playwright, down -v always.
const E2E_DIR = path.dirname(fileURLToPath(import.meta.url));
const PLAYWRIGHT_CLI = createRequire(import.meta.url).resolve('@playwright/test/cli');

function report(error: unknown): void {
  console.error(error instanceof Error ? error.message : error);
}

// Survive Ctrl-C: the child dies from the signal, spawnSync returns, finally tears down.
process.on('SIGINT', () => {});
process.on('SIGTERM', () => {});

let status = 1;
try {
  compose(['down', '-v'], { stdio: 'inherit' });
  compose(['up', '--build', '--wait'], { stdio: 'inherit' });
  const result = spawnSync(process.execPath, [PLAYWRIGHT_CLI, 'test', ...process.argv.slice(2)], {
    cwd: E2E_DIR,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  status = result.status ?? 1;
} catch (error) {
  report(error);
} finally {
  try {
    compose(['down', '-v'], { stdio: 'inherit' });
  } catch (error) {
    report(error);
    status = 1;
  }
}
process.exit(status);
