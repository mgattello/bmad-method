import { spawnSync, type StdioOptions } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// One home for the E2E compose project name and host port (AD-11).
export const COMPOSE_PROJECT = 'todo-e2e';
export const WEB_PORT = '8081';
export const BASE_URL = `http://localhost:${WEB_PORT}`;
export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export type ComposeOptions = { stdio?: StdioOptions };

// Runs `docker compose -p todo-e2e <args>` from the repo root; returns stdout, throws on failure.
export function compose(args: string[], { stdio = 'pipe' }: ComposeOptions = {}): string {
  const result = spawnSync('docker', ['compose', '-p', COMPOSE_PROJECT, ...args], {
    cwd: REPO_ROOT,
    env: { ...process.env, WEB_PORT },
    stdio,
    encoding: 'utf8',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = result.stderr ? `\n${result.stderr.trim()}` : '';
    const outcome =
      result.status === null ? `killed by ${result.signal}` : `exited with ${result.status}`;
    throw new Error(`docker compose ${args.join(' ')} ${outcome}${detail}`);
  }
  return result.stdout ?? '';
}
