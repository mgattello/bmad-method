import Type, { type Static } from 'typebox';

// Server-side rule (AD-6): description is 1..DESCRIPTION_MAX chars after trim.
export const DESCRIPTION_MAX = 500;

// id and createdAt are server-assigned; plain strings keep one definition of valid.
export const TodoSchema = Type.Object(
  {
    id: Type.String(),
    description: Type.String(),
    completed: Type.Boolean(),
    createdAt: Type.String(),
  },
  { additionalProperties: false },
);

export type Todo = Static<typeof TodoSchema>;

export const TodoListSchema = Type.Array(TodoSchema);

export type TodoList = Static<typeof TodoListSchema>;

export const CreateTodoBodySchema = Type.Object(
  { description: Type.String() },
  { additionalProperties: false },
);

export type CreateTodoBody = Static<typeof CreateTodoBodySchema>;

export const UpdateTodoBodySchema = Type.Partial(
  Type.Object({ description: Type.String(), completed: Type.Boolean() }),
  { additionalProperties: false, minProperties: 1 },
);

export type UpdateTodoBody = Static<typeof UpdateTodoBodySchema>;
