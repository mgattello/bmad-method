import { Writable } from 'node:stream';

import { API_PREFIX, ErrorCode, HEALTH_PATH, TODOS_PATH, type Todo } from '@todo/contract';
import Type from 'typebox';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildApp } from './app.js';
import { InMemoryTodoRepository } from './repository/in-memory-todo-repository.js';
import type { TodoRepository } from './repository/todo-repository.js';

const T1 = '2026-10-26T10:00:00.000Z';
const T2 = '2026-10-26T11:00:00.000Z';
const seed: Todo[] = [
  { id: 't2', description: 'later', completed: true, createdAt: T2 },
  { id: 't1-first', description: 'earlier', completed: false, createdAt: T1 },
  { id: 't1-second', description: 'earlier too', completed: false, createdAt: T1 },
];

const closers: Array<() => Promise<void>> = [];
afterEach(async () => {
  await Promise.all(closers.splice(0).map((close) => close()));
  vi.restoreAllMocks();
});

function app(repository: TodoRepository = new InMemoryTodoRepository(seed)) {
  const instance = buildApp({ repository });
  closers.push(() => instance.close());
  return instance;
}

function withLogCapture(repository: TodoRepository) {
  const lines: Record<string, unknown>[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      lines.push(JSON.parse(String(chunk)) as Record<string, unknown>);
      callback();
    },
  });
  const instance = buildApp({ repository, logger: { level: 'info', stream } });
  closers.push(() => instance.close());
  return { instance, lines };
}

const broken: TodoRepository = {
  list: () => {
    throw new Error('The database connection is not open');
  },
  ping: () => {
    throw new Error('The database connection is not open');
  },
  close: () => {},
};

describe('GET todos', () => {
  it('returns a bare array newest first with exactly the contract fields', async () => {
    const res = await app().inject({ method: 'GET', url: TODOS_PATH });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    const body = res.json<Todo[]>();
    expect(Array.isArray(body)).toBe(true);
    expect(body.map((t) => t.id)).toEqual(['t2', 't1-second', 't1-first']);
    expect(body.map((t) => t.completed)).toEqual([true, false, false]);
    for (const todo of body) {
      expect(Object.keys(todo).sort()).toEqual(['completed', 'createdAt', 'description', 'id']);
    }
  });

  it('returns [] for an empty repository', async () => {
    const res = await app(new InMemoryTodoRepository()).inject({ method: 'GET', url: TODOS_PATH });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });
});

describe('GET health', () => {
  it('returns 200 ok when ping succeeds', async () => {
    const res = await app().inject({ method: 'GET', url: HEALTH_PATH });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });

  it('returns 503 degraded when ping throws, outside the error envelope', async () => {
    const res = await app(broken).inject({ method: 'GET', url: HEALTH_PATH });
    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ status: 'degraded' });
  });
});

describe('error envelope', () => {
  it('answers unknown routes and trailing slashes with 404 NOT_FOUND', async () => {
    const instance = app();
    for (const url of [`${API_PREFIX}/nope`, `${TODOS_PATH}/`, '/']) {
      const res = await instance.inject({ method: 'GET', url });
      expect(res.statusCode).toBe(404);
      const body = res.json<Record<string, unknown>>();
      expect(body.code).toBe(ErrorCode.NOT_FOUND);
      expect(typeof body.message).toBe('string');
      expect(Object.keys(body).sort()).toEqual(['code', 'message']);
    }
  });

  it('answers a repository failure with 500 INTERNAL_ERROR, a generic message and an error log', async () => {
    const { instance, lines } = withLogCapture(broken);
    const res = await instance.inject({ method: 'GET', url: TODOS_PATH });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ code: ErrorCode.INTERNAL_ERROR, message: 'Unexpected error' });
    expect(res.body).not.toMatch(/database|stack|at /);
    const errorLines = lines.filter((line) => line.level === 50);
    expect(errorLines).toHaveLength(1);
    expect(JSON.stringify(errorLines[0])).toContain('The database connection is not open');
  });

  it('maps an error with a 404 status to NOT_FOUND and any other 4xx to 400 VALIDATION_ERROR', async () => {
    const instance = app();
    instance.get('/gone', async () => {
      throw Object.assign(new Error('library gone text'), { statusCode: 404 });
    });
    instance.get('/teapot', async () => {
      throw Object.assign(new Error('library teapot text'), { statusCode: 418 });
    });
    const gone = await instance.inject({ method: 'GET', url: '/gone' });
    expect(gone.statusCode).toBe(404);
    expect(gone.json()).toEqual({ code: ErrorCode.NOT_FOUND, message: 'Not found' });
    const teapot = await instance.inject({ method: 'GET', url: '/teapot' });
    expect(teapot.statusCode).toBe(400);
    expect(teapot.json()).toEqual({ code: ErrorCode.VALIDATION_ERROR, message: 'Invalid request' });
    expect(teapot.body).not.toContain('library');
  });

  it('validates without coercion or stripping, and rejects malformed JSON, as VALIDATION_ERROR', async () => {
    const instance = app();
    instance.post(
      '/echo',
      {
        schema: {
          body: Type.Object({ n: Type.Number() }, { additionalProperties: false }),
        },
      },
      async (request) => request.body,
    );
    const coerced = await instance.inject({ method: 'POST', url: '/echo', payload: { n: '1' } });
    expect(coerced.statusCode).toBe(400);
    expect(coerced.json()).toEqual({
      code: ErrorCode.VALIDATION_ERROR,
      message: 'Invalid request',
    });
    const extra = await instance.inject({ method: 'POST', url: '/echo', payload: { n: 1, x: 1 } });
    expect(extra.statusCode).toBe(400);
    const malformed = await instance.inject({
      method: 'POST',
      url: '/echo',
      payload: '{not json',
      headers: { 'content-type': 'application/json' },
    });
    expect(malformed.statusCode).toBe(400);
    expect(malformed.json()).toEqual({
      code: ErrorCode.VALIDATION_ERROR,
      message: 'Invalid request',
    });
    const ok = await instance.inject({ method: 'POST', url: '/echo', payload: { n: 1 } });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toEqual({ n: 1 });
  });
});

describe('request log', () => {
  it('emits exactly one info completion line per request with the four fields', async () => {
    const { instance, lines } = withLogCapture(new InMemoryTodoRepository(seed));
    await instance.inject({ method: 'GET', url: TODOS_PATH });
    await instance.inject({ method: 'GET', url: `${API_PREFIX}/nope` });
    const completions = lines.filter((line) => line.level === 30);
    expect(lines).toHaveLength(2);
    expect(completions).toHaveLength(2);
    expect(completions[0]).toMatchObject({ method: 'GET', url: TODOS_PATH, statusCode: 200 });
    expect(typeof completions[0]?.responseTime).toBe('number');
    expect(completions[1]).toMatchObject({
      method: 'GET',
      url: `${API_PREFIX}/nope`,
      statusCode: 404,
    });
  });

  it('writes nothing when the logger is off', async () => {
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const res = await app().inject({ method: 'GET', url: TODOS_PATH });
    expect(res.statusCode).toBe(200);
    expect(write).not.toHaveBeenCalled();
  });
});

describe('lifecycle', () => {
  it('closes the repository when the app closes', async () => {
    const close = vi.fn();
    const repository: TodoRepository = { list: () => [], ping: () => {}, close };
    const instance = buildApp({ repository });
    await instance.ready();
    expect(close).not.toHaveBeenCalled();
    await instance.close();
    expect(close).toHaveBeenCalledTimes(1);
  });
});
