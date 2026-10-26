import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { TODOS_PATH, type Todo } from '@todo/contract';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildApp } from '../src/app.js';
import { SqliteTodoRepository, openDatabase } from '../src/repository/sqlite-todo-repository.js';

let dir: string;
let dbPath: string;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'todo-api-int-todos-'));
  dbPath = join(dir, 'todos.db');
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

const T1 = '2026-10-26T10:00:00.000Z';
const T2 = '2026-10-26T11:00:00.000Z';

function seed(rows: Array<[string, string, 0 | 1, string]>): void {
  const db = openDatabase(dbPath);
  const insert = db.prepare(
    'INSERT INTO todos (id, description, completed, created_at) VALUES (?, ?, ?, ?)',
  );
  for (const row of rows) insert.run(...row);
  db.close();
}

describe(`GET ${TODOS_PATH}`, () => {
  it('creates the store on first open and lists an empty array', async () => {
    expect(existsSync(dbPath)).toBe(false);
    const app = buildApp({ repository: new SqliteTodoRepository(dbPath) });
    const res = await app.inject({ method: 'GET', url: TODOS_PATH });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
    expect(existsSync(dbPath)).toBe(true);
    await app.close();
  });

  it('lists seeded rows newest first with the exact field set, and the order survives a restart', async () => {
    seed([
      ['t2', 'later', 1, T2],
      ['t1-first', 'earlier', 0, T1],
      ['t1-second', 'earlier too', 0, T1],
    ]);
    const expected: Todo[] = [
      { id: 't2', description: 'later', completed: true, createdAt: T2 },
      { id: 't1-second', description: 'earlier too', completed: false, createdAt: T1 },
      { id: 't1-first', description: 'earlier', completed: false, createdAt: T1 },
    ];

    const first = buildApp({ repository: new SqliteTodoRepository(dbPath) });
    const res = await first.inject({ method: 'GET', url: TODOS_PATH });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(expected);
    for (const todo of res.json<Todo[]>()) {
      expect(Object.keys(todo)).toEqual(['id', 'description', 'completed', 'createdAt']);
    }
    await first.close();

    const second = buildApp({ repository: new SqliteTodoRepository(dbPath) });
    const again = await second.inject({ method: 'GET', url: TODOS_PATH });
    expect(again.statusCode).toBe(200);
    expect(again.json()).toEqual(expected);
    await second.close();
  });
});
