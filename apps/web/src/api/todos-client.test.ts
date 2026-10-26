import { ErrorCode, TODOS_PATH } from '@todo/contract';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { listTodos } from './todos-client.js';

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
