import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

import { buildApp } from './app.js';
import { SqliteTodoRepository } from './repository/sqlite-todo-repository.js';

// The only env reader (AD-11).
const host = process.env.HOST ?? '0.0.0.0';
const port = Number(process.env.PORT ?? '3000');
const dbPath = process.env.DB_PATH ?? '/data/todos.db';
const logLevel = process.env.LOG_LEVEL ?? 'info';
const nodeEnv = process.env.NODE_ENV ?? 'development';

mkdirSync(dirname(dbPath), { recursive: true });
const repository = new SqliteTodoRepository(dbPath);
const app = buildApp({ repository, logger: { level: logLevel } });

const shutdown = (signal: NodeJS.Signals): void => {
  app.log.info({ signal }, 'shutting down');
  app.close().catch((err: unknown) => {
    app.log.error({ err }, 'shutdown failed');
    process.exitCode = 1;
  });
};
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);

app.log.info({ nodeEnv, dbPath }, 'api starting');
app.listen({ host, port }).catch((err: unknown) => {
  app.log.error({ err }, 'listen failed');
  process.exit(1);
});
