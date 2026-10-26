import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { HEALTH_PATH, HealthBodySchema, type HealthBody } from '@todo/contract';

import type { TodoService } from '../service/todo-service.js';

export type HealthRoutesOptions = { service: TodoService };

const OK: HealthBody = { status: 'ok' };
const DEGRADED: HealthBody = { status: 'degraded' };

// The one non-envelope error body (AD-3): the route owns the 503.
export const healthRoutes: FastifyPluginAsyncTypebox<HealthRoutesOptions> = async (
  app,
  { service },
) => {
  app.get(
    HEALTH_PATH,
    { schema: { response: { 200: HealthBodySchema, 503: HealthBodySchema } } },
    async (_request, reply) => {
      try {
        service.ping();
      } catch {
        return reply.code(503).send(DEGRADED);
      }
      return OK;
    },
  );
};
