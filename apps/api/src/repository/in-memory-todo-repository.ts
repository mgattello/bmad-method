import type { Todo } from '@todo/contract';

import type { TodoRepository } from './todo-repository.js';

// Unit-test double (AD-4); mirrors the SQL order guarantee from a seeded array.
export class InMemoryTodoRepository implements TodoRepository {
  private readonly todos: Todo[];

  constructor(seed: readonly Todo[] = []) {
    this.todos = [...seed];
  }

  list(): Todo[] {
    // Reverse first so insertion order breaks ties newest-inserted first, like rowid DESC.
    return [...this.todos]
      .reverse()
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
  }

  insert(todo: Todo): void {
    this.todos.push({ ...todo });
  }

  ping(): void {}

  close(): void {}
}
