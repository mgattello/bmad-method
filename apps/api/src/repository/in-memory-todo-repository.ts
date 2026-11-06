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

  findById(id: string): Todo | undefined {
    const found = this.todos.find((t) => t.id === id);
    return found ? { ...found } : undefined;
  }

  insert(todo: Todo): void {
    this.todos.push({ ...todo });
  }

  // Replaces in place so insertion order, and with it the tie-break, is unchanged.
  update(todo: Todo): void {
    const index = this.todos.findIndex((t) => t.id === todo.id);
    if (index !== -1) this.todos[index] = { ...todo };
  }

  remove(id: string): void {
    const index = this.todos.findIndex((t) => t.id === id);
    if (index !== -1) this.todos.splice(index, 1);
  }

  ping(): void {}

  close(): void {}
}
