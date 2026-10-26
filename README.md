# Todo App

A single-screen Todo application: a React web client, a Fastify HTTP API on SQLite, and a shared
API contract package, run as two containers with `docker compose up`.

The architecture is described in [docs/architecture.md](docs/architecture.md). The binding
decisions live in the architecture spine it links to. Every story appends to
[docs/ai-integration-log.md](docs/ai-integration-log.md).

## Prerequisites

- Node.js 24 (see `.nvmrc`) and npm 11
- Docker with Compose v2 (added in Story 1.4)

## Layout

```text
package.json             npm workspaces; fan-out scripts (contract builds first)
tsconfig.base.json       shared strict compiler base
eslint.config.js         one ESLint flat config
.prettierrc              one Prettier config
.env.example             every environment variable with its default
packages/contract/       @todo/contract: Todo type, TypeBox schemas, paths, error codes
apps/api/                @todo/api: Fastify API (routes arrive in Story 1.2)
apps/web/                @todo/web: React + Vite client (list and states arrive in Story 1.3)
e2e/                     Playwright harness (Story 1.5)
docs/                    architecture.md, ai-integration-log.md, qa/
```

`packages/contract` is the only definition of the API. Both apps import it and declare no
`Todo` type or `/api/v1` path of their own. It must be built before either app; every root
script does that for you.

## Commands

Run from the repository root.

| Command            | What it does                                                             |
| ------------------ | ------------------------------------------------------------------------ |
| `npm ci`           | Install every workspace from the one root `package-lock.json`            |
| `npm run build`    | Build contract, then api, then web                                       |
| `npm test`         | Unit tests with coverage (70% lines and branches per app) for all three  |
| `npm run test:int` | API integration tests (`apps/api/test/*.int.test.ts`; specs land in 1.2) |
| `npm run test:e2e` | E2E against the built images (placeholder until Story 1.5)               |
| `npm run lint`     | ESLint and Prettier check                                                |
| `npm run format`   | Prettier write                                                           |

Workspace scripts can be run alone, for example `npm run dev -w apps/web`. Build the contract
first on a fresh checkout: `npm run build -w packages/contract`.

## Configuration

`.env.example` documents every variable with its default; nothing loads it as a file.

- The api reads `HOST`, `PORT`, `DB_PATH`, `LOG_LEVEL` and `NODE_ENV` from the process
  environment. Compose sets them; for a local run, export them in the shell. The `DB_PATH` and
  `NODE_ENV` defaults in `.env.example` are container values.
- The web dev server reads `API_PROXY_TARGET` from the process environment, so export it in the
  shell before `npm run dev -w apps/web`.
- `WEB_PORT` is read by compose.

## Docker

Added in Story 1.4.

## E2E

Added in Story 1.5.
