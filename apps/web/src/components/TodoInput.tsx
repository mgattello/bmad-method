import { useId, useRef, useState, type FormEvent } from 'react';
import { addLabel } from '../copy.js';
import styles from './TodoInput.module.css';

type Props = {
  onSubmit: (value: string) => Promise<boolean>;
  disabled?: boolean;
  invalid?: boolean;
  errorId?: string;
};

// Dumb form: validation and copy live in the hook; `true` from onSubmit means the field may clear.
export function TodoInput({ onSubmit, disabled, invalid, errorId }: Props) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    inputRef.current?.focus();
    const cleared = await onSubmit(value);
    if (cleared) setValue('');
    // A click on Add moves focus to the button; disabling it would drop focus to body.
    inputRef.current?.focus();
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <label className={styles.label} htmlFor={inputId}>
        New todo
      </label>
      <div className={styles.row}>
        <input
          ref={inputRef}
          id={inputId}
          className={styles.input}
          type="text"
          autoComplete="off"
          value={value}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? errorId : undefined}
          onChange={(event) => setValue(event.target.value)}
        />
        <button className={styles.button} type="submit" disabled={disabled}>
          {addLabel}
        </button>
      </div>
    </form>
  );
}
