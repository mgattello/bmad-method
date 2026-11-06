import { DESCRIPTION_MAX, type Todo } from '@todo/contract';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTodo, listTodos, updateTodo, type ApiResult } from './api/todos-client.js';
import { App } from './App.js';
import itemStyles from './components/TodoItem.module.css';
import { addLabel, emptyStateCopy, errorCopy, loadingCopy, retryLabel } from './copy.js';

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
const todoC: Todo = {
  id: 'c',
  description: 'Buy milk',
  completed: false,
  createdAt: '2026-10-26T10:00:02.000Z',
};

function deferred<T = Todo[]>() {
  let resolve: (value: ApiResult<T>) => void = () => {};
  const promise = new Promise<ApiResult<T>>((res) => {
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

describe('App create', () => {
  beforeEach(() => {
    vi.mocked(listTodos).mockReset();
    vi.mocked(createTodo).mockReset();
  });

  function input() {
    return screen.getByRole('textbox', { name: 'New todo' });
  }

  function addButton() {
    return screen.getByRole('button', { name: addLabel });
  }

  async function submit(value: string, via: 'enter' | 'add' = 'enter') {
    fireEvent.change(input(), { target: { value } });
    await act(async () => {
      if (via === 'add') fireEvent.click(addButton());
      else fireEvent.submit(input().closest('form')!);
    });
  }

  async function renderReady(todos: Todo[]) {
    vi.mocked(listTodos).mockResolvedValue({ ok: true, data: todos });
    render(<App />);
    if (todos.length === 0) await screen.findByText(emptyStateCopy);
    else await screen.findByRole('list', { name: 'Todos' });
  }

  it('adds the first todo from the Empty State, clears and refocuses the input', async () => {
    vi.mocked(createTodo).mockResolvedValue({ ok: true, data: todoC });
    await renderReady([]);

    await submit('  Buy milk  ', 'add');

    expect(createTodo).toHaveBeenCalledTimes(1);
    expect(createTodo).toHaveBeenCalledWith('Buy milk');
    const list = screen.getByRole('list', { name: 'Todos' });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(1);
    expect(within(items[0]!).getByText('Buy milk')).toBeDefined();
    expect(screen.queryByText(emptyStateCopy)).toBeNull();
    expect(input()).toHaveProperty('value', '');
    expect(document.activeElement).toBe(input());
    expect(screen.getByRole('status').textContent).toBe('');
    expect(addButton()).toHaveProperty('disabled', false);
  });

  it('puts a new todo first when the list already has items', async () => {
    vi.mocked(createTodo).mockResolvedValue({ ok: true, data: todoC });
    await renderReady([todoB, todoA]);

    await submit('Buy milk');

    const items = within(screen.getByRole('list', { name: 'Todos' })).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringContaining('Buy milk'),
      expect.stringContaining('<b>x</b>'),
      expect.stringContaining('first'),
    ]);
  });

  it('disables Add while a create is pending and ignores a second submit', async () => {
    const pending = deferred<Todo>();
    vi.mocked(createTodo).mockReturnValueOnce(pending.promise);
    await renderReady([]);

    await submit('Buy milk');
    expect(addButton()).toHaveProperty('disabled', true);

    await submit('Buy milk');
    expect(createTodo).toHaveBeenCalledTimes(1);

    await act(async () => {
      pending.resolve({ ok: true, data: todoC });
      await pending.promise;
    });
    expect(addButton()).toHaveProperty('disabled', false);
    expect(
      within(screen.getByRole('list', { name: 'Todos' })).getAllByRole('listitem'),
    ).toHaveLength(1);
  });

  it.each(['', '   ', 'x'.repeat(DESCRIPTION_MAX + 1)])(
    'rejects %j locally with the validation copy and no request',
    async (raw) => {
      await renderReady([]);

      await submit(raw);

      expect(createTodo).not.toHaveBeenCalled();
      const status = screen.getByRole('status');
      expect(status.textContent).toBe(errorCopy.create.VALIDATION_ERROR);
      expect(input().getAttribute('aria-invalid')).toBe('true');
      const describedBy = input().getAttribute('aria-describedby');
      expect(describedBy).not.toBeNull();
      expect(document.getElementById(describedBy!)?.textContent).toBe(
        errorCopy.create.VALIDATION_ERROR,
      );
      expect(input()).toHaveProperty('value', raw);
      expect(document.activeElement).toBe(input());
      expect(screen.getByText(emptyStateCopy)).toBeDefined();
    },
  );

  it('shows the same validation copy and attributes on a server VALIDATION_ERROR', async () => {
    vi.mocked(createTodo).mockResolvedValue({
      ok: false,
      code: 'VALIDATION_ERROR',
      message: serverMessage,
    } as unknown as ApiResult<Todo>);
    await renderReady([todoA]);

    await submit('Buy milk');

    expect(screen.getByRole('status').textContent).toBe(errorCopy.create.VALIDATION_ERROR);
    expect(input().getAttribute('aria-invalid')).toBe('true');
    const describedBy = input().getAttribute('aria-describedby');
    expect(document.getElementById(describedBy!)?.textContent).toBe(
      errorCopy.create.VALIDATION_ERROR,
    );
    expect(document.body.textContent).not.toContain(serverMessage);
    expect(input()).toHaveProperty('value', 'Buy milk');
    const items = within(screen.getByRole('list', { name: 'Todos' })).getAllByRole('listitem');
    expect(items).toHaveLength(1);
    expect(within(items[0]!).getByText('first')).toBeDefined();
  });

  it('keeps the text, focus and list on an INTERNAL_ERROR, with no aria-invalid', async () => {
    vi.mocked(createTodo).mockResolvedValue({ ok: false, code: 'INTERNAL_ERROR' });
    await renderReady([todoA]);

    await submit('Buy milk', 'add');

    expect(screen.getByRole('status').textContent).toBe(errorCopy.create.INTERNAL_ERROR);
    expect(input().hasAttribute('aria-invalid')).toBe(false);
    expect(input().hasAttribute('aria-describedby')).toBe(false);
    expect(input()).toHaveProperty('value', 'Buy milk');
    expect(document.activeElement).toBe(input());
    expect(addButton()).toHaveProperty('disabled', false);
    const items = within(screen.getByRole('list', { name: 'Todos' })).getAllByRole('listitem');
    expect(items).toHaveLength(1);
    expect(within(items[0]!).getByText('first')).toBeDefined();
    expect(screen.queryByRole('button', { name: retryLabel })).toBeNull();
  });

  it('clears the message when the next submit starts', async () => {
    vi.mocked(createTodo).mockResolvedValue({ ok: true, data: todoC });
    await renderReady([]);
    await submit('');
    expect(screen.getByRole('status').textContent).toBe(errorCopy.create.VALIDATION_ERROR);

    await submit('Buy milk');

    expect(screen.getByRole('status').textContent).toBe('');
    expect(input().hasAttribute('aria-invalid')).toBe(false);
  });

  it('disables Add while the list is loading', () => {
    vi.mocked(listTodos).mockReturnValue(new Promise(() => {}));

    render(<App />);

    expect(addButton()).toHaveProperty('disabled', true);
    expect(input()).toHaveProperty('disabled', false);
  });

  it('disables Add in the load Error State and keeps one live region', async () => {
    vi.mocked(listTodos).mockResolvedValue({ ok: false, code: 'INTERNAL_ERROR' });

    render(<App />);
    await screen.findByRole('button', { name: retryLabel });

    expect(addButton()).toHaveProperty('disabled', true);
    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(screen.getByRole('status').textContent).toContain(errorCopy.load.INTERNAL_ERROR);
  });
});

describe('App toggle', () => {
  beforeEach(() => {
    vi.mocked(listTodos).mockReset();
    vi.mocked(updateTodo).mockReset();
    vi.mocked(listTodos).mockResolvedValue({ ok: true, data: [todoB, todoA] });
  });

  it('keeps the checkbox until the response, disables only that item, then checks it', async () => {
    const pending = deferred<Todo>();
    vi.mocked(updateTodo).mockReturnValueOnce(pending.promise);
    render(<App />);
    const box = (await screen.findByRole('checkbox', { name: '<b>x</b>' })) as HTMLInputElement;

    fireEvent.click(box);
    fireEvent.click(box);

    expect(updateTodo).toHaveBeenCalledTimes(1);
    expect(updateTodo).toHaveBeenCalledWith('b', { completed: true });
    expect(box.checked).toBe(false);
    expect(box.disabled).toBe(true);
    expect(
      (screen.getByRole('button', { name: 'Delete <b>x</b>' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect((screen.getByRole('checkbox', { name: 'first' }) as HTMLInputElement).disabled).toBe(
      false,
    );

    await act(async () => {
      pending.resolve({ ok: true, data: { ...todoB, completed: true } });
    });
    const after = screen.getByRole('checkbox', { name: '<b>x</b>' }) as HTMLInputElement;
    expect(after.checked).toBe(true);
    expect(after.disabled).toBe(false);
    expect(screen.getAllByRole('listitem')[0]?.className).toContain(itemStyles.completed);
    expect(screen.getByRole('status').textContent).toBe('');
  });

  it('unticks a Completed Todo', async () => {
    vi.mocked(updateTodo).mockResolvedValueOnce({ ok: true, data: { ...todoA, completed: false } });
    render(<App />);

    fireEvent.click(await screen.findByRole('checkbox', { name: 'first' }));

    await waitFor(() =>
      expect((screen.getByRole('checkbox', { name: 'first' }) as HTMLInputElement).checked).toBe(
        false,
      ),
    );
    expect(updateTodo).toHaveBeenCalledWith('a', { completed: false });
  });

  it('keeps the state and names the update on a failure, without marking the input invalid', async () => {
    vi.mocked(updateTodo).mockResolvedValueOnce({ ok: false, code: 'VALIDATION_ERROR' });
    render(<App />);

    fireEvent.click(await screen.findByRole('checkbox', { name: '<b>x</b>' }));

    expect(await screen.findByText(errorCopy.toggle.VALIDATION_ERROR)).toBeDefined();
    const box = screen.getByRole('checkbox', { name: '<b>x</b>' }) as HTMLInputElement;
    expect(box.checked).toBe(false);
    expect(box.disabled).toBe(false);
    expect(screen.getByRole('textbox', { name: 'New todo' }).getAttribute('aria-invalid')).not.toBe(
      'true',
    );
    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(document.body.textContent).not.toContain(serverMessage);
  });

  it('removes a vanished Todo and shows the Empty State when it was the last', async () => {
    vi.mocked(listTodos).mockResolvedValue({ ok: true, data: [todoA] });
    vi.mocked(updateTodo).mockResolvedValueOnce({ ok: false, code: 'NOT_FOUND' });
    render(<App />);

    fireEvent.click(await screen.findByRole('checkbox', { name: 'first' }));

    expect(await screen.findByText(emptyStateCopy)).toBeDefined();
    expect(screen.getByRole('status').textContent).toBe(errorCopy.toggle.NOT_FOUND);
  });

  it('toggles from the keyboard', async () => {
    vi.mocked(updateTodo).mockResolvedValueOnce({ ok: true, data: { ...todoB, completed: true } });
    render(<App />);
    const box = await screen.findByRole('checkbox', { name: '<b>x</b>' });

    // Space on a focused checkbox dispatches a click; jsdom does not synthesize it.
    box.focus();
    fireEvent.click(box);

    expect(updateTodo).toHaveBeenCalledWith('b', { completed: true });
    expect(document.activeElement).toBe(screen.getByRole('checkbox', { name: '<b>x</b>' }));
  });
});
