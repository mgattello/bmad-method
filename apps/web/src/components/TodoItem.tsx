import type { Todo } from '@todo/contract';
import { useEffect, useId, useRef } from 'react';
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
  const checkboxRef = useRef<HTMLInputElement>(null);
  const deleteRef = useRef<HTMLButtonElement>(null);
  // A disabled control drops focus, so remember which one the user used and refocus it after the write.
  const lastUsed = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!pending && lastUsed.current) {
      // Skipped when the control is gone (a deleted item unmounts).
      lastUsed.current.focus();
      lastUsed.current = null;
    }
  }, [pending]);

  const className = todo.completed ? `${styles.item} ${styles.completed}` : styles.item;

  return (
    <li className={className}>
      <input
        id={checkboxId}
        className={styles.checkbox}
        type="checkbox"
        ref={checkboxRef}
        checked={todo.completed}
        disabled={pending}
        onChange={() => {
          lastUsed.current = checkboxRef.current;
          onToggle?.(todo);
        }}
      />
      <label className={styles.description} htmlFor={checkboxId}>
        {todo.description}
      </label>
      <button
        type="button"
        className={styles.delete}
        aria-label={`Delete ${todo.description}`}
        disabled={pending}
        ref={deleteRef}
        onClick={() => {
          lastUsed.current = deleteRef.current;
          onDelete?.(todo);
        }}
      >
        Delete
      </button>
    </li>
  );
}
