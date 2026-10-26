import type { Todo } from '@todo/contract';
import { useId } from 'react';
import styles from './TodoItem.module.css';

type Props = {
  todo: Todo;
  onToggle?: (todo: Todo) => void;
  onDelete?: (todo: Todo) => void;
};

// Description is rendered as text content only; toggle and delete are wired in Epic 2.
export function TodoItem({ todo, onToggle, onDelete }: Props) {
  const checkboxId = useId();
  const className = todo.completed ? `${styles.item} ${styles.completed}` : styles.item;

  return (
    <li className={className}>
      <input
        id={checkboxId}
        className={styles.checkbox}
        type="checkbox"
        checked={todo.completed}
        onChange={() => onToggle?.(todo)}
      />
      <label className={styles.description} htmlFor={checkboxId}>
        {todo.description}
      </label>
      <button
        type="button"
        className={styles.delete}
        aria-label={`Delete ${todo.description}`}
        onClick={() => onDelete?.(todo)}
      >
        Delete
      </button>
    </li>
  );
}
