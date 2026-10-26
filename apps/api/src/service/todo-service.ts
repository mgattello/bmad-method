import type { Todo } from '@todo/contract';

import type { TodoRepository } from '../repository/todo-repository.js';

// Domain rules live here (AD-4); the only caller of the repository.
export class TodoService {
  private readonly repository: TodoRepository;

  constructor(repository: TodoRepository) {
    this.repository = repository;
  }

  // Newest first is an API guarantee (AD-8); stable sort keeps repository order on ties.
  list(): Todo[] {
    return [...this.repository.list()].sort((a, b) =>
      a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0,
    );
  }

  ping(): void {
    this.repository.ping();
  }
}
