import type { Todo } from '@todo/contract';
import { describe, expect, it, vi } from 'vitest';

import { InMemoryTodoRepository } from '../repository/in-memory-todo-repository.js';
import type { TodoRepository } from '../repository/todo-repository.js';
import { TodoService } from './todo-service.js';

const todo = (id: string, createdAt: string): Todo => ({
  id,
  description: id,
  completed: false,
  createdAt,
});

const T1 = '2026-10-26T10:00:00.000Z';
const T2 = '2026-10-26T11:00:00.000Z';

describe('TodoService.list', () => {
  it('returns newest first with later insertions winning ties (in-memory repository)', () => {
    const repository = new InMemoryTodoRepository([
      todo('t2', T2),
      todo('t1-first', T1),
      todo('t1-second', T1),
    ]);
    const ids = new TodoService(repository).list().map((t) => t.id);
    expect(ids).toEqual(['t2', 't1-second', 't1-first']);
  });

  it('sorts an unordered repository result by createdAt desc and keeps repository order on ties', () => {
    const unordered: TodoRepository = {
      list: () => [todo('a', T1), todo('b', T2), todo('c', T1), todo('d', T2)],
      ping: () => {},
      close: () => {},
    };
    const ids = new TodoService(unordered).list().map((t) => t.id);
    expect(ids).toEqual(['b', 'd', 'a', 'c']);
  });

  it('returns an empty list for an empty repository and never mutates the repository result', () => {
    const rows = [todo('a', T1), todo('b', T2)];
    const repository: TodoRepository = { list: () => rows, ping: () => {}, close: () => {} };
    expect(new TodoService(new InMemoryTodoRepository()).list()).toEqual([]);
    expect(new TodoService(repository).list().map((t) => t.id)).toEqual(['b', 'a']);
    expect(rows.map((t) => t.id)).toEqual(['a', 'b']);
  });
});

describe('TodoService.ping', () => {
  it('delegates to the repository and lets its failure propagate', () => {
    const ping = vi.fn();
    const ok: TodoRepository = { list: () => [], ping, close: () => {} };
    new TodoService(ok).ping();
    expect(ping).toHaveBeenCalledTimes(1);

    const broken: TodoRepository = {
      list: () => [],
      ping: () => {
        throw new Error('store down');
      },
      close: () => {},
    };
    expect(() => new TodoService(broken).ping()).toThrow('store down');
  });
});

describe('InMemoryTodoRepository', () => {
  it('returns a fresh copy each time', () => {
    const repository = new InMemoryTodoRepository([todo('a', T1)]);
    const first = repository.list();
    first.pop();
    expect(repository.list()).toHaveLength(1);
    expect(() => repository.ping()).not.toThrow();
    expect(() => repository.close()).not.toThrow();
  });
});
