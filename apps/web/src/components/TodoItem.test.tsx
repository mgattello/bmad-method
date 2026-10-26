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
});
