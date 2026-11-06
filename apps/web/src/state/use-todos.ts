import { DESCRIPTION_MAX, ErrorCode, type Todo } from '@todo/contract';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createTodo, listTodos, updateTodo } from '../api/todos-client.js';

export type TodosState =
  { status: 'loading' } | { status: 'ready'; todos: Todo[] } | { status: 'error'; code: ErrorCode };

// Keyed by action so copy can name what failed; the union grows with delete.
export type WriteError = { action: 'create' | 'toggle'; code: ErrorCode };

export function useTodos(): {
  state: TodosState;
  load: () => Promise<void>;
  create: (raw: string) => Promise<boolean>;
  creating: boolean;
  toggle: (todo: Todo) => Promise<void>;
  pendingIds: ReadonlySet<string>;
  writeError: WriteError | null;
} {
  const [state, setState] = useState<TodosState>({ status: 'loading' });
  const [creating, setCreating] = useState(false);
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(new Set());
  const [writeError, setWriteError] = useState<WriteError | null>(null);
  // Sequence guard: only the latest request may apply its result.
  const seq = useRef(0);
  // Synchronous in-flight guard; `creating` state only drives the disabled control.
  const creatingRef = useRef(false);
  // Synchronous per-Todo guard: one in-flight write per id, extra toggles are ignored.
  const pendingRef = useRef(new Set<string>());

  const fetchInto = useCallback(async (id: number) => {
    const result = await listTodos();
    if (id !== seq.current) return;
    setState(
      result.ok ? { status: 'ready', todos: result.data } : { status: 'error', code: result.code },
    );
  }, []);

  const load = useCallback(async () => {
    setWriteError(null);
    setState({ status: 'loading' });
    await fetchInto(++seq.current);
  }, [fetchInto]);

  // Resolves true when the Todo was created; a second call while pending is ignored.
  const create = useCallback(async (raw: string) => {
    if (creatingRef.current) return false;
    setWriteError(null);
    const trimmed = raw.trim();
    if (trimmed.length === 0 || trimmed.length > DESCRIPTION_MAX) {
      setWriteError({ action: 'create', code: ErrorCode.VALIDATION_ERROR });
      return false;
    }
    creatingRef.current = true;
    setCreating(true);
    const result = await createTodo(trimmed);
    if (result.ok) {
      setState((s) => (s.status === 'ready' ? { ...s, todos: [result.data, ...s.todos] } : s));
    } else {
      setWriteError({ action: 'create', code: result.code });
    }
    creatingRef.current = false;
    setCreating(false);
    return result.ok;
  }, []);

  const toggle = useCallback(async (todo: Todo) => {
    if (pendingRef.current.has(todo.id)) return;
    setWriteError(null);
    pendingRef.current.add(todo.id);
    setPendingIds(new Set(pendingRef.current));
    const result = await updateTodo(todo.id, { completed: !todo.completed });
    if (result.ok) {
      setState((s) =>
        s.status === 'ready'
          ? { ...s, todos: s.todos.map((t) => (t.id === result.data.id ? result.data : t)) }
          : s,
      );
    } else {
      if (result.code === ErrorCode.NOT_FOUND) {
        setState((s) =>
          s.status === 'ready' ? { ...s, todos: s.todos.filter((t) => t.id !== todo.id) } : s,
        );
      }
      setWriteError({ action: 'toggle', code: result.code });
    }
    pendingRef.current.delete(todo.id);
    setPendingIds(new Set(pendingRef.current));
  }, []);

  // Initial state is already loading, so the mount load skips the synchronous setState.
  useEffect(() => {
    void fetchInto(++seq.current);
    // Invalidate any pending request on unmount (and on StrictMode's first pass).
    return () => {
      seq.current += 1;
    };
  }, [fetchInto]);

  return { state, load, create, creating, toggle, pendingIds, writeError };
}
