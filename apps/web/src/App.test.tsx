import type { Todo } from '@todo/contract';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listTodos, type ApiResult } from './api/todos-client.js';
import { App } from './App.js';
import itemStyles from './components/TodoItem.module.css';
import { emptyStateCopy, errorCopy, loadingCopy, retryLabel } from './copy.js';

vi.mock('./api/todos-client.js');

const serverMessage = 'db down';

const todoA: Todo = {
  id: 'a',
  description: 'first',
  completed: true,
  createdAt: '2026-10-26T10:00:00.000Z',
};
const todoB: Todo = {
  id: 'b',
  description: '<b>x</b>',
  completed: false,
  createdAt: '2026-10-26T10:00:01.000Z',
};

function deferred() {
  let resolve: (value: ApiResult<Todo[]>) => void = () => {};
  const promise = new Promise<ApiResult<Todo[]>>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe('App', () => {
  beforeEach(() => {
    vi.mocked(listTodos).mockReset();
  });

  it('shows the skeleton while the first load is pending', () => {
    vi.mocked(listTodos).mockReturnValue(new Promise(() => {}));

    render(<App />);

    const region = screen.getByRole('region', { name: 'Todo List' });
    expect(within(region).getByText(loadingCopy)).toBeDefined();
    expect(region.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.queryByText(emptyStateCopy)).toBeNull();
    expect(screen.getByRole('status').textContent).toBe('');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Todo');
    expect(screen.getByRole('textbox', { name: 'New todo' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Add' })).toBeDefined();
  });

  it('shows the Empty State when the list is empty', async () => {
    vi.mocked(listTodos).mockResolvedValue({ ok: true, data: [] });

    render(<App />);

    expect(await screen.findByText(emptyStateCopy)).toBeDefined();
    expect(screen.queryByText(loadingCopy)).toBeNull();
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.getByRole('status').textContent).toBe('');
  });

  it('renders todos in received order with checkboxes and literal descriptions', async () => {
    vi.mocked(listTodos).mockResolvedValue({ ok: true, data: [todoB, todoA] });

    render(<App />);

    const list = await screen.findByRole('list', { name: 'Todos' });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(within(items[0]!).getByRole('checkbox', { name: '<b>x</b>' })).toHaveProperty(
      'checked',
      false,
    );
    expect(within(items[1]!).getByRole('checkbox', { name: 'first' })).toHaveProperty(
      'checked',
      true,
    );
    expect(within(items[0]!).getByText('<b>x</b>')).toBeDefined();
    expect(list.querySelector('b')).toBeNull();
    expect(items[1]!.className).toContain(itemStyles.completed);
    expect(items[0]!.className).not.toContain(itemStyles.completed);
    expect(within(items[0]!).getByRole('button', { name: 'Delete <b>x</b>' })).toBeDefined();
    expect(screen.queryByText(emptyStateCopy)).toBeNull();
  });

  it('replaces the list with the Error State and a Retry button when the load fails', async () => {
    // Extra message field proves App renders only the copy for the code.
    vi.mocked(listTodos).mockResolvedValue({
      ok: false,
      code: 'INTERNAL_ERROR',
      message: serverMessage,
    } as unknown as ApiResult<Todo[]>);

    render(<App />);

    const retry = await screen.findByRole('button', { name: retryLabel });
    const status = screen.getByRole('status');
    expect(within(status).getByText(errorCopy.load.INTERNAL_ERROR)).toBeDefined();
    expect(status.contains(retry)).toBe(true);
    expect(document.body.textContent).not.toContain(serverMessage);
    const region = screen.getByRole('region', { name: 'Todo List' });
    expect(region.textContent).toBe('');
    expect(screen.queryByText(loadingCopy)).toBeNull();
    expect(screen.queryByText(emptyStateCopy)).toBeNull();
  });

  it('retry re-issues the load, shows the skeleton, then the Empty State', async () => {
    const second = deferred();
    vi.mocked(listTodos)
      .mockResolvedValueOnce({ ok: false, code: 'INTERNAL_ERROR' })
      .mockReturnValueOnce(second.promise);

    render(<App />);
    const retry = await screen.findByRole('button', { name: retryLabel });

    fireEvent.click(retry);

    expect(listTodos).toHaveBeenCalledTimes(2);
    expect(screen.getByText(loadingCopy)).toBeDefined();
    expect(screen.getByRole('status').textContent).toBe('');

    await act(async () => {
      second.resolve({ ok: true, data: [] });
      await second.promise;
    });
    expect(screen.getByText(emptyStateCopy)).toBeDefined();
    expect(screen.queryByRole('button', { name: retryLabel })).toBeNull();
  });

  it('has exactly one live region and no alert', async () => {
    vi.mocked(listTodos).mockResolvedValue({ ok: false, code: 'NOT_FOUND' });

    render(<App />);
    await screen.findByRole('button', { name: retryLabel });

    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('status').textContent).toContain(errorCopy.load.NOT_FOUND);
  });
});
