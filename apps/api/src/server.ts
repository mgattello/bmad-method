import { HEALTH_PATH, TODOS_PATH } from '@todo/contract';

// Placeholder entry; Story 1.2 replaces it with env wiring and Fastify listen.
export const ROUTES = {
  todos: TODOS_PATH,
  health: HEALTH_PATH,
} as const;
