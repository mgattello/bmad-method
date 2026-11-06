import type { Todo } from '@todo/contract';
import { TodoItem } from './TodoItem.js';
import styles from './TodoList.module.css';

type Props = {
  todos: Todo[];
  pendingIds?: ReadonlySet<string>;
  onToggle?: (todo: Todo) => void;
  onDelete?: (todo: Todo) => void;
};

// Received order is the API's guarantee; never sort here.
export function TodoList({ todos, pendingIds, onToggle, onDelete }: Props) {
  return (
    <ul className={styles.list} aria-label="Todos">
      {todos.map((todo) => (
        <TodoItem
          key={todo.id}
          todo={todo}
          pending={pendingIds?.has(todo.id)}
          onToggle={onToggle}
          onDelete={onDelete}
        />
      ))}
    </ul>
  );
}
