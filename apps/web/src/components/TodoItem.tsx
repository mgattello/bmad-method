import type { Todo } from '@todo/contract';
import { useId } from 'react';
import styles from './TodoItem.module.css';

type Props = {
  todo: Todo;
  pending?: boolean;
  onToggle?: (todo: Todo) => void;
  onDelete?: (todo: Todo) => void;
};

// Description is rendered as text content only; toggle and delete are wired.
export function TodoItem({ todo, pending, onToggle, onDelete }: Props) {
  const checkboxId = useId();
  const className = todo.completed ? `${styles.item} ${styles.completed}` : styles.item;

  return (
    <li className={className}>
      <input
        id={checkboxId}
        className={styles.checkbox}
        type="checkbox"
        checked={todo.completed}
        disabled={pending}
        onChange={() => onToggle?.(todo)}
      />
      <label className={styles.description} htmlFor={checkboxId}>
        {todo.description}
      </label>
      <button
        type="button"
        className={styles.delete}
        aria-label={`Delete ${todo.description}`}
        disabled={pending}
        onClick={() => onDelete?.(todo)}
      >
        Delete
      </button>
    </li>
  );
}
