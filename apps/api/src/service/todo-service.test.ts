import { DESCRIPTION_MAX, type Todo } from '@todo/contract';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { InMemoryTodoRepository } from '../repository/in-memory-todo-repository.js';
import type { TodoRepository } from '../repository/todo-repository.js';
import { NotFoundError, ValidationError } from './errors.js';
import { TodoService } from './todo-service.js';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

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
      findById: () => undefined,
      insert: () => {},
      update: () => {},
      remove: () => {},
      ping: () => {},
      close: () => {},
    };
    const ids = new TodoService(unordered).list().map((t) => t.id);
    expect(ids).toEqual(['b', 'd', 'a', 'c']);
  });

  it('returns an empty list for an empty repository and never mutates the repository result', () => {
    const rows = [todo('a', T1), todo('b', T2)];
    const repository: TodoRepository = {
      list: () => rows,
      findById: () => undefined,
      insert: () => {},
      update: () => {},
      remove: () => {},
      ping: () => {},
      close: () => {},
    };
    expect(new TodoService(new InMemoryTodoRepository()).list()).toEqual([]);
    expect(new TodoService(repository).list().map((t) => t.id)).toEqual(['b', 'a']);
    expect(rows.map((t) => t.id)).toEqual(['a', 'b']);
  });
});

describe('TodoService.ping', () => {
  it('delegates to the repository and lets its failure propagate', () => {
    const ping = vi.fn();
    const ok: TodoRepository = {
      list: () => [],
      findById: () => undefined,
      insert: () => {},
      update: () => {},
      remove: () => {},
      ping,
      close: () => {},
    };
    new TodoService(ok).ping();
    expect(ping).toHaveBeenCalledTimes(1);

    const broken: TodoRepository = {
      list: () => [],
      findById: () => undefined,
      insert: () => {},
      update: () => {},
      remove: () => {},
      ping: () => {
        throw new Error('store down');
      },
      close: () => {},
    };
    expect(() => new TodoService(broken).ping()).toThrow('store down');
  });
});

describe('TodoService.create', () => {
  const RULE = `description must be 1 to ${DESCRIPTION_MAX} characters after trimming`;

  function stub(insert: TodoRepository['insert'] = () => {}): TodoRepository {
    return {
      list: () => [],
      findById: () => undefined,
      insert,
      update: () => {},
      remove: () => {},
      ping: () => {},
      close: () => {},
    };
  }

  it('trims, assigns id and createdAt, stores the trimmed value and returns it (golden)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-26T12:00:00.123Z'));
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('11111111-2222-4333-8444-555555555555');
    const repository = new InMemoryTodoRepository();
    const service = new TodoService(repository);
    const created = service.create('  Buy milk ');
    expect(created).toEqual({
      id: '11111111-2222-4333-8444-555555555555',
      description: 'Buy milk',
      completed: false,
      createdAt: '2026-10-26T12:00:00.123Z',
    });
    expect(repository.list()).toEqual([created]);
    expect(Object.keys(created)).toEqual(['id', 'description', 'completed', 'createdAt']);
  });

  it('formats createdAt with millisecond precision, including .000Z', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-26T12:00:00.000Z'));
    expect(new TodoService(stub()).create('x').createdAt).toBe('2026-10-26T12:00:00.000Z');
    vi.setSystemTime(new Date('2026-10-26T23:59:59.999Z'));
    expect(new TodoService(stub()).create('x').createdAt).toBe('2026-10-26T23:59:59.999Z');
  });

  it('uses a fresh UUID v4 per create by default', () => {
    const service = new TodoService(stub());
    const a = service.create('a');
    const b = service.create('b');
    const v4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    expect(a.id).toMatch(v4);
    expect(b.id).toMatch(v4);
    expect(a.id).not.toBe(b.id);
  });

  it('accepts exactly DESCRIPTION_MAX characters and 1 character after trim', () => {
    const service = new TodoService(stub());
    const max = 'a'.repeat(DESCRIPTION_MAX);
    expect(service.create(max).description).toBe(max);
    expect(service.create(`  ${max}  `).description).toBe(max);
    expect(service.create(' b ').description).toBe('b');
  });

  it('rejects DESCRIPTION_MAX + 1 characters after trim without inserting', () => {
    const insert = vi.fn();
    const service = new TodoService(stub(insert));
    let caught: unknown;
    try {
      service.create('a'.repeat(DESCRIPTION_MAX + 1));
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ValidationError);
    expect(caught).toMatchObject({ statusCode: 400, name: 'ValidationError', message: RULE });
    expect(insert).not.toHaveBeenCalled();
  });

  it.each(['', '   ', '\t\n'])('rejects %j as empty after trim without inserting', (input) => {
    const insert = vi.fn();
    const service = new TodoService(stub(insert));
    let caught: unknown;
    try {
      service.create(input);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ValidationError);
    expect(caught).toMatchObject({ statusCode: 400, name: 'ValidationError', message: RULE });
    expect(insert).not.toHaveBeenCalled();
  });

  it('lists the second of two creates first', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-26T12:00:00.000Z'));
    const service = new TodoService(new InMemoryTodoRepository());
    const first = service.create('first');
    vi.setSystemTime(new Date('2026-10-26T12:00:00.001Z'));
    const second = service.create('second');
    expect(service.list()).toEqual([second, first]);
  });

  it('lets a repository insert failure propagate', () => {
    const service = new TodoService(
      stub(() => {
        throw new Error('The database connection is not open');
      }),
    );
    expect(() => service.create('x')).toThrow('The database connection is not open');
  });
});

describe('TodoService.update', () => {
  const RULE = `description must be 1 to ${DESCRIPTION_MAX} characters after trimming`;
  const open: Todo = { id: 'open', description: 'Buy milk', completed: false, createdAt: T1 };
  const done: Todo = { id: 'done', description: 'Walk dog', completed: true, createdAt: T2 };

  function setup() {
    const repository = new InMemoryTodoRepository([open, done]);
    const update = vi.spyOn(repository, 'update');
    return { service: new TodoService(repository), repository, update };
  }

  function catching(run: () => unknown): unknown {
    try {
      run();
    } catch (error) {
      return error;
    }
    return undefined;
  }

  it('ticks an open Todo, keeping id, description and createdAt, and stores the row', () => {
    const { service, repository, update } = setup();
    const result = service.update('open', { completed: true });
    expect(result).toEqual({ ...open, completed: true });
    expect(Object.keys(result)).toEqual(['id', 'description', 'completed', 'createdAt']);
    expect(update).toHaveBeenCalledTimes(1);
    expect(repository.findById('open')).toEqual({ ...open, completed: true });
    expect(repository.findById('done')).toEqual(done);
  });

  it('unticks a Completed Todo, keeping id, description and createdAt', () => {
    const { service, repository } = setup();
    expect(service.update('done', { completed: false })).toEqual({ ...done, completed: false });
    expect(repository.findById('done')).toEqual({ ...done, completed: false });
  });

  it('trims a description, stores the trimmed value and leaves completed unchanged', () => {
    const { service, repository } = setup();
    expect(service.update('done', { description: '  New text  ' })).toEqual({
      ...done,
      description: 'New text',
    });
    expect(repository.findById('done')).toEqual({ ...done, description: 'New text' });
  });

  it('applies both fields when both are present', () => {
    const { service, repository } = setup();
    expect(service.update('open', { description: ' x ', completed: true })).toEqual({
      ...open,
      description: 'x',
      completed: true,
    });
    expect(repository.findById('open')).toEqual({ ...open, description: 'x', completed: true });
  });

  it('accepts exactly DESCRIPTION_MAX characters after trim', () => {
    const { service } = setup();
    const max = 'a'.repeat(DESCRIPTION_MAX);
    expect(service.update('open', { description: `  ${max}  ` }).description).toBe(max);
  });

  it.each(['', '   ', 'a'.repeat(DESCRIPTION_MAX + 1)])(
    'rejects %j with ValidationError and does not call update',
    (description) => {
      const { service, repository, update } = setup();
      const caught = catching(() => service.update('open', { description, completed: true }));
      expect(caught).toBeInstanceOf(ValidationError);
      expect(caught).toMatchObject({ statusCode: 400, name: 'ValidationError', message: RULE });
      expect(update).not.toHaveBeenCalled();
      expect(repository.findById('open')).toEqual(open);
    },
  );

  it('throws NotFoundError for an unknown id and does not call update', () => {
    const { service, update } = setup();
    const caught = catching(() => service.update('missing', { completed: true }));
    expect(caught).toBeInstanceOf(NotFoundError);
    expect(caught).toMatchObject({ statusCode: 404, name: 'NotFoundError' });
    expect(update).not.toHaveBeenCalled();
  });

  it('answers not-found before the description rule', () => {
    const { service, update } = setup();
    const caught = catching(() => service.update('missing', { description: '' }));
    expect(caught).toBeInstanceOf(NotFoundError);
    expect(update).not.toHaveBeenCalled();
  });

  it('lets a repository update failure propagate', () => {
    const repository = new InMemoryTodoRepository([open]);
    vi.spyOn(repository, 'update').mockImplementation(() => {
      throw new Error('The database connection is not open');
    });
    expect(() => new TodoService(repository).update('open', { completed: true })).toThrow(
      'The database connection is not open',
    );
  });
});

describe('TodoService.delete', () => {
  it('removes the Todo from the repository and leaves the others', () => {
    const repository = new InMemoryTodoRepository([todo('a', T1), todo('b', T2)]);

    new TodoService(repository).delete('a');

    expect(repository.list().map((t) => t.id)).toEqual(['b']);
  });

  it('throws NotFoundError for an unknown id and removes nothing', () => {
    const remove = vi.fn();
    const repository: TodoRepository = {
      list: () => [],
      findById: () => undefined,
      insert: () => {},
      update: () => {},
      remove,
      ping: () => {},
      close: () => {},
    };

    expect(() => new TodoService(repository).delete('nope')).toThrow(NotFoundError);
    expect(remove).not.toHaveBeenCalled();
  });

  it('lets a repository failure propagate', () => {
    const repository: TodoRepository = {
      list: () => [],
      findById: () => todo('a', T1),
      insert: () => {},
      update: () => {},
      remove: () => {
        throw new Error('The database connection is not open');
      },
      ping: () => {},
      close: () => {},
    };

    expect(() => new TodoService(repository).delete('a')).toThrow(
      'The database connection is not open',
    );
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

  it('insert stores a copy and later insertions win createdAt ties', () => {
    const repository = new InMemoryTodoRepository([todo('a', T1)]);
    const b = todo('b', T1);
    repository.insert(b);
    b.description = 'mutated';
    expect(repository.list().map((t) => t.id)).toEqual(['b', 'a']);
    expect(repository.list()[0]?.description).toBe('b');
  });

  it('findById returns a copy, or undefined for an unknown id', () => {
    const repository = new InMemoryTodoRepository([todo('a', T1)]);
    const found = repository.findById('a');
    expect(found).toEqual(todo('a', T1));
    found!.description = 'mutated';
    expect(repository.findById('a')?.description).toBe('a');
    expect(repository.findById('zzz')).toBeUndefined();
  });

  it('update replaces the row in place, keeps list order and ignores an unknown id', () => {
    const repository = new InMemoryTodoRepository([todo('a', T1), todo('b', T1), todo('c', T1)]);
    const patched = { ...todo('a', T1), completed: true };
    repository.update(patched);
    patched.description = 'mutated';
    expect(repository.list().map((t) => t.id)).toEqual(['c', 'b', 'a']);
    expect(repository.findById('a')).toEqual({ ...todo('a', T1), completed: true });
    repository.update(todo('zzz', T2));
    expect(repository.list()).toHaveLength(3);
  });
});
