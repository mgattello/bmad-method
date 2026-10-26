import { useId, useState, type FormEvent } from 'react';
import styles from './TodoInput.module.css';

type Props = {
  onSubmit?: (description: string) => void;
};

// Shell only: the handler is wired in Story 2.2.
export function TodoInput({ onSubmit }: Props) {
  const inputId = useId();
  const [value, setValue] = useState('');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit?.(value);
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <label className={styles.label} htmlFor={inputId}>
        New todo
      </label>
      <div className={styles.row}>
        <input
          id={inputId}
          className={styles.input}
          type="text"
          autoComplete="off"
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
        <button className={styles.button} type="submit">
          Add
        </button>
      </div>
    </form>
  );
}
