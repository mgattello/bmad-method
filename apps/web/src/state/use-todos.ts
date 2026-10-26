import type { ErrorCode, Todo } from '@todo/contract';
import { useCallback, useEffect, useRef, useState } from 'react';
import { listTodos } from '../api/todos-client.js';

export type TodosState =
  { status: 'loading' } | { status: 'ready'; todos: Todo[] } | { status: 'error'; code: ErrorCode };

export function useTodos(): { state: TodosState; load: () => Promise<void> } {
  const [state, setState] = useState<TodosState>({ status: 'loading' });
  // Sequence guard: only the latest request may apply its result.
  const seq = useRef(0);

  const fetchInto = useCallback(async (id: number) => {
    const result = await listTodos();
    if (id !== seq.current) return;
    setState(
      result.ok ? { status: 'ready', todos: result.data } : { status: 'error', code: result.code },
    );
  }, []);

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    await fetchInto(++seq.current);
  }, [fetchInto]);

  // Initial state is already loading, so the mount load skips the synchronous setState.
  useEffect(() => {
    void fetchInto(++seq.current);
    // Invalidate any pending request on unmount (and on StrictMode's first pass).
    return () => {
      seq.current += 1;
    };
  }, [fetchInto]);

  return { state, load };
}
