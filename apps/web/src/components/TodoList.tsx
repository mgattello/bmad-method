import type { Todo } from '@todo/contract';
import { TodoItem } from './TodoItem.js';
import styles from './TodoList.module.css';

type Props = {
  todos: Todo[];
};

// Received order is the API's guarantee; never sort here.
export function TodoList({ todos }: Props) {
  return (
    <ul className={styles.list} aria-label="Todos">
      {todos.map((todo) => (
        <TodoItem key={todo.id} todo={todo} />
      ))}
    </ul>
  );
}
