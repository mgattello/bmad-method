import { ErrorCode, TODOS_PATH } from '@todo/contract';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTodo, listTodos, updateTodo } from './todos-client.js';

function jsonResponse(status: number, body: string) {
  return new Response(body, { status, headers: { 'content-type': 'application/json' } });
}

function stubFetch(response: Response | Error) {
  const fetchMock = vi.fn(() =>
    response instanceof Error ? Promise.reject(response) : Promise.resolve(response),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const todos = [
  { id: 'b', description: 'second', completed: false, createdAt: '2026-10-26T10:00:01.000Z' },
  { id: 'a', description: 'first', completed: true, createdAt: '2026-10-26T10:00:00.000Z' },
];

describe('listTodos', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('requests TODOS_PATH with a JSON accept header', async () => {
    const fetchMock = stubFetch(jsonResponse(200, '[]'));

    await listTodos();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]).toEqual([
      TODOS_PATH,
      { headers: { accept: 'application/json' } },
    ]);
  });

  it('returns the todos in received order on 200', async () => {
    stubFetch(jsonResponse(200, JSON.stringify(todos)));

    await expect(listTodos()).resolves.toEqual({ ok: true, data: todos });
  });

  it('returns the envelope code and discards the message on 500', async () => {
    stubFetch(jsonResponse(500, JSON.stringify({ code: 'INTERNAL_ERROR', message: 'db down' })));

    const result = await listTodos();

    expect(result).toEqual({ ok: false, code: ErrorCode.INTERNAL_ERROR });
    expect(JSON.stringify(result)).not.toContain('db down');
  });

  it('returns another known envelope code on 404', async () => {
    stubFetch(jsonResponse(404, JSON.stringify({ code: 'NOT_FOUND', message: 'no' })));

    await expect(listTodos()).resolves.toEqual({ ok: false, code: ErrorCode.NOT_FOUND });
  });

  it('maps a non-JSON non-2xx body to INTERNAL_ERROR', async () => {
    stubFetch(new Response('<html>502 Bad Gateway</html>', { status: 502 }));

    await expect(listTodos()).resolves.toEqual({ ok: false, code: ErrorCode.INTERNAL_ERROR });
  });

  it.each([{ code: 'WEIRD' }, {}, 'text', null])(
    'maps a non-2xx body with an unknown code (%j) to INTERNAL_ERROR',
    async (body) => {
      stubFetch(jsonResponse(500, JSON.stringify(body)));

      await expect(listTodos()).resolves.toEqual({ ok: false, code: ErrorCode.INTERNAL_ERROR });
    },
  );

  it('maps a network failure to INTERNAL_ERROR without throwing', async () => {
    stubFetch(new TypeError('Failed to fetch'));

    await expect(listTodos()).resolves.toEqual({ ok: false, code: ErrorCode.INTERNAL_ERROR });
  });

  it.each(['{}', 'not json'])('maps a 2xx non-array body (%s) to INTERNAL_ERROR', async (body) => {
    stubFetch(jsonResponse(200, body));

    await expect(listTodos()).resolves.toEqual({ ok: false, code: ErrorCode.INTERNAL_ERROR });
  });
});

describe('createTodo', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const created = todos[0]!;

  it('POSTs TODOS_PATH with both JSON headers and the description body', async () => {
    const fetchMock = stubFetch(jsonResponse(201, JSON.stringify(created)));

    await createTodo('second');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]).toEqual([
      TODOS_PATH,
      {
        method: 'POST',
        headers: { accept: 'application/json', 'content-type': 'application/json' },
        body: JSON.stringify({ description: 'second' }),
      },
    ]);
  });

  it('returns the created Todo on 201', async () => {
    stubFetch(jsonResponse(201, JSON.stringify(created)));

    await expect(createTodo('second')).resolves.toEqual({ ok: true, data: created });
  });

  it('returns VALIDATION_ERROR and discards the message on 400', async () => {
    stubFetch(jsonResponse(400, JSON.stringify({ code: 'VALIDATION_ERROR', message: 'too long' })));

    const result = await createTodo('x');

    expect(result).toEqual({ ok: false, code: ErrorCode.VALIDATION_ERROR });
    expect(JSON.stringify(result)).not.toContain('too long');
  });

  it('returns NOT_FOUND on a 404 envelope', async () => {
    stubFetch(jsonResponse(404, JSON.stringify({ code: 'NOT_FOUND', message: 'no' })));

    await expect(createTodo('x')).resolves.toEqual({ ok: false, code: ErrorCode.NOT_FOUND });
  });

  it('returns INTERNAL_ERROR and discards the message on a 500 envelope', async () => {
    stubFetch(jsonResponse(500, JSON.stringify({ code: 'INTERNAL_ERROR', message: 'db down' })));

    const result = await createTodo('x');

    expect(result).toEqual({ ok: false, code: ErrorCode.INTERNAL_ERROR });
    expect(JSON.stringify(result)).not.toContain('db down');
  });

  it('maps a 2xx object whose id is not a string to INTERNAL_ERROR', async () => {
    stubFetch(jsonResponse(201, JSON.stringify({ id: 1 })));

    await expect(createTodo('x')).resolves.toEqual({ ok: false, code: ErrorCode.INTERNAL_ERROR });
  });

  it('maps a 502 HTML body to INTERNAL_ERROR', async () => {
    stubFetch(new Response('<html>502 Bad Gateway</html>', { status: 502 }));

    await expect(createTodo('x')).resolves.toEqual({ ok: false, code: ErrorCode.INTERNAL_ERROR });
  });

  it('maps a network failure to INTERNAL_ERROR without throwing', async () => {
    stubFetch(new TypeError('Failed to fetch'));

    await expect(createTodo('x')).resolves.toEqual({ ok: false, code: ErrorCode.INTERNAL_ERROR });
  });

  it.each(['[]', 'null', '"x"', '{}', 'not json'])(
    'maps a 2xx body that is not a Todo (%s) to INTERNAL_ERROR',
    async (body) => {
      stubFetch(jsonResponse(201, body));

      await expect(createTodo('x')).resolves.toEqual({
        ok: false,
        code: ErrorCode.INTERNAL_ERROR,
      });
    },
  );
});

describe('updateTodo', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const updated = { ...todos[0], completed: true };

  it('PATCHes the encoded todo path with both headers and the JSON body', async () => {
    const fetchMock = stubFetch(jsonResponse(200, JSON.stringify(updated)));

    await updateTodo('a/b', { completed: true });

    expect(fetchMock).toHaveBeenCalledWith(`${TODOS_PATH}/a%2Fb`, {
      method: 'PATCH',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify({ completed: true }),
    });
  });

  it('returns the Todo on 200', async () => {
    stubFetch(jsonResponse(200, JSON.stringify(updated)));

    await expect(updateTodo('b', { completed: true })).resolves.toEqual({
      ok: true,
      data: updated,
    });
  });

  it('maps a 404 envelope to NOT_FOUND and discards the message', async () => {
    stubFetch(jsonResponse(404, '{"code":"NOT_FOUND","message":"secret"}'));

    const result = await updateTodo('b', { completed: true });

    expect(result).toEqual({ ok: false, code: ErrorCode.NOT_FOUND });
    expect(JSON.stringify(result)).not.toContain('secret');
  });

  it('maps a 400 envelope to VALIDATION_ERROR', async () => {
    stubFetch(jsonResponse(400, '{"code":"VALIDATION_ERROR","message":"x"}'));

    await expect(updateTodo('b', { completed: true })).resolves.toEqual({
      ok: false,
      code: ErrorCode.VALIDATION_ERROR,
    });
  });

  it.each([
    ['a 500 envelope', () => jsonResponse(500, '{"code":"INTERNAL_ERROR","message":"x"}')],
    ['a 502 HTML body', () => new Response('<html></html>', { status: 502 })],
    ['a network error', () => new Error('offline')],
    ['a 2xx non-object', () => jsonResponse(200, '[]')],
    ['a 2xx with a non-string id', () => jsonResponse(200, '{"id":1}')],
  ])('maps %s to INTERNAL_ERROR', async (_name, make) => {
    stubFetch(make());

    await expect(updateTodo('b', { completed: true })).resolves.toEqual({
      ok: false,
      code: ErrorCode.INTERNAL_ERROR,
    });
  });
});
