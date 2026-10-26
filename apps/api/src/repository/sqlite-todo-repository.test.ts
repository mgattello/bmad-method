import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import Database from 'better-sqlite3';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SqliteTodoRepository, openDatabase } from './sqlite-todo-repository.js';

let dir: string;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'todo-api-unit-'));
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

const INSERT = 'INSERT INTO todos (id, description, completed, created_at) VALUES (?, ?, ?, ?)';

describe('openDatabase', () => {
  it('creates the table idempotently and applies WAL plus synchronous FULL', () => {
    const path = join(dir, 'open.db');
    const first = openDatabase(path);
    first.close();
    const second = openDatabase(path);
    expect(second.pragma('journal_mode', { simple: true })).toBe('wal');
    expect(second.pragma('synchronous', { simple: true })).toBe(2);
    const columns = (second.pragma('table_info(todos)') as Array<{ name: string }>).map(
      (c) => c.name,
    );
    expect(columns).toEqual(['id', 'description', 'completed', 'created_at']);
    expect(() => second.prepare(INSERT).run('x', 'd', 2, 't')).toThrow(/CHECK/);
    second.close();
  });
});

describe('SqliteTodoRepository', () => {
  it('lists newest first with insertion order breaking ties and maps 0/1 to booleans', () => {
    const path = join(dir, 'list.db');
    const repository = new SqliteTodoRepository(path);
    expect(repository.list()).toEqual([]);

    const seed = new Database(path);
    const insert = seed.prepare(INSERT);
    insert.run('t2', 'done', 1, '2026-10-26T11:00:00.000Z');
    insert.run('t1-first', 'open', 0, '2026-10-26T10:00:00.000Z');
    insert.run('t1-second', 'open', 0, '2026-10-26T10:00:00.000Z');
    seed.close();

    expect(repository.list()).toEqual([
      { id: 't2', description: 'done', completed: true, createdAt: '2026-10-26T11:00:00.000Z' },
      {
        id: 't1-second',
        description: 'open',
        completed: false,
        createdAt: '2026-10-26T10:00:00.000Z',
      },
      {
        id: 't1-first',
        description: 'open',
        completed: false,
        createdAt: '2026-10-26T10:00:00.000Z',
      },
    ]);
    repository.close();
  });

  it('pings an open store, throws after close, and closes idempotently', () => {
    const repository = new SqliteTodoRepository(join(dir, 'ping.db'));
    expect(() => repository.ping()).not.toThrow();
    repository.close();
    expect(() => repository.ping()).toThrow('The database connection is not open');
    expect(() => repository.list()).toThrow('The database connection is not open');
    expect(() => repository.close()).not.toThrow();
  });
});
