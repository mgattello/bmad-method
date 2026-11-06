import { DESCRIPTION_MAX, type Todo, type UpdateTodoBody } from '@todo/contract';

import type { TodoRepository } from '../repository/todo-repository.js';
import { NotFoundError, ValidationError } from './errors.js';

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
    const todo: Todo = {
      id: crypto.randomUUID(),
      description: this.validDescription(description),
      completed: false,
      createdAt: new Date().toISOString(),
    };
    this.repository.insert(todo);
    return todo;
  }

  // Not-found first, then the description rule; id and createdAt come from the stored row (AD-2).
  update(id: string, patch: UpdateTodoBody): Todo {
    const existing = this.repository.findById(id);
    if (!existing) throw new NotFoundError('Todo not found');
    const updated: Todo = {
      ...existing,
      description:
        patch.description !== undefined
          ? this.validDescription(patch.description)
          : existing.description,
      completed: patch.completed ?? existing.completed,
    };
    this.repository.update(updated);
    return updated;
  }

  // Not-found when the id is not stored; otherwise the row is gone before this returns.
  delete(id: string): void {
    if (!this.repository.findById(id)) throw new NotFoundError('Todo not found');
    this.repository.remove(id);
  }

  // The one description rule, shared by create and update.
  private validDescription(raw: string): string {
    const trimmed = raw.trim();
    // Length counts UTF-16 code units, the same measure as the client's .length and HTML maxlength.
    if (trimmed.length === 0 || trimmed.length > DESCRIPTION_MAX) {
      throw new ValidationError(DESCRIPTION_RULE);
    }
    return trimmed;
  }

  ping(): void {
    this.repository.ping();
  }
}
