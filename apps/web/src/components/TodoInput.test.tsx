import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TodoInput } from './TodoInput.js';

function input() {
  return screen.getByRole('textbox', { name: 'New todo' });
}

function submitForm() {
  const form = input().closest('form');
  if (!form) throw new Error('form not rendered');
  return fireEvent.submit(form);
}

describe('TodoInput', () => {
  it('prevents the default submit and passes the raw value to onSubmit on Enter', async () => {
    const onSubmit = vi.fn(() => Promise.resolve(true));
    render(<TodoInput onSubmit={onSubmit} />);
    fireEvent.change(input(), { target: { value: '  x  ' } });

    let defaultAllowed = true;
    await act(async () => {
      defaultAllowed = submitForm();
    });

    expect(defaultAllowed).toBe(false);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith('  x  ');
  });

  it('submits the raw value when Add is clicked', async () => {
    const onSubmit = vi.fn(() => Promise.resolve(true));
    render(<TodoInput onSubmit={onSubmit} />);
    fireEvent.change(input(), { target: { value: 'x' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    });

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith('x');
  });

  it('clears the value and keeps focus in the input when onSubmit resolves true', async () => {
    render(<TodoInput onSubmit={() => Promise.resolve(true)} />);
    fireEvent.change(input(), { target: { value: 'x' } });
    const add = screen.getByRole('button', { name: 'Add' });
    add.focus();
    expect(document.activeElement).toBe(add);

    await act(async () => {
      fireEvent.click(add);
    });

    expect(input()).toHaveProperty('value', '');
    expect(document.activeElement).toBe(input());
  });

  it('moves focus to the input before onSubmit settles', async () => {
    let resolve: (value: boolean) => void = () => {};
    const pending = new Promise<boolean>((res) => {
      resolve = res;
    });
    render(<TodoInput onSubmit={() => pending} />);
    fireEvent.change(input(), { target: { value: 'x' } });
    const add = screen.getByRole('button', { name: 'Add' });
    add.focus();

    await act(async () => {
      fireEvent.click(add);
    });
    expect(document.activeElement).toBe(input());

    await act(async () => {
      resolve(true);
      await pending;
    });
    expect(input()).toHaveProperty('value', '');
    expect(document.activeElement).toBe(input());
  });

  it('keeps the value and focus when onSubmit resolves false', async () => {
    render(<TodoInput onSubmit={() => Promise.resolve(false)} />);
    fireEvent.change(input(), { target: { value: 'x' } });

    await act(async () => {
      submitForm();
    });

    expect(input()).toHaveProperty('value', 'x');
    expect(document.activeElement).toBe(input());
  });

  it('disables Add but never the input', () => {
    render(<TodoInput onSubmit={() => Promise.resolve(true)} disabled />);

    expect(screen.getByRole('button', { name: 'Add' })).toHaveProperty('disabled', true);
    expect(input()).toHaveProperty('disabled', false);
  });

  it('marks the input invalid and described by the message when invalid', () => {
    render(<TodoInput onSubmit={() => Promise.resolve(false)} invalid errorId="msg" />);

    expect(input().getAttribute('aria-invalid')).toBe('true');
    expect(input().getAttribute('aria-describedby')).toBe('msg');
  });

  it('sets neither attribute when valid', () => {
    render(<TodoInput onSubmit={() => Promise.resolve(true)} errorId="msg" />);

    expect(input().hasAttribute('aria-invalid')).toBe(false);
    expect(input().hasAttribute('aria-describedby')).toBe(false);
  });
});
