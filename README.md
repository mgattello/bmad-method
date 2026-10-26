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
- Docker with Compose v2 (the graded `docker compose up` and the E2E harness)

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

```sh
docker compose up --build
```

Then open `http://localhost:8080`. The first build installs and builds every workspace inside the
images; later builds reuse the cached dependency layer unless the lockfile or a `package.json`
changes. Add `-d`
to run detached, and `--wait` to block until both containers report healthy. `WEB_PORT` changes the
host port (`WEB_PORT=8081 docker compose up`); nothing else is published. `docker compose logs api`
shows one JSON line per request; `docker compose logs -f` follows both containers.

The database lives at `/data/todos.db` on the named volume `todo-data`, so `docker compose restart`
and `docker compose down` keep every Todo. `docker compose down -v` deletes the volume and is the
only way to lose data.

The images are the deliverable: `api` is `node:24-alpine` running `node apps/api/dist/server.js` as
the `node` user with the workspace layout kept so `@todo/contract` resolves, and `web` is
`nginxinc/nginx-unprivileged:1.30-alpine` serving the Vite build on 8080, proxying `/api/` to
`http://api:3000` and answering `/healthz`. Each Dockerfile owns its `HEALTHCHECK` and builds from
the repository root in three stages (`deps`, `build`, `runtime`); `web` starts only after `api` is
healthy.

### Dev profile

```sh
docker compose --profile dev up
```

This adds `api-dev` on `http://localhost:3000` (`tsx watch` beside the contract's `tsc --watch`,
via the root `dev:api` script) and `web-dev` on `http://localhost:5173` (Vite, proxying `/api/`
to `http://api-dev:3000`). Both mount the repository at `/app`, keep every `node_modules` in an
anonymous volume and run `npm ci` inside the container on each start (seconds to a few minutes
depending on the network); host `node_modules` are never used. Each then builds the contract once
before its watcher starts. `web-dev` has no readiness gate on `api-dev`, so Vite's proxy logs
`ECONNREFUSED` until `api-dev` is listening. `api-dev` writes to `/data/dev.db` on the same
`todo-data` volume, so it never shares a file with `api`, and hands `/data` to `node` on start, so
the dev profile is safe on a fresh volume. The built `api` and `web` services start under this
profile too; to run only the hot-reload pair, name them:
`docker compose --profile dev up api-dev web-dev`. Stop the dev pair with
`docker compose --profile dev down`.

## E2E

Added in Story 1.5.
