import Value from 'typebox/value';
import { describe, expect, it } from 'vitest';

import {
  API_PREFIX,
  CreateTodoBodySchema,
  DESCRIPTION_MAX,
  ErrorBodySchema,
  ErrorCode,
  HEALTH_PATH,
  HealthBodySchema,
  TODOS_PATH,
  TodoListSchema,
  TodoSchema,
  UpdateTodoBodySchema,
  todoPath,
  type Todo,
} from './index.js';

const validTodo: Todo = {
  id: '6f1c2a0e-5d3b-4c8a-9e2f-1b7d4a9c3e10',
  description: 'x',
  completed: false,
  createdAt: '2026-10-26T11:42:07.512Z',
};

describe('TodoSchema', () => {
  it('accepts a valid Todo', () => {
    expect(Value.Check(TodoSchema, validTodo)).toBe(true);
  });

  it('keeps id and createdAt as plain strings with no format keyword', () => {
    expect(TodoSchema.properties.id).toEqual({ type: 'string' });
    expect(TodoSchema.properties.createdAt).toEqual({ type: 'string' });
  });

  it('rejects an unknown field', () => {
    expect(Value.Check(TodoSchema, { ...validTodo, owner: 'me' })).toBe(false);
  });

  it('rejects a missing or mistyped field', () => {
    expect(Value.Check(TodoSchema, { ...validTodo, completed: 'no' })).toBe(false);
    const { id, description, completed } = validTodo;
    expect(Value.Check(TodoSchema, { id, description, completed })).toBe(false);
  });
});

describe('TodoListSchema', () => {
  it('accepts an array of Todos and rejects a bad element', () => {
    expect(Value.Check(TodoListSchema, [])).toBe(true);
    expect(Value.Check(TodoListSchema, [validTodo])).toBe(true);
    expect(Value.Check(TodoListSchema, [{ ...validTodo, owner: 'me' }])).toBe(false);
  });
});

describe('CreateTodoBodySchema', () => {
  it('accepts { description }', () => {
    expect(Value.Check(CreateTodoBodySchema, { description: 'x' })).toBe(true);
  });

  it('rejects a non-string description or an extra field', () => {
    expect(Value.Check(CreateTodoBodySchema, { description: 1 })).toBe(false);
    expect(Value.Check(CreateTodoBodySchema, { description: 'x', completed: true })).toBe(false);
    expect(Value.Check(CreateTodoBodySchema, {})).toBe(false);
  });
});

describe('UpdateTodoBodySchema', () => {
  it('rejects an empty PATCH body', () => {
    expect(UpdateTodoBodySchema).toMatchObject({ minProperties: 1 });
    expect(Value.Check(UpdateTodoBodySchema, {})).toBe(false);
  });

  it('accepts either field alone or both together', () => {
    expect(Value.Check(UpdateTodoBodySchema, { description: 'y' })).toBe(true);
    expect(Value.Check(UpdateTodoBodySchema, { completed: true })).toBe(true);
    expect(Value.Check(UpdateTodoBodySchema, { description: 'y', completed: true })).toBe(true);
  });

  it('rejects unknown or mistyped fields', () => {
    expect(Value.Check(UpdateTodoBodySchema, { owner: 'me' })).toBe(false);
    expect(Value.Check(UpdateTodoBodySchema, { completed: 'yes' })).toBe(false);
  });
});

describe('ErrorBodySchema', () => {
  it('accepts every ErrorCode with a message', () => {
    for (const code of Object.values(ErrorCode)) {
      expect(Value.Check(ErrorBodySchema, { code, message: 'm' })).toBe(true);
    }
  });

  it('rejects a code outside ErrorCode, a missing message, or an extra field', () => {
    expect(Value.Check(ErrorBodySchema, { code: 'TEAPOT', message: 'm' })).toBe(false);
    expect(Value.Check(ErrorBodySchema, { code: ErrorCode.NOT_FOUND })).toBe(false);
    expect(
      Value.Check(ErrorBodySchema, { code: ErrorCode.NOT_FOUND, message: 'm', status: 404 }),
    ).toBe(false);
  });

  it('exposes exactly the three codes', () => {
    expect(ErrorCode).toEqual({
      VALIDATION_ERROR: 'VALIDATION_ERROR',
      NOT_FOUND: 'NOT_FOUND',
      INTERNAL_ERROR: 'INTERNAL_ERROR',
    });
  });
});

describe('HealthBodySchema', () => {
  it('accepts ok and degraded only', () => {
    expect(Value.Check(HealthBodySchema, { status: 'ok' })).toBe(true);
    expect(Value.Check(HealthBodySchema, { status: 'degraded' })).toBe(true);
    expect(Value.Check(HealthBodySchema, { status: 'up' })).toBe(false);
    expect(Value.Check(HealthBodySchema, { status: 'ok', uptime: 1 })).toBe(false);
  });
});

describe('paths', () => {
  it('builds the fixed paths with no trailing slash', () => {
    expect(API_PREFIX).toBe('/api/v1');
    expect(TODOS_PATH).toBe('/api/v1/todos');
    expect(HEALTH_PATH).toBe('/api/v1/health');
  });

  it('builds a Todo path from an id', () => {
    expect(todoPath('abc')).toBe('/api/v1/todos/abc');
    expect(todoPath('a/b')).toBe('/api/v1/todos/a%2Fb');
  });
});

describe('DESCRIPTION_MAX', () => {
  it('is 500', () => {
    expect(DESCRIPTION_MAX).toBe(500);
  });
});
