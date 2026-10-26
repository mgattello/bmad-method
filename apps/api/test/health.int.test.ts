import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { HEALTH_PATH } from '@todo/contract';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildApp } from '../src/app.js';
import { SqliteTodoRepository } from '../src/repository/sqlite-todo-repository.js';

let dir: string;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'todo-api-int-health-'));
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe(`GET ${HEALTH_PATH}`, () => {
  it('reports ok while the store is open and degraded once it is closed', async () => {
    const repository = new SqliteTodoRepository(join(dir, 'todos.db'));
    const app = buildApp({ repository });

    const ok = await app.inject({ method: 'GET', url: HEALTH_PATH });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toEqual({ status: 'ok' });

    repository.close();
    const degraded = await app.inject({ method: 'GET', url: HEALTH_PATH });
    expect(degraded.statusCode).toBe(503);
    expect(degraded.json()).toEqual({ status: 'degraded' });

    await app.close();
  });
});
