import styles from './App.module.css';
import { EmptyState } from './components/EmptyState.js';
import { ErrorBanner } from './components/ErrorBanner.js';
import { LoadingState } from './components/LoadingState.js';
import { TodoInput } from './components/TodoInput.js';
import { TodoList } from './components/TodoList.js';
import { errorCopy, retryLabel } from './copy.js';
import { useTodos } from './state/use-todos.js';

export function App() {
  const { state, load } = useTodos();
  const failed = state.status === 'error';

  return (
    <main className={styles.main}>
      <h1 className={styles.title}>Todo</h1>
      <TodoInput />
      <ErrorBanner
        message={state.status === 'error' ? errorCopy.load[state.code] : null}
        action={failed ? { label: retryLabel, onClick: load } : undefined}
      />
      <section className={styles.list} aria-label="Todo List">
        {state.status === 'loading' ? <LoadingState /> : null}
        {state.status === 'ready' ? (
          state.todos.length === 0 ? (
            <EmptyState />
          ) : (
            <TodoList todos={state.todos} />
          )
        ) : null}
      </section>
    </main>
  );
}
