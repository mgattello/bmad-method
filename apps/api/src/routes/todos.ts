import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { CreateTodoBodySchema, TODOS_PATH, TodoListSchema, TodoSchema } from '@todo/contract';

import type { TodoService } from '../service/todo-service.js';

export type TodoRoutesOptions = { service: TodoService };

export const todoRoutes: FastifyPluginAsyncTypebox<TodoRoutesOptions> = async (
  app,
  { service },
) => {
  app.get(TODOS_PATH, { schema: { response: { 200: TodoListSchema } } }, async () =>
    service.list(),
  );

  // Schema checks type and shape only; the service owns the rules (AD-6).
  app.post(
    TODOS_PATH,
    { schema: { body: CreateTodoBodySchema, response: { 201: TodoSchema } } },
    async (request, reply) => reply.code(201).send(service.create(request.body.description)),
  );
};
