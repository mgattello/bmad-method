import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { TODOS_PATH, TodoListSchema } from '@todo/contract';

import type { TodoService } from '../service/todo-service.js';

export type TodoRoutesOptions = { service: TodoService };

export const todoRoutes: FastifyPluginAsyncTypebox<TodoRoutesOptions> = async (
  app,
  { service },
) => {
  app.get(TODOS_PATH, { schema: { response: { 200: TodoListSchema } } }, async () =>
    service.list(),
  );
};
