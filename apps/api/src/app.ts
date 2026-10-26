import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { ErrorCode, type ErrorBody } from '@todo/contract';
import Fastify, { LogController, type FastifyServerOptions } from 'fastify';

import type { TodoRepository } from './repository/todo-repository.js';
import { healthRoutes } from './routes/health.js';
import { todoRoutes } from './routes/todos.js';
import { ValidationError } from './service/errors.js';
import { TodoService } from './service/todo-service.js';

export type AppDeps = {
  repository: TodoRepository;
  logger?: FastifyServerOptions['logger'];
};

const NOT_FOUND: ErrorBody = { code: ErrorCode.NOT_FOUND, message: 'Not found' };
const VALIDATION_ERROR: ErrorBody = {
  code: ErrorCode.VALIDATION_ERROR,
  message: 'Invalid request',
};
const INTERNAL_ERROR: ErrorBody = { code: ErrorCode.INTERNAL_ERROR, message: 'Unexpected error' };

// Thrown values are not always Errors; only a numeric statusCode is trusted.
function statusOf(error: unknown): number {
  const status = (error as { statusCode?: unknown } | null)?.statusCode;
  return typeof status === 'number' ? status : 500;
}

// Composition root: reads no env; server.ts wires the environment in.
export function buildApp({ repository, logger = false }: AppDeps) {
  const app = Fastify({
    logger,
    logController: new LogController({ disableRequestLogging: true }),
    ajv: { customOptions: { coerceTypes: false, removeAdditional: false } },
  }).withTypeProvider<TypeBoxTypeProvider>();

  const service = new TodoService(repository);

  // Exactly one completion line per request (AD-11).
  app.addHook('onResponse', async (request, reply) => {
    request.log.info(
      {
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        responseTime: reply.elapsedTime,
      },
      'request completed',
    );
  });

  // One envelope (AD-3); library messages never reach the body.
  app.setErrorHandler((error, request, reply) => {
    const status = statusOf(error);
    if (status === 404) {
      request.log.debug({ err: error }, 'not found');
      return reply.code(404).send(NOT_FOUND);
    }
    // Our own rule text may pass through; library text never does.
    if (error instanceof ValidationError) {
      request.log.debug({ err: error }, 'rejected by rule');
      return reply.code(400).send({ code: ErrorCode.VALIDATION_ERROR, message: error.message });
    }
    if (status >= 400 && status < 500) {
      request.log.debug({ err: error }, 'rejected request');
      return reply.code(400).send(VALIDATION_ERROR);
    }
    request.log.error({ err: error }, 'unhandled error');
    return reply.code(500).send(INTERNAL_ERROR);
  });

  app.setNotFoundHandler((_request, reply) => reply.code(404).send(NOT_FOUND));

  app.addHook('onClose', async () => {
    repository.close();
  });

  app.register(todoRoutes, { service });
  app.register(healthRoutes, { service });

  return app;
}
