import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import {
  CreateTodoBodySchema,
  TODOS_PATH,
  TodoListSchema,
  TodoSchema,
  UpdateTodoBodySchema,
} from '@todo/contract';
import Type from 'typebox';

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

  // Unknown or malformed id is the service's NotFoundError; the handler builds no error body (AD-3).
  app.patch(
    `${TODOS_PATH}/:id`,
    {
      schema: {
        params: Type.Object({ id: Type.String() }),
        body: UpdateTodoBodySchema,
        response: { 200: TodoSchema },
      },
    },
    async (request) => service.update(request.params.id, request.body),
  );

  app.delete(
    `${TODOS_PATH}/:id`,
    { schema: { params: Type.Object({ id: Type.String() }) } },
    async (request, reply) => {
      service.delete(request.params.id);
      return reply.code(204).send();
    },
  );
};
