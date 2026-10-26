import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { API_PREFIX, ErrorCode, TODOS_PATH } from '@todo/contract';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildApp } from '../src/app.js';
import { SqliteTodoRepository } from '../src/repository/sqlite-todo-repository.js';

let dir: string;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'todo-api-int-errors-'));
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('error envelope', () => {
  it('answers unknown routes and a trailing slash with 404 NOT_FOUND', async () => {
    const app = buildApp({ repository: new SqliteTodoRepository(join(dir, 'todos.db')) });
    for (const url of [`${API_PREFIX}/nope`, `${TODOS_PATH}/`]) {
      const res = await app.inject({ method: 'GET', url });
      expect(res.statusCode).toBe(404);
      const body = res.json<Record<string, unknown>>();
      expect(body.code).toBe(ErrorCode.NOT_FOUND);
      expect(typeof body.message).toBe('string');
      expect(Object.keys(body).sort()).toEqual(['code', 'message']);
    }
    await app.close();
  });

  it('answers a closed store with 500 INTERNAL_ERROR and no library text', async () => {
    const repository = new SqliteTodoRepository(join(dir, 'closed.db'));
    const app = buildApp({ repository });
    repository.close();
    const res = await app.inject({ method: 'GET', url: TODOS_PATH });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ code: ErrorCode.INTERNAL_ERROR, message: 'Unexpected error' });
    expect(res.body).not.toMatch(/database|connection|stack/i);
    await app.close();
  });
});
