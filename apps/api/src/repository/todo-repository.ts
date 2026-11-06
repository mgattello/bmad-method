import type { Todo } from '@todo/contract';

// Storage port (AD-4, AD-10); TodoService is its only caller.
export interface TodoRepository {
  // Newest first: createdAt desc, then insertion desc. createdAt is canonical ISO 8601 UTC
  // with milliseconds and a trailing Z, so string order is time order.
  list(): Todo[];
  // A copy of the stored Todo, or undefined; throws when the store is unreachable.
  findById(id: string): Todo | undefined;
  // Stores the Todo as given; throws when the store is unreachable.
  insert(todo: Todo): void;
  // Stores description and completed for todo.id as given; throws when the store is unreachable.
  update(todo: Todo): void;
  // Throws when the store is unreachable.
  ping(): void;
  // Safe to call more than once.
  close(): void;
}
