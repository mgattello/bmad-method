import type { APIRequestContext } from '@playwright/test';
import { TODOS_PATH } from './copy';

type Todo = { id: string };

// Reset the list through the API: list, then delete each; an empty list is fine.
export async function purgeTodos(request: APIRequestContext): Promise<void> {
  const res = await request.get(TODOS_PATH);
  if (!res.ok()) throw new Error(`purge: list answered ${res.status()}`);
  const todos = (await res.json()) as Todo[];
  for (const todo of todos) {
    const del = await request.delete(`${TODOS_PATH}/${encodeURIComponent(todo.id)}`);
    // 404 means the DELETE route is not there yet (Story 2.4); leave the Todo in place.
    if (del.status() === 404) continue;
    if (!del.ok()) throw new Error(`purge: delete ${todo.id} answered ${del.status()}`);
  }
}
