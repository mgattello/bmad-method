import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TodoInput } from './TodoInput.js';

function submitForm() {
  const form = screen.getByRole('textbox', { name: 'New todo' }).closest('form');
  if (!form) throw new Error('form not rendered');
  return fireEvent.submit(form);
}

describe('TodoInput', () => {
  it('prevents the default submit and passes the typed value to onSubmit', () => {
    const onSubmit = vi.fn();
    render(<TodoInput onSubmit={onSubmit} />);

    fireEvent.change(screen.getByRole('textbox', { name: 'New todo' }), { target: { value: 'x' } });

    expect(submitForm()).toBe(false);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith('x');
  });

  it('still prevents the default submit without onSubmit', () => {
    render(<TodoInput />);

    expect(submitForm()).toBe(false);
    expect(screen.getByRole('button', { name: 'Add' })).toBeDefined();
  });
});
