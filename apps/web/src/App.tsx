import { useId } from 'react';
import styles from './App.module.css';
import { EmptyState } from './components/EmptyState.js';
import { ErrorBanner } from './components/ErrorBanner.js';
import { LoadingState } from './components/LoadingState.js';
import { TodoInput } from './components/TodoInput.js';
import { TodoList } from './components/TodoList.js';
import { errorCopy, retryLabel } from './copy.js';
import { useTodos } from './state/use-todos.js';

export function App() {
  const { state, load, create, creating, toggle, remove, pendingIds, writeError } = useTodos();
  const messageId = useId();
  const failed = state.status === 'error';
  // One live region: the load error wins, then the pending write error.
  const message =
    state.status === 'error'
      ? errorCopy.load[state.code]
      : writeError
        ? errorCopy[writeError.action][writeError.code]
        : null;

  return (
    <main className={styles.main}>
      <h1 className={styles.title}>Todo</h1>
      <TodoInput
        onSubmit={create}
        disabled={creating || state.status !== 'ready'}
        invalid={writeError?.action === 'create' && writeError.code === 'VALIDATION_ERROR'}
        errorId={messageId}
      />
      <ErrorBanner
        messageId={messageId}
        message={message}
        action={failed ? { label: retryLabel, onClick: load } : undefined}
      />
      <section className={styles.list} aria-label="Todo List">
        {state.status === 'loading' ? <LoadingState /> : null}
        {state.status === 'ready' ? (
          state.todos.length === 0 ? (
            <EmptyState />
          ) : (
            <TodoList
              todos={state.todos}
              pendingIds={pendingIds}
              onToggle={toggle}
              onDelete={remove}
            />
          )
        ) : null}
      </section>
    </main>
  );
}
