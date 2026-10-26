# Todo App

A single-screen Todo application: a React web client, a Fastify HTTP API on SQLite, and a shared
API contract package, run as two containers with `docker compose up`.

The architecture is described in [docs/architecture.md](docs/architecture.md). The binding
decisions live in the architecture spine it links to. Every story appends to
[docs/ai-integration-log.md](docs/ai-integration-log.md).

## Prerequisites

- Node.js 24 (see `.nvmrc`) and npm 11
- Python 3 (node-gyp's configure step for better-sqlite3; nothing is compiled, prebuilt bindings are
  used)
- Docker with Compose v2 (added in Story 1.4)

## Layout

```text
package.json             npm workspaces; fan-out scripts (contract builds first)
tsconfig.base.json       shared strict compiler base
eslint.config.js         one ESLint flat config
.prettierrc, .prettierignore   one Prettier config
.nvmrc                   Node major for nvm
.gitignore, .dockerignore      build outputs and secrets kept out of git and images
.env.example             every environment variable with its default
packages/contract/       @todo/contract: Todo type, TypeBox schemas, paths, error codes
apps/api/                @todo/api: Fastify API on SQLite (better-sqlite3)
apps/api/src/            app.ts (buildApp), server.ts (env + listen), routes/, service/, repository/
apps/api/test/           API integration specs (*.int.test.ts, fastify.inject on a temp SQLite file)
apps/web/                @todo/web: React + Vite client: list, loading, empty and error states
e2e/                     Playwright harness (Story 1.5)
docs/                    architecture.md, ai-integration-log.md, qa/
```

`packages/contract` is the only definition of the API. Both apps import it and declare no
`Todo` type or `/api/v1` path of their own. It must be built before either app; every root
script except `test:e2e` does that for you.

## Commands

Run from the repository root.

| Command            | What it does                                                                              |
| ------------------ | ----------------------------------------------------------------------------------------- |
| `npm ci`           | Install every workspace from the one root `package-lock.json`                             |
| `npm run build`    | Build contract, then api, then web                                                        |
| `npm test`         | Unit tests with coverage (70% lines and branches per app) for all three                   |
| `npm run test:int` | API integration tests (`apps/api/test/*.int.test.ts`): todos GET and POST, health, errors |
| `npm run test:e2e` | E2E against the built images (placeholder until Story 1.5)                                |
| `npm run lint`     | Build contract, ESLint, Prettier check, then type-check every workspace (tests included)  |
| `npm run format`   | Prettier write                                                                            |

Workspace scripts can be run alone, for example `npm run dev -w apps/web`. Build the contract
first on a fresh checkout: `npm run build -w packages/contract`.

### Run the API locally

```sh
npm run build -w packages/contract
DB_PATH=./todos.db npm run dev -w apps/api
```

The API listens on `http://localhost:3000` (`HOST` and `PORT` override that), creates the SQLite
file at `DB_PATH` on first start, and reloads on source changes (`tsx watch`). Try
`curl localhost:3000/api/v1/todos` (a JSON array, newest first) and
`curl localhost:3000/api/v1/health` (`{"status":"ok"}`). To create a Todo:

```sh
curl -X POST localhost:3000/api/v1/todos -H 'content-type: application/json' -d '{"description":"Buy milk"}'
```

That answers `201` with the Todo (server-assigned `id` and `createdAt`, description trimmed), and
the next `GET` lists it first. An empty description, or one over `DESCRIPTION_MAX` characters (500
today) after trimming, answers `400 { "code": "VALIDATION_ERROR", "message": "..." }` and stores
nothing; so do a wrong type, an unknown field, malformed JSON and a non-JSON content type. Every
request logs one JSON line with `method`, `url`, `statusCode` and `responseTime`. The workspace
script runs with `apps/api` as its working directory, so the example creates `apps/api/todos.db`;
`*.db`, `*.db-wal` and `*.db-shm` are ignored by git and by the Docker build context.

## Configuration

`.env.example` documents every variable with its default; nothing loads it as a file.

- The api reads `HOST`, `PORT`, `DB_PATH`, `LOG_LEVEL` and `NODE_ENV` from the process
  environment. Compose sets them; for a local run, export them in the shell. The `DB_PATH` and
  `NODE_ENV` defaults in `.env.example` are container values.
- The web dev server reads `API_PROXY_TARGET` from the process environment, so export it in the
  shell before `npm run dev -w apps/web`.
- `WEB_PORT` is read by compose.

## Web

`npm run dev -w apps/web` serves the client on port 5173 and proxies `/api/` to
`API_PROXY_TARGET` (default `http://localhost:3000`). Until an API is reachable at that target
the list shows the Error State with a Retry button. The input adds a Todo through the API: Enter
or the Add control sends the trimmed description to `POST /api/v1/todos` and the returned Todo
goes to the top of the list; while a create is pending, or the list is loading or failed, Add is
disabled. An empty or whitespace-only description, or one over `DESCRIPTION_MAX` characters, is
rejected locally with the same message a server `VALIDATION_ERROR` shows; a failed create keeps
the typed text and focus. Copy for every state, validation and failure message lives in
`apps/web/src/copy.ts`; the server's error `message` is never shown. `e2e/create.spec.ts` and
`e2e/validation.spec.ts` cover the input end to end and run under the Story 1.5 harness.

## Docker

Added in Story 1.4.

## E2E

Added in Story 1.5.
