# Epic 1 Context: A running Todo app you can open

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Stand up the foundation every later epic builds on: `docker compose up` brings up a healthy two-container stack, and a user who opens it sees the Todo List newest first, a Loading State while the first read is in flight, an Empty State when there are no Todos, or an Error State with a retry control when the load fails. This means the hand-scaffolded monorepo, the shared contract package, a Fastify API with list and health routes on a durable SQLite file, a React web shell with the `loading | ready | error` state machine, both Dockerfiles, compose with a dev profile, the four-level test infrastructure and a README skeleton. Create, toggle and delete land in Epic 2 on top of this.

## Stories

- Story 1.1: Scaffold the workspace and the API contract package
- Story 1.2: API lists Todos from a durable SQLite store and reports health
- Story 1.3: Web shell shows the Todo List with Loading, Empty and Error States
- Story 1.4: Run the whole stack with docker compose up
- Story 1.5: E2E harness proves the empty and failed-load journeys against the built images

## Requirements & Constraints

- On load the app fetches and renders every Todo (no pagination), newest first, showing Description and Completion Status; Created At is returned but not displayed. No onboarding, tour, modal, tooltip or instructional copy.
- Loading State is a designed skeleton or spinner inside the list region and never shows Empty State copy. Empty State is short, human-written and invites the first Todo.
- A failed list load replaces the list with an Error State plus a retry control that re-issues the load. Errors are announced to assistive technology. Never show raw error strings, stack traces or HTTP status codes.
- Todos survive refresh, new sessions and API restart; writes are durable before the API reports success; the API never crashes on malformed input and never returns 500 for user input.
- Health Endpoint returns 200 when the store is reachable, non-200 otherwise; both containers expose a health signal the orchestrator uses.
- Data model and API must not block adding per-user ownership and auth later; nothing assumes exactly one list (verified by review, not a test).
- Product completeness: page title set, no placeholder copy, no unstyled browser defaults, no layout shift on load. Simplicity: smallest dependency set that meets the requirements, boring technology, no abstraction without a requirement behind it.
- Initial render under 1 s with up to 200 Todos on a local or containerised stack with the API responding.
- One compose command starts the stack with both containers healthy; logs readable through the orchestrator; dev and test differ only by env vars and compose profiles.
- A new developer can run the app and all tests from the README alone. Coverage gate 70% lines and branches per app; tests that assert nothing do not count.
- Graded deliverables touched here: README, `docs/architecture.md`, and `docs/ai-integration-log.md` (every story appends an entry as part of its definition of done).

## Technical Decisions

- **Monorepo, no starter template.** npm workspaces at the repo root: `packages/contract`, `apps/api`, `apps/web`, `e2e/`. Root scripts `build`, `test`, `test:int`, `test:e2e`, `lint` fan out in dependency order, contract first. `tsconfig.base.json` strict with `erasableSyntaxOnly` and `verbatimModuleSyntax`; ESM everywhere; no TypeScript enum. Apps and e2e depend on contract; contract depends on nothing; nothing depends on `apps/*`. Every dependency matches the pinned versions in the architecture spine's Stack table (Node 24, TypeScript 6, Fastify 5, React 19, Vite 8, Vitest 5, Playwright 1.64, ESLint 10).
- **Contract package is the only API definition.** `@todo/contract` exports the `Todo` type, TypeBox request and response schemas, `DESCRIPTION_MAX` (500), `ErrorCode` (as const object plus union) and path constants `API_PREFIX`, `TODOS_PATH`, `todoPath(id)`, `HEALTH_PATH`. Compiled by tsc to `dist/`, built before either app and inside each Dockerfile. Neither app declares its own Todo type or literal paths.
- **REST shape.** `GET /api/v1/todos` returns `200 Todo[]`; `GET /api/v1/health` returns `200 {status:"ok"}` or `503 {status:"degraded"}`. Todo is `{ id: UUID v4, description, completed: boolean, createdAt: ISO 8601 UTC }`. Bare JSON, no envelope, no trailing slashes, `additionalProperties: false`, Ajv `removeAdditional: false`, `coerceTypes: false`. Create, PATCH and DELETE schemas are defined in the contract now; their routes are Epic 2.
- **One error envelope.** Every non-2xx body is `{ code, message }` with `VALIDATION_ERROR` (400), `NOT_FOUND` (404), `INTERNAL_ERROR` (500), produced by one `setErrorHandler` plus one `setNotFoundHandler`; routes never build error bodies. Unknown routes and malformed ids are NOT_FOUND.
- **Backend layering.** `routes/` (Fastify plugins with contract schemas) -> `service/TodoService` (all domain rules including ordering) -> `repository/TodoRepository` interface with `SqliteTodoRepository` (SQL only) and `InMemoryTodoRepository` (unit tests only). `buildApp(deps)` in `app.ts` receives the repository; `server.ts` alone reads env (`HOST` 0.0.0.0, `PORT` 3000, `DB_PATH`, `LOG_LEVEL` info, `NODE_ENV`) and calls `listen`. No module-level singleton list; all reads and writes go through one scope-aware query path (the multi-user seam).
- **Persistence.** `better-sqlite3` on `DB_PATH` (default `/data/todos.db`, named volume `todo-data`); one connection per process; WAL; `synchronous = FULL`; reply only after commit; prepared statements with bound parameters only; `CREATE TABLE IF NOT EXISTS` at startup, no migration tool. Columns snake_case (`completed` INTEGER 0/1, `created_at` millisecond precision), mapped to camelCase in the repository. List order `ORDER BY created_at DESC, rowid DESC` is an API guarantee; the web never re-sorts.
- **Logging and health.** pino JSON to stdout, exactly one completion line per request with method, url, statusCode, responseTime. Health route runs `SELECT 1`. Vitest sets `LOG_LEVEL=silent`.
- **Frontend state.** `api/todos-client.ts` builds every URL from contract constants, parses the envelope, treats any other non-2xx or non-JSON response (nginx 502, network failure) as INTERNAL_ERROR and never throws past its boundary. `state/use-todos.ts` holds one `loading | ready | error` state; `load()` runs on mount and on retry. User-facing copy lives in the web app, keyed by action plus code, and never shows the server `message`. Description is rendered as text content only.
- **Single origin.** nginx in the web container serves the Vite build, proxies `/api/` to `http://api:3000` (no rewrite, `proxy_http_version 1.1`, `proxy_intercept_errors off`), sends `X-Content-Type-Options: nosniff` and `Content-Security-Policy: default-src 'self'`, and serves a static `/healthz` 200. Vite dev server proxies `/api/` to `API_PROXY_TARGET` (no `VITE_` prefix, default `http://localhost:3000`) with `server.host: true`. The API enables no CORS.
- **Container recipe.** Build context is the repo root; root `.dockerignore` excludes `node_modules`, `dist`, `_bmad*`, `docs`, `e2e`, `.git`. Stages `deps` (full `npm ci` on `node:24-alpine`, build tools only here), `build` (contract then app, `npm prune --omit=dev`), `runtime`. api runtime keeps the `/app` workspace layout so the contract symlink resolves, never runs npm, chowns `/data` to `node` before `USER node`, runs `node apps/api/dist/server.js`. web runtime is `nginxinc/nginx-unprivileged:1.30-alpine` on 8080 with `apps/web/nginx.conf` as `/etc/nginx/conf.d/default.conf` (a `server {}` block only).
- **Health ownership.** Each Dockerfile owns the only `HEALTHCHECK` (`--interval=5s --timeout=3s --start-period=5s --retries=10`): api via `node -e` with global `fetch` against `http://127.0.0.1:3000/api/v1/health`, web via busybox `wget` against `http://127.0.0.1:8080/healthz`. Compose declares no healthcheck block and gates web with `depends_on: api: condition: service_healthy`.
- **Compose shape.** Unprofiled `api` and `web` are the built images; the host publishes web on `${WEB_PORT:-8080}` only. `dev` profile adds `api-dev` (3000, `tsx watch` plus contract `tsc --watch`) and `web-dev` (5173, `API_PROXY_TARGET=http://api-dev:3000`), both mounting the repo at `/app` with anonymous volumes over every `node_modules`, running `npm ci` then the workspace `dev` script. `.env.example` documents every variable.
- **Test homes.** Unit api `apps/api/src/**/*.test.ts` (Vitest, service vs in-memory repository); unit web `apps/web/src/**/*.test.tsx` (Vitest, jsdom, Testing Library, client mocked); integration `apps/api/test/*.int.test.ts` (`fastify.inject`, SQLite temp file per test file, one spec per endpoint); E2E `e2e/*.spec.ts`. Coverage via `@vitest/coverage-v8`, enforced by the root `test` script.
- **E2E lifecycle.** `test:e2e` owns the cycle under compose project `todo-e2e` with `WEB_PORT=8081`: `down -v`, `up --build --wait`, Playwright (`baseURL http://localhost:8081`, `workers: 1`, no `webServer`), `down -v`. `beforeEach` purges via the API. API failures are simulated with `page.route`; no test endpoint in the API.
- **Conventions.** JSON camelCase; files kebab-case; components and types PascalCase; one Fastify plugin per resource; ESLint 10 flat config (typescript-eslint, react-hooks) plus Prettier, one root config each; one root lockfile; plain CSS modules per component with one `tokens.css`, mobile-first, single breakpoint, no CSS framework.
- **Do not build.** Postgres, users and auth, migrations tool, pagination, filtering, sorting, prod profile, TLS, CI provider choice, rate limiting. QA tooling (Lighthouse vs axe, Playwright MCP, Postman MCP, Chrome DevTools MCP) is chosen in setup and QA stories and recorded in the AI integration log.

## UX & Interaction Patterns

- Component set: `TodoInput`, `TodoList`, `TodoItem`, `EmptyState`, `LoadingState`, `ErrorBanner` under `App`. Epic 1 renders the shell, list and states; write behaviour is Epic 2.
- Each Todo is a list item with a labelled checkbox reflecting Completion Status and a labelled delete button; completed items use at least two visual cues (strike-through, reduced contrast, checked control), never colour alone.
- Exactly one live region, `role="status"`, rendered by `ErrorBanner`, announces API failures.
- Design tokens (spacing, colour, type scale) in one `tokens.css`; usable at 360 px and 1280 px with no horizontal scroll, no clipping or overlap from 320 px to 1920 px, touch targets at least 44 x 44 px, visible focus, keyboard operable.

## Cross-Story Dependencies

- 1.1 is the base for every other story; every later story appends to `docs/ai-integration-log.md`.
- 1.2 and 1.3 both consume the contract from 1.1; 1.3 is testable with a mocked client but its dev proxy targets the 1.2 API.
- 1.4 needs the build outputs of 1.2 and 1.3 and the health route from 1.2 for the api HEALTHCHECK and `service_healthy` gating.
- 1.5 runs the built images from 1.4 and asserts the Empty and load-failure states from 1.3. Its `beforeEach` purge needs the delete endpoint from Epic 2, so it must tolerate an empty store until then.
- Epic 2 adds create, PATCH and DELETE routes to the API from 1.2 and write paths to the state hook from 1.3; Epic 3 reuses the E2E harness and coverage gate from 1.1 and 1.5.
