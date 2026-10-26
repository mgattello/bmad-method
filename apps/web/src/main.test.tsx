import { act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Factory mock survives vi.resetModules; App itself is tested in App.test.tsx.
vi.mock('./api/todos-client.js', () => ({
  listTodos: () => Promise.resolve({ ok: true, data: [] }),
}));

describe('web entry', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('mounts App into #root', async () => {
    document.body.innerHTML = '<div id="root"></div>';
    await act(() => import('./main.js'));

    expect(document.querySelector('#root h1')?.textContent).toBe('Todo');
  });

  it('does not mount when #root is missing', async () => {
    document.body.innerHTML = '';
    await act(() => import('./main.js'));

    expect(document.querySelector('h1')).toBeNull();
  });
});
