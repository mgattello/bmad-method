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

  it('inserts rows newest first and writes completed as 0/1', () => {
    const path = join(dir, 'insert.db');
    const repository = new SqliteTodoRepository(path);
    const first = {
      id: 'i1',
      description: 'first',
      completed: false,
      createdAt: '2026-10-26T12:00:00.000Z',
    };
    const second = {
      id: 'i2',
      description: 'second',
      completed: true,
      createdAt: '2026-10-26T12:00:00.001Z',
    };
    repository.insert(first);
    repository.insert(second);
    expect(repository.list()).toEqual([second, first]);

    const raw = new Database(path, { readonly: true });
    const rows = raw
      .prepare<[], { id: string; completed: number }>('SELECT id, completed FROM todos ORDER BY id')
      .all();
    raw.close();
    expect(rows).toEqual([
      { id: 'i1', completed: 0 },
      { id: 'i2', completed: 1 },
    ]);
    expect(() => repository.insert(first)).toThrow(/UNIQUE/);
    repository.close();
  });

  it('finds a row by id as a Todo with a boolean, or undefined on a miss', () => {
    const path = join(dir, 'find.db');
    const repository = new SqliteTodoRepository(path);
    const seed = new Database(path);
    const insert = seed.prepare(INSERT);
    insert.run('f1', 'done', 1, '2026-10-26T11:00:00.000Z');
    insert.run('f0', 'open', 0, '2026-10-26T10:00:00.000Z');
    seed.close();

    expect(repository.findById('f1')).toEqual({
      id: 'f1',
      description: 'done',
      completed: true,
      createdAt: '2026-10-26T11:00:00.000Z',
    });
    expect(repository.findById('f0')?.completed).toBe(false);
    expect(repository.findById('missing')).toBeUndefined();
    expect(repository.findById('')).toBeUndefined();
    repository.close();
  });

  it('rewrites one row on update with completed as 0/1 and created_at untouched', () => {
    const path = join(dir, 'update.db');
    const repository = new SqliteTodoRepository(path);
    const a = {
      id: 'u1',
      description: 'first',
      completed: false,
      createdAt: '2026-10-26T12:00:00.000Z',
    };
    const b = {
      id: 'u2',
      description: 'second',
      completed: true,
      createdAt: '2026-10-26T12:00:00.001Z',
    };
    repository.insert(a);
    repository.insert(b);

    repository.update({ ...a, description: 'renamed', completed: true, createdAt: 'ignored' });
    expect(repository.findById('u1')).toEqual({ ...a, description: 'renamed', completed: true });
    expect(repository.findById('u2')).toEqual(b);
    repository.update({ ...b, completed: false });
    expect(repository.list()).toEqual([
      { ...b, completed: false },
      { ...a, description: 'renamed', completed: true },
    ]);

    const raw = new Database(path, { readonly: true });
    const rows = raw
      .prepare<[], { id: string; description: string; completed: number; created_at: string }>(
        'SELECT id, description, completed, created_at FROM todos ORDER BY id',
      )
      .all();
    raw.close();
    expect(rows).toEqual([
      { id: 'u1', description: 'renamed', completed: 1, created_at: a.createdAt },
      { id: 'u2', description: 'second', completed: 0, created_at: b.createdAt },
    ]);
    expect(() => repository.update({ ...a, id: 'missing' })).not.toThrow();
    expect(repository.list()).toHaveLength(2);
    repository.close();
  });

  it('pings an open store, throws after close, and closes idempotently', () => {
    const repository = new SqliteTodoRepository(join(dir, 'ping.db'));
    expect(() => repository.ping()).not.toThrow();
    repository.close();
    expect(() => repository.ping()).toThrow('The database connection is not open');
    expect(() => repository.list()).toThrow('The database connection is not open');
    expect(() =>
      repository.insert({ id: 'x', description: 'x', completed: false, createdAt: 't' }),
    ).toThrow('The database connection is not open');
    expect(() => repository.findById('x')).toThrow('The database connection is not open');
    expect(() =>
      repository.update({ id: 'x', description: 'x', completed: false, createdAt: 't' }),
    ).toThrow('The database connection is not open');
    expect(() => repository.remove('x')).toThrow('The database connection is not open');
    expect(() => repository.close()).not.toThrow();
  });

  it('removes one row, leaves the others, and ignores a missing id', () => {
    const path = join(dir, 'remove.db');
    const repository = new SqliteTodoRepository(path);
    const seed = new Database(path);
    const insert = seed.prepare(INSERT);
    insert.run('a', 'first', 0, '2026-10-26T10:00:00.000Z');
    insert.run('b', 'second', 1, '2026-10-26T11:00:00.000Z');
    seed.close();

    repository.remove('a');
    expect(repository.findById('a')).toBeUndefined();
    expect(repository.list().map((t) => t.id)).toEqual(['b']);
    expect(() => repository.remove('missing')).not.toThrow();
    expect(repository.list()).toHaveLength(1);
    repository.close();
  });
});
