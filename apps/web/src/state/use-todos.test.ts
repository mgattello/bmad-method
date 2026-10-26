import type { Todo } from '@todo/contract';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listTodos, type ApiResult } from '../api/todos-client.js';
import { useTodos } from './use-todos.js';

vi.mock('../api/todos-client.js');

type Deferred = {
  promise: Promise<ApiResult<Todo[]>>;
  resolve: (value: ApiResult<Todo[]>) => void;
};

function deferred(): Deferred {
  let resolve: Deferred['resolve'] = () => {};
  const promise = new Promise<ApiResult<Todo[]>>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

const todoA: Todo = {
  id: 'a',
  description: 'first',
  completed: false,
  createdAt: '2026-10-26T10:00:00.000Z',
};
const todoB: Todo = {
  id: 'b',
  description: 'second',
  completed: true,
  createdAt: '2026-10-26T10:00:01.000Z',
};

describe('useTodos', () => {
  beforeEach(() => {
    vi.mocked(listTodos).mockReset();
  });

  it('starts loading and becomes ready with the received todos', async () => {
    vi.mocked(listTodos).mockResolvedValue({ ok: true, data: [todoB, todoA] });

    const { result } = renderHook(() => useTodos());

    expect(result.current.state).toEqual({ status: 'loading' });
    await waitFor(() =>
      expect(result.current.state).toEqual({ status: 'ready', todos: [todoB, todoA] }),
    );
    expect(listTodos).toHaveBeenCalledTimes(1);
  });

  it('becomes error with the client code when the load fails', async () => {
    vi.mocked(listTodos).mockResolvedValue({ ok: false, code: 'NOT_FOUND' });

    const { result } = renderHook(() => useTodos());

    await waitFor(() =>
      expect(result.current.state).toEqual({ status: 'error', code: 'NOT_FOUND' }),
    );
  });

  it('retry re-issues the load: loading again, then ready', async () => {
    const second = deferred();
    vi.mocked(listTodos)
      .mockResolvedValueOnce({ ok: false, code: 'INTERNAL_ERROR' })
      .mockReturnValueOnce(second.promise);

    const { result } = renderHook(() => useTodos());
    await waitFor(() => expect(result.current.state.status).toBe('error'));

    let retry: Promise<void> = Promise.resolve();
    act(() => {
      retry = result.current.load();
    });
    expect(result.current.state).toEqual({ status: 'loading' });

    await act(async () => {
      second.resolve({ ok: true, data: [todoA] });
      await retry;
    });
    expect(result.current.state).toEqual({ status: 'ready', todos: [todoA] });
    expect(listTodos).toHaveBeenCalledTimes(2);
  });

  it('ignores a stale response that resolves after a newer load started', async () => {
    const first = deferred();
    const second = deferred();
    vi.mocked(listTodos).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

    const { result } = renderHook(() => useTodos());
    let retry: Promise<void> = Promise.resolve();
    act(() => {
      retry = result.current.load();
    });

    await act(async () => {
      second.resolve({ ok: true, data: [todoA] });
      await retry;
    });
    expect(result.current.state).toEqual({ status: 'ready', todos: [todoA] });

    await act(async () => {
      first.resolve({ ok: false, code: 'INTERNAL_ERROR' });
      await first.promise;
    });
    expect(result.current.state).toEqual({ status: 'ready', todos: [todoA] });
  });

  it('does not update state or warn when unmounted mid-load', async () => {
    const pending = deferred();
    vi.mocked(listTodos).mockReturnValueOnce(pending.promise);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result, unmount } = renderHook(() => useTodos());
    unmount();
    await act(async () => {
      pending.resolve({ ok: true, data: [todoA] });
      await pending.promise;
    });

    expect(result.current.state).toEqual({ status: 'loading' });
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
