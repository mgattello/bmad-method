import { TODOS_PATH } from '@todo/contract';
import { act, render, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('web placeholder', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('mounts into #root and renders the heading with the contract path', async () => {
    document.body.innerHTML = '<div id="root"></div>';
    const { App } = await act(() => import('./main.js'));

    expect(document.querySelector('#root h1')?.textContent).toBe('Todo');

    const view = within(render(<App />).container);
    expect(view.getByRole('heading', { level: 1 }).textContent).toBe('Todo');
    expect(view.getByText(`List endpoint: ${TODOS_PATH}`)).toBeDefined();
  });

  it('does not mount when #root is missing', async () => {
    document.body.innerHTML = '';
    await act(() => import('./main.js'));

    expect(document.querySelector('h1')).toBeNull();
  });
});
