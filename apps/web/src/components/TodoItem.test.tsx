import type { Todo } from '@todo/contract';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TodoItem } from './TodoItem.js';

const todo: Todo = {
  id: 'a',
  description: 'first',
  completed: false,
  createdAt: '2026-10-26T10:00:00.000Z',
};

describe('TodoItem', () => {
  it('passes the whole todo to onToggle and onDelete', () => {
    const onToggle = vi.fn();
    const onDelete = vi.fn();
    render(
      <ul>
        <TodoItem todo={todo} onToggle={onToggle} onDelete={onDelete} />
      </ul>,
    );

    fireEvent.click(screen.getByRole('checkbox', { name: 'first' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete first' }));

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith(todo);
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledWith(todo);
  });

  it('does not throw when clicked without handlers', () => {
    render(
      <ul>
        <TodoItem todo={todo} />
      </ul>,
    );

    expect(() => {
      fireEvent.click(screen.getByRole('checkbox', { name: 'first' }));
      fireEvent.click(screen.getByRole('button', { name: 'Delete first' }));
    }).not.toThrow();
  });

  it('disables the checkbox and delete while pending and delete fires nothing', () => {
    const onDelete = vi.fn();
    render(
      <ul>
        <TodoItem todo={todo} pending onDelete={onDelete} />
      </ul>,
    );

    const checkbox = screen.getByRole('checkbox', { name: 'first' });
    const remove = screen.getByRole('button', { name: 'Delete first' });
    expect((checkbox as HTMLInputElement).disabled).toBe(true);
    expect((remove as HTMLButtonElement).disabled).toBe(true);
    // jsdom still dispatches a click on a disabled checkbox; browsers do not, so only the button is clicked.
    fireEvent.click(remove);
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('enables both controls when not pending', () => {
    render(
      <ul>
        <TodoItem todo={todo} />
      </ul>,
    );

    expect((screen.getByRole('checkbox') as HTMLInputElement).disabled).toBe(false);
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(false);
  });

  it('checks the box and applies the completed class only when completed', () => {
    const { rerender } = render(
      <ul>
        <TodoItem todo={todo} />
      </ul>,
    );
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(false);
    expect(screen.getByRole('listitem').className).not.toContain('completed');

    rerender(
      <ul>
        <TodoItem todo={{ ...todo, completed: true }} />
      </ul>,
    );
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(true);
    expect(screen.getByRole('listitem').className).toContain('completed');
  });
});
