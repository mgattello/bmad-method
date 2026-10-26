import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Writable } from 'node:stream';

import { DESCRIPTION_MAX, ErrorCode, TODOS_PATH, type Todo } from '@todo/contract';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { buildApp, type AppDeps } from '../src/app.js';
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

describe(`POST ${TODOS_PATH}`, () => {
  const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  const ISO_MS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
  const RULE = `description must be 1 to ${DESCRIPTION_MAX} characters after trimming`;
  const apps: Array<ReturnType<typeof buildApp>> = [];

  function open(deps: Partial<AppDeps> = {}) {
    const app = buildApp({
      repository: deps.repository ?? new SqliteTodoRepository(dbPath),
      ...deps,
    });
    apps.push(app);
    return app;
  }

  function count(): number {
    const db = openDatabase(dbPath);
    const row = db.prepare<[], { n: number }>('SELECT COUNT(*) AS n FROM todos').get();
    db.close();
    return row?.n ?? 0;
  }

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  it('creates a trimmed Todo with server-assigned id and createdAt, durable across apps', async () => {
    const before = count();
    const app = open();
    const res = await app.inject({
      method: 'POST',
      url: TODOS_PATH,
      payload: { description: '  Buy milk  ' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    const created = res.json<Todo>();
    expect(Object.keys(created)).toEqual(['id', 'description', 'completed', 'createdAt']);
    expect(created).toMatchObject({ description: 'Buy milk', completed: false });
    expect(created.id).toMatch(UUID_V4);
    expect(created.createdAt).toMatch(ISO_MS);
    await app.close();

    const second = open();
    const list = await second.inject({ method: 'GET', url: TODOS_PATH });
    expect(list.json<Todo[]>()[0]).toEqual(created);
    expect(count()).toBe(before + 1);

    const db = openDatabase(dbPath);
    const row = db
      .prepare<
        [string],
        { id: string; description: string; completed: number; created_at: string }
      >('SELECT id, description, completed, created_at FROM todos WHERE id = ?')
      .get(created.id);
    db.close();
    expect(row).toEqual({
      id: created.id,
      description: 'Buy milk',
      completed: 0,
      created_at: created.createdAt,
    });
  });

  it('lists two creates newest first ahead of the seeded rows', async () => {
    const app = open();
    const first = (
      await app.inject({ method: 'POST', url: TODOS_PATH, payload: { description: 'first' } })
    ).json<Todo>();
    const second = (
      await app.inject({ method: 'POST', url: TODOS_PATH, payload: { description: 'second' } })
    ).json<Todo>();
    expect(second.createdAt >= first.createdAt).toBe(true);
    const ids = (await app.inject({ method: 'GET', url: TODOS_PATH }))
      .json<Todo[]>()
      .map((t) => t.id);
    expect(ids.indexOf(second.id)).toBe(0);
    expect(ids.indexOf(first.id)).toBe(1);
  });

  it('accepts exactly DESCRIPTION_MAX characters after trim and a single character', async () => {
    const app = open();
    const max = 'a'.repeat(DESCRIPTION_MAX);
    const padded = await app.inject({
      method: 'POST',
      url: TODOS_PATH,
      payload: { description: `  ${max}  ` },
    });
    expect(padded.statusCode).toBe(201);
    expect(padded.json<Todo>().description).toBe(max);
    const one = await app.inject({
      method: 'POST',
      url: TODOS_PATH,
      payload: { description: 'x' },
    });
    expect(one.statusCode).toBe(201);
    expect(one.json<Todo>().description).toBe('x');
  });

  it.each([
    ['empty', ''],
    ['spaces', '   '],
    ['tab and newline', '\t\n'],
    ['too long after trim', `  ${'a'.repeat(DESCRIPTION_MAX + 1)}  `],
  ])('rejects %s with 400 VALIDATION_ERROR and inserts nothing', async (_label, description) => {
    const before = count();
    const res = await open().inject({ method: 'POST', url: TODOS_PATH, payload: { description } });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ code: ErrorCode.VALIDATION_ERROR, message: RULE });
    expect(count()).toBe(before);
  });

  it.each([
    ['a number', { description: 42 }],
    ['null', { description: null }],
    ['a missing field', {}],
    ['an unknown field', { description: 'x', completed: true }],
  ])('rejects %s with 400 VALIDATION_ERROR and inserts nothing', async (_label, payload) => {
    const before = count();
    const res = await open().inject({ method: 'POST', url: TODOS_PATH, payload });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ code: ErrorCode.VALIDATION_ERROR, message: 'Invalid request' });
    expect(count()).toBe(before);
  });

  it.each([
    ['malformed JSON', '{not json', 'application/json'],
    ['an empty JSON body', '', 'application/json'],
    ['an unsupported content type', 'description=x', 'text/plain'],
    ['a JSON array', '[]', 'application/json'],
    ['a form body', 'description=x', 'application/x-www-form-urlencoded'],
  ])('rejects %s with 400 VALIDATION_ERROR and no library text', async (_label, body, type) => {
    const before = count();
    const res = await open().inject({
      method: 'POST',
      url: TODOS_PATH,
      payload: body,
      headers: { 'content-type': type },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ code: ErrorCode.VALIDATION_ERROR, message: 'Invalid request' });
    expect(res.body).not.toMatch(/FST_|Unsupported|JSON/);
    expect(count()).toBe(before);
  });

  it('answers a closed store with 500 INTERNAL_ERROR, no library text, and logs the error', async () => {
    const lines: Record<string, unknown>[] = [];
    const stream = new Writable({
      write(chunk, _encoding, callback) {
        lines.push(JSON.parse(String(chunk)) as Record<string, unknown>);
        callback();
      },
    });
    const repository = new SqliteTodoRepository(dbPath);
    const app = open({ repository, logger: { level: 'error', stream } });
    repository.close();
    const res = await app.inject({
      method: 'POST',
      url: TODOS_PATH,
      payload: { description: 'Buy milk' },
    });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ code: ErrorCode.INTERNAL_ERROR, message: 'Unexpected error' });
    expect(res.body).not.toMatch(/database|connection|stack/i);
    expect(lines.filter((line) => line.level === 50)).toHaveLength(1);
  });
});
