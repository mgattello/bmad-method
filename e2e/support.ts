import type { APIRequestContext, APIResponse } from '@playwright/test';
import { TODOS_PATH, todoPath } from '@todo/contract';

// User-visible copy as literals: e2e never imports apps/*.
export const EMPTY_STATE_TEXT = 'No todos yet. Add your first one above.';
export const LOAD_ERROR_TEXT = "We couldn't load your todos. Check your connection and try again.";
export const LOADING_TEXT = 'Loading your todos';
export const RETRY_LABEL = 'Retry';
export const LIST_REGION_NAME = 'Todo List';

async function unexpected(action: string, res: APIResponse): Promise<Error> {
  return new Error(`${action} answered ${res.status()}: ${await res.text()}`);
}

// Empties the store through the API; a 404 DELETE is tolerated until Story 2.4 ships the route.
export async function purgeTodos(request: APIRequestContext): Promise<void> {
  const list = await request.get(TODOS_PATH);
  if (!list.ok()) throw await unexpected(`GET ${TODOS_PATH}`, list);
  const todos = (await list.json()) as { id: string }[];
  for (const { id } of todos) {
    const res = await request.delete(todoPath(id));
    if (!res.ok() && res.status() !== 404) throw await unexpected(`DELETE ${todoPath(id)}`, res);
  }
}
