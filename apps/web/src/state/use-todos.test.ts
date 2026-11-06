import { DESCRIPTION_MAX, type Todo } from '@todo/contract';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createTodo,
  deleteTodo,
  listTodos,
  updateTodo,
  type ApiResult,
} from '../api/todos-client.js';
import { useTodos } from './use-todos.js';

vi.mock('../api/todos-client.js');

type Deferred<T> = {
  promise: Promise<ApiResult<T>>;
  resolve: (value: ApiResult<T>) => void;
};

function deferred<T = Todo[]>(): Deferred<T> {
  let resolve: Deferred<T>['resolve'] = () => {};
  const promise = new Promise<ApiResult<T>>((res) => {
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
const todoC: Todo = {
  id: 'c',
  description: 'Buy milk',
  completed: false,
  createdAt: '2026-10-26T10:00:02.000Z',
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

describe('useTodos create', () => {
  beforeEach(() => {
    vi.mocked(listTodos).mockReset();
    vi.mocked(createTodo).mockReset();
  });

  async function renderReady(todos: Todo[] = [todoA]) {
    vi.mocked(listTodos).mockResolvedValue({ ok: true, data: todos });
    const rendered = renderHook(() => useTodos());
    await waitFor(() => expect(rendered.result.current.state.status).toBe('ready'));
    return rendered;
  }

  it('sends the trimmed value, inserts the returned Todo first and resolves true', async () => {
    const pending = deferred<Todo>();
    vi.mocked(createTodo).mockReturnValueOnce(pending.promise);
    const { result } = await renderReady([todoA]);

    let outcome: Promise<boolean> = Promise.resolve(false);
    act(() => {
      outcome = result.current.create('  Buy milk  ');
    });
    expect(result.current.creating).toBe(true);
    expect(createTodo).toHaveBeenCalledWith('Buy milk');

    await act(async () => {
      pending.resolve({ ok: true, data: todoC });
      await expect(outcome).resolves.toBe(true);
    });
    expect(result.current.creating).toBe(false);
    expect(result.current.writeError).toBeNull();
    expect(result.current.state).toEqual({ status: 'ready', todos: [todoC, todoA] });
  });

  it('ignores a second create while one is pending', async () => {
    const pending = deferred<Todo>();
    vi.mocked(createTodo).mockReturnValueOnce(pending.promise);
    const { result } = await renderReady();

    let first: Promise<boolean> = Promise.resolve(false);
    let second: Promise<boolean> = Promise.resolve(true);
    act(() => {
      first = result.current.create('one');
      second = result.current.create('two');
    });
    await expect(second).resolves.toBe(false);
    expect(createTodo).toHaveBeenCalledTimes(1);

    await act(async () => {
      pending.resolve({ ok: true, data: todoC });
      await first;
    });
    expect(result.current.state).toEqual({ status: 'ready', todos: [todoC, todoA] });
  });

  it.each(['', '   ', 'x'.repeat(DESCRIPTION_MAX + 1)])(
    'rejects %j locally with VALIDATION_ERROR and no client call',
    async (raw) => {
      const { result } = await renderReady();

      let outcome: Promise<boolean> = Promise.resolve(true);
      await act(async () => {
        outcome = result.current.create(raw);
        await outcome;
      });

      await expect(outcome).resolves.toBe(false);
      expect(createTodo).not.toHaveBeenCalled();
      expect(result.current.writeError).toEqual({ action: 'create', code: 'VALIDATION_ERROR' });
      expect(result.current.creating).toBe(false);
      expect(result.current.state).toEqual({ status: 'ready', todos: [todoA] });
    },
  );

  it.each([1, DESCRIPTION_MAX])('sends a trimmed value of %i characters', async (length) => {
    vi.mocked(createTodo).mockResolvedValue({ ok: true, data: todoC });
    const { result } = await renderReady();
    const raw = ` ${'y'.repeat(length)} `;

    await act(async () => {
      await result.current.create(raw);
    });

    expect(createTodo).toHaveBeenCalledWith('y'.repeat(length));
  });

  it.each(['VALIDATION_ERROR', 'INTERNAL_ERROR'] as const)(
    'sets writeError %s on a failed create and leaves the list unchanged',
    async (code) => {
      vi.mocked(createTodo).mockResolvedValue({ ok: false, code });
      const { result } = await renderReady([todoA]);

      let outcome: Promise<boolean> = Promise.resolve(true);
      await act(async () => {
        outcome = result.current.create('Buy milk');
        await outcome;
      });

      await expect(outcome).resolves.toBe(false);
      expect(result.current.writeError).toEqual({ action: 'create', code });
      expect(result.current.creating).toBe(false);
      expect(result.current.state).toEqual({ status: 'ready', todos: [todoA] });
    },
  );

  it('clears writeError when the next create starts', async () => {
    const pending = deferred<Todo>();
    vi.mocked(createTodo).mockReturnValueOnce(pending.promise);
    const { result } = await renderReady();

    await act(async () => {
      await result.current.create('');
    });
    expect(result.current.writeError).not.toBeNull();

    act(() => {
      void result.current.create('Buy milk');
    });
    expect(result.current.writeError).toBeNull();

    await act(async () => {
      pending.resolve({ ok: true, data: todoC });
      await pending.promise;
    });
    expect(result.current.writeError).toBeNull();
  });

  it('clears writeError when load starts', async () => {
    const { result } = await renderReady();
    await act(async () => {
      await result.current.create('   ');
    });
    expect(result.current.writeError).not.toBeNull();

    await act(async () => {
      await result.current.load();
    });

    expect(result.current.writeError).toBeNull();
    expect(result.current.state).toEqual({ status: 'ready', todos: [todoA] });
  });

  it('calls the client but inserts nothing while the list is in the error state', async () => {
    vi.mocked(listTodos).mockResolvedValue({ ok: false, code: 'INTERNAL_ERROR' });
    vi.mocked(createTodo).mockResolvedValue({ ok: true, data: todoC });
    const { result } = renderHook(() => useTodos());
    await waitFor(() => expect(result.current.state.status).toBe('error'));

    let outcome: Promise<boolean> = Promise.resolve(false);
    await act(async () => {
      outcome = result.current.create('Buy milk');
      await outcome;
    });

    await expect(outcome).resolves.toBe(true);
    expect(createTodo).toHaveBeenCalledTimes(1);
    expect(result.current.state).toEqual({ status: 'error', code: 'INTERNAL_ERROR' });
  });
});

describe('useTodos toggle', () => {
  beforeEach(() => {
    vi.mocked(listTodos).mockReset();
    vi.mocked(createTodo).mockReset();
    vi.mocked(updateTodo).mockReset();
  });

  async function renderReady(todos: Todo[] = [todoA, todoB]) {
    vi.mocked(listTodos).mockResolvedValue({ ok: true, data: todos });
    const rendered = renderHook(() => useTodos());
    await waitFor(() => expect(rendered.result.current.state.status).toBe('ready'));
    return rendered;
  }

  it('sends the flipped status and replaces the item in place from the response', async () => {
    const pending = deferred<Todo>();
    vi.mocked(updateTodo).mockReturnValueOnce(pending.promise);
    const { result } = await renderReady([todoA, todoB, todoC]);

    let outcome: Promise<void> = Promise.resolve();
    act(() => {
      outcome = result.current.toggle(todoA);
    });
    expect(updateTodo).toHaveBeenCalledWith('a', { completed: true });
    expect(result.current.pendingIds.has('a')).toBe(true);
    expect(result.current.state).toEqual({ status: 'ready', todos: [todoA, todoB, todoC] });

    await act(async () => {
      pending.resolve({ ok: true, data: { ...todoA, completed: true } });
      await outcome;
    });
    expect(result.current.state).toEqual({
      status: 'ready',
      todos: [{ ...todoA, completed: true }, todoB, todoC],
    });
    expect(result.current.pendingIds.size).toBe(0);
    expect(result.current.writeError).toBeNull();
  });

  it('sends completed false for a Completed Todo', async () => {
    vi.mocked(updateTodo).mockResolvedValueOnce({ ok: true, data: { ...todoB, completed: false } });
    const { result } = await renderReady();

    await act(async () => {
      await result.current.toggle(todoB);
    });

    expect(updateTodo).toHaveBeenCalledWith('b', { completed: false });
  });

  it('ignores a second toggle on the same id while pending', async () => {
    const pending = deferred<Todo>();
    vi.mocked(updateTodo).mockReturnValueOnce(pending.promise);
    const { result } = await renderReady();

    let first: Promise<void> = Promise.resolve();
    act(() => {
      first = result.current.toggle(todoA);
      void result.current.toggle(todoA);
    });
    await act(async () => {
      pending.resolve({ ok: true, data: { ...todoA, completed: true } });
      await first;
    });

    expect(updateTodo).toHaveBeenCalledTimes(1);
  });

  it('runs toggles on two ids independently', async () => {
    const one = deferred<Todo>();
    const two = deferred<Todo>();
    vi.mocked(updateTodo).mockReturnValueOnce(one.promise).mockReturnValueOnce(two.promise);
    const { result } = await renderReady();

    let p1: Promise<void> = Promise.resolve();
    let p2: Promise<void> = Promise.resolve();
    act(() => {
      p1 = result.current.toggle(todoA);
      p2 = result.current.toggle(todoB);
    });
    expect(updateTodo).toHaveBeenCalledTimes(2);
    expect([...result.current.pendingIds].sort()).toEqual(['a', 'b']);

    await act(async () => {
      one.resolve({ ok: true, data: { ...todoA, completed: true } });
      two.resolve({ ok: true, data: { ...todoB, completed: false } });
      await Promise.all([p1, p2]);
    });
    expect(result.current.pendingIds.size).toBe(0);
  });

  it('keeps the list and sets a toggle error on a failure', async () => {
    vi.mocked(updateTodo).mockResolvedValueOnce({ ok: false, code: 'INTERNAL_ERROR' });
    const { result } = await renderReady();

    await act(async () => {
      await result.current.toggle(todoA);
    });

    expect(result.current.state).toEqual({ status: 'ready', todos: [todoA, todoB] });
    expect(result.current.writeError).toEqual({ action: 'toggle', code: 'INTERNAL_ERROR' });
    expect(result.current.pendingIds.size).toBe(0);
  });

  it('removes the item and sets the error on NOT_FOUND', async () => {
    vi.mocked(updateTodo).mockResolvedValueOnce({ ok: false, code: 'NOT_FOUND' });
    const { result } = await renderReady();

    await act(async () => {
      await result.current.toggle(todoA);
    });

    expect(result.current.state).toEqual({ status: 'ready', todos: [todoB] });
    expect(result.current.writeError).toEqual({ action: 'toggle', code: 'NOT_FOUND' });
  });

  it('clears a previous write error when the next write starts, in both directions', async () => {
    vi.mocked(updateTodo)
      .mockResolvedValueOnce({ ok: false, code: 'INTERNAL_ERROR' })
      .mockResolvedValueOnce({ ok: true, data: { ...todoA, completed: true } });
    vi.mocked(createTodo).mockResolvedValueOnce({ ok: true, data: todoC });
    const { result } = await renderReady();

    await act(async () => {
      await result.current.toggle(todoA);
    });
    expect(result.current.writeError?.action).toBe('toggle');
    await act(async () => {
      await result.current.create('Buy milk');
    });
    expect(result.current.writeError).toBeNull();

    vi.mocked(createTodo).mockResolvedValueOnce({ ok: false, code: 'INTERNAL_ERROR' });
    await act(async () => {
      await result.current.create('Buy milk');
    });
    expect(result.current.writeError?.action).toBe('create');
    await act(async () => {
      await result.current.toggle(todoA);
    });
    expect(result.current.writeError).toBeNull();
  });

  it('ignores a toggle result when the list is no longer ready', async () => {
    const pending = deferred<Todo>();
    vi.mocked(updateTodo).mockReturnValueOnce(pending.promise);
    const { result } = await renderReady();

    let outcome: Promise<void> = Promise.resolve();
    act(() => {
      outcome = result.current.toggle(todoA);
    });
    vi.mocked(listTodos).mockReturnValueOnce(new Promise(() => {}));
    act(() => {
      void result.current.load();
    });
    await act(async () => {
      pending.resolve({ ok: true, data: { ...todoA, completed: true } });
      await outcome;
    });

    expect(result.current.state).toEqual({ status: 'loading' });
  });
});

describe('useTodos remove', () => {
  beforeEach(() => {
    vi.mocked(listTodos).mockReset();
    vi.mocked(updateTodo).mockReset();
    vi.mocked(deleteTodo).mockReset();
  });

  async function renderReady(todos: Todo[] = [todoA, todoB]) {
    vi.mocked(listTodos).mockResolvedValue({ ok: true, data: todos });
    const rendered = renderHook(() => useTodos());
    await waitFor(() => expect(rendered.result.current.state.status).toBe('ready'));
    return rendered;
  }

  it('removes the item only after the response and leaves the others in order', async () => {
    const pending = deferred<null>();
    vi.mocked(deleteTodo).mockReturnValueOnce(pending.promise);
    const { result } = await renderReady([todoA, todoB, todoC]);

    let outcome: Promise<void> = Promise.resolve();
    act(() => {
      outcome = result.current.remove(todoB);
    });
    expect(deleteTodo).toHaveBeenCalledWith('b');
    expect(result.current.pendingIds.has('b')).toBe(true);
    expect(result.current.state).toEqual({ status: 'ready', todos: [todoA, todoB, todoC] });

    await act(async () => {
      pending.resolve({ ok: true, data: null });
      await outcome;
    });
    expect(result.current.state).toEqual({ status: 'ready', todos: [todoA, todoC] });
    expect(result.current.pendingIds.size).toBe(0);
    expect(result.current.writeError).toBeNull();
  });

  it('ignores a second delete and a toggle on the same id while pending', async () => {
    const pending = deferred<null>();
    vi.mocked(deleteTodo).mockReturnValueOnce(pending.promise);
    const { result } = await renderReady();

    let first: Promise<void> = Promise.resolve();
    act(() => {
      first = result.current.remove(todoA);
      void result.current.remove(todoA);
      void result.current.toggle(todoA);
    });
    await act(async () => {
      pending.resolve({ ok: true, data: null });
      await first;
    });

    expect(deleteTodo).toHaveBeenCalledTimes(1);
    expect(updateTodo).not.toHaveBeenCalled();
  });

  it('keeps the item in place and sets a delete error on a failure', async () => {
    vi.mocked(deleteTodo).mockResolvedValueOnce({ ok: false, code: 'INTERNAL_ERROR' });
    const { result } = await renderReady();

    await act(async () => {
      await result.current.remove(todoA);
    });

    expect(result.current.state).toEqual({ status: 'ready', todos: [todoA, todoB] });
    expect(result.current.writeError).toEqual({ action: 'delete', code: 'INTERNAL_ERROR' });
    expect(result.current.pendingIds.size).toBe(0);
  });

  it('removes the item locally and sets the error on NOT_FOUND', async () => {
    vi.mocked(deleteTodo).mockResolvedValueOnce({ ok: false, code: 'NOT_FOUND' });
    const { result } = await renderReady();

    await act(async () => {
      await result.current.remove(todoA);
    });

    expect(result.current.state).toEqual({ status: 'ready', todos: [todoB] });
    expect(result.current.writeError).toEqual({ action: 'delete', code: 'NOT_FOUND' });
  });

  it('ignores the result when the list is no longer ready', async () => {
    const pending = deferred<null>();
    vi.mocked(deleteTodo).mockReturnValueOnce(pending.promise);
    const { result } = await renderReady();

    let outcome: Promise<void> = Promise.resolve();
    act(() => {
      outcome = result.current.remove(todoA);
    });
    vi.mocked(listTodos).mockReturnValueOnce(new Promise(() => {}));
    act(() => {
      void result.current.load();
    });
    await act(async () => {
      pending.resolve({ ok: true, data: null });
      await outcome;
    });

    expect(result.current.state).toEqual({ status: 'loading' });
  });
});
