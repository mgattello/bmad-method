import { DESCRIPTION_MAX, type Todo } from '@todo/contract';

import type { TodoRepository } from '../repository/todo-repository.js';
import { ValidationError } from './errors.js';

const DESCRIPTION_RULE = `description must be 1 to ${DESCRIPTION_MAX} characters after trimming`;

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

  // Trim, then 1..DESCRIPTION_MAX (AD-6); id and createdAt are server-assigned (AD-2).
  create(description: string): Todo {
    const trimmed = description.trim();
    // Length counts UTF-16 code units, the same measure as the client's .length and HTML maxlength.
    if (trimmed.length === 0 || trimmed.length > DESCRIPTION_MAX) {
      throw new ValidationError(DESCRIPTION_RULE);
    }
    const todo: Todo = {
      id: crypto.randomUUID(),
      description: trimmed,
      completed: false,
      createdAt: new Date().toISOString(),
    };
    this.repository.insert(todo);
    return todo;
  }

  ping(): void {
    this.repository.ping();
  }
}
