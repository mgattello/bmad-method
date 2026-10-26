---
status: final
stepsCompleted: [1, 2, 3, 4]
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-bmad-method-2026-10-26/prd.md
  - _bmad-output/planning-artifacts/prds/prd-bmad-method-2026-10-26/addendum.md
  - _bmad-output/planning-artifacts/architecture/architecture-bmad-method-2026-10-26/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/architecture/architecture-bmad-method-2026-10-26/architecture.md
---

# Todo App - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for Todo App, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

IDs mirror the PRD (FR1 here is FR-1 there). Testable consequences are condensed; the PRD remains the full source.

FR1: User can create a Todo by submitting a Description (Enter or visible submit control). Exactly one Todo is added with Completion Status Active and API-assigned Created At; it appears at the top of the Todo List within 100 ms under Normal conditions; on success the input clears and keeps focus. (UJ-1)
FR2: Description is validated on client and server: empty or whitespace-only after trimming, or over 500 characters, is rejected; no Todo created; input shows a visible, screen-reader-announced message; API returns HTTP 400 with the FR10 error body independent of the client. (UJ-1 edge case)
FR3: On load the app requests and renders every Todo (no pagination), ordered Created At descending; no onboarding screen, tour, modal, tooltip or instructional copy; each Todo shows Description and Completion Status; Created At is returned but not displayed. (UJ-1, UJ-2)
FR4: With zero Todos the Todo List region shows a short human-written Empty State inviting the first Todo; it disappears when one Todo exists and reappears when the last is deleted.
FR5: A designed Loading State (skeleton or spinner inside the Todo List region) shows until the first API response arrives; it never shows the Empty State message.
FR6: Completed Todos use at least two visual cues (for example strike-through, reduced contrast, checked control) so status does not rely on colour alone; Completion Status is exposed to assistive technology as checked state. (UJ-2)
FR7: Responsive layout: at 360 px and 1280 px all controls reachable without horizontal scroll, touch targets at least 44 x 44 px; between 320 px and 1920 px no content clipped or overlapping; text readable on phone without zoom.
FR8: User can toggle a Todo between Active and Completed, both directions; visual state flips within 100 ms under Normal conditions; change persisted (unchanged after refresh); on API failure the Todo shows its last persisted Completion Status and an Error State is shown. (UJ-2)
FR9: User can delete any Todo with one action; removed from the Todo List within 100 ms under Normal conditions; persisted (absent after refresh); on API failure the Todo remains in place and an Error State is shown; no confirmation step and no undo. (UJ-2)
FR10: HTTP API exposes list all, create, update (Completion Status and Description) and delete by ID; every Todo carries ID, Description, Completion Status, Created At; errors are JSON { code, message }, HTTP 404 for unknown ID, HTTP 400 for malformed JSON or invalid fields, never 500 for user input; the API contract is documented in the repository and kept in sync with the integration tests.
FR11: Todos survive page refresh, new browser sessions and API process restart; the frontend issues at most one in-flight write per Todo and a further action on the same Todo waits for the pending write; last write wins across tabs or devices; stale tab shows latest list after refresh; no live sync. (UJ-2)
FR12: Architecture constraint: data model and API do not prevent adding per-user ownership and authentication later; no business logic assumes exactly one list. Verified by architecture review, not an automated test.
FR13: Health Endpoint returns HTTP 200 when the API can reach the Persistence Store and non-200 otherwise; both frontend and backend containers expose a health signal the orchestrator uses for container health. (brief)
FR14: On API failure the user sees what failed and can recover: a failed list load shows an Error State with a retry control in place of the Todo List (activating it re-issues the load); a failed create, toggle or delete shows an Error State as a non-blocking, human-readable message naming the action with the list at its last persisted state; errors announced to assistive technology; no raw error strings, stack traces or HTTP status codes shown. (UJ-3)
FR15: After a failed create the input still contains the submitted Description unchanged and retains focus. (UJ-3)

### NonFunctional Requirements

NFR1: Simplicity. One screen, one input, every action one tap or click from the Todo List; smallest dependency set that meets the FRs; no framework, service or abstraction without a requirement behind it; boring, well-known technology.
NFR2: Product completeness. No placeholder copy, no unstyled browser defaults, page title set, consistent spacing and typography, no layout shift on load; Empty, Loading and Error States are designed states with human-readable copy.
NFR3: Performance. Initial Todo List render within 1 s under Normal conditions with up to 200 Todos; user actions reflected within 100 ms under Normal conditions; Lighthouse mobile performance score at least 90; performance findings documented in a performance report (brief).
NFR4: Accessibility (brief). Zero critical WCAG 2.1 AA violations by automated audit; full keyboard operation of create, toggle and delete; visible focus; Completion Status and errors exposed to screen readers.
NFR5: Security (brief). Description treated as untrusted: rendered as text never HTML; server-side validation on every write; no stored or reflected XSS; no injection into the Persistence Store; security review findings documented with remediations.
NFR6: Reliability. Persistence Store writes durable before the API reports success; API never crashes on malformed input.
NFR7: Maintainability, coverage (brief). Minimum 70% meaningful code coverage measured per package (frontend and backend each); coverage earned by asserting nothing does not count.
NFR8: Maintainability, test levels (brief). Tests at four levels: unit, frontend component, integration (every API endpoint), end-to-end; E2E covers every user journey in the stories and at minimum create, complete, delete, Empty State, error handling; minimum 5 passing Playwright tests.
NFR9: Maintainability, onboarding (brief). A new developer can run the full app and all tests from the README alone; README explains the codebase layout; the architecture document records only decisions actually made.
NFR10: Deployability (brief). Full stack starts with one compose command (docker compose up) and both containers report healthy; logs from every container readable through the orchestrator; API logs method, path, status and duration per request; dev and test configurations differ only by environment variables and compose profiles.
NFR11: Browser support. E2E and accessibility audits on current Chromium; app must not break in current Firefox or Safari.
NFR12: Graded documentation deliverables (brief, PRD §6). README with setup instructions; AI integration log maintained throughout; QA reports for coverage, accessibility, security review and performance; documentation of how BMAD guided the implementation.

### Additional Requirements

From the architecture spine (binding) and architecture document. AD-N references the spine's decisions.

- **No starter template.** The repository is scaffolded by hand per the spine's Structural Seed: npm workspaces monorepo at the repo root with `packages/contract`, `apps/api`, `apps/web`, `e2e/`; root `package.json` scripts `build`, `test`, `test:int`, `test:e2e`, `lint` fan out in dependency order (contract first); `tsconfig.base.json` (strict, erasableSyntaxOnly, verbatimModuleSyntax), ESM everywhere, no TypeScript enum. `apps/web` uses the create-vite `react-ts` tsconfig settings. This shapes Epic 1 Story 1.
- **Contract package (AD-1).** `@todo/contract` is the only definition of the API: `Todo` type, TypeBox request/response schemas, `DESCRIPTION_MAX` (500), `ErrorCode` as const object plus union, path constants `API_PREFIX`, `TODOS_PATH`, `todoPath(id)`, `HEALTH_PATH`; compiled by tsc to `dist/`; neither app declares its own Todo type or literal paths; built before either app, also inside each Dockerfile.
- **REST contract (AD-2).** `GET /api/v1/todos` 200 Todo[] (all, newest first); `POST /api/v1/todos` 201 Todo; `PATCH /api/v1/todos/:id` `{ description?, completed? }` 200 Todo, `minProperties: 1`; `DELETE /api/v1/todos/:id` 204; `GET /api/v1/health` 200 `{status:"ok"}` or 503 `{status:"degraded"}`. Todo = `{ id: UUID v4, description, completed: boolean, createdAt: ISO 8601 UTC }`. Bare JSON bodies, no envelope, no trailing slashes, `additionalProperties: false`, Ajv `removeAdditional: false`, `coerceTypes: false`. Malformed or absent id is NOT_FOUND. No other endpoints.
- **Error envelope (AD-3).** Every non-2xx Todo-route body is `{ code, message }` with code in `VALIDATION_ERROR` (400), `NOT_FOUND` (404), `INTERNAL_ERROR` (500); one Fastify `setErrorHandler` plus one `setNotFoundHandler` produce it; routes never build error bodies; schema failures, malformed JSON and unsupported content types map to 400; web client parses the envelope and treats any other non-2xx or non-JSON response (nginx 502, network failure) as INTERNAL_ERROR, never throws past its boundary; user-facing copy authored in `apps/web`, keyed by action plus code, never displays server `message`.
- **Backend layering (AD-4).** `routes/` (Fastify plugins with contract schemas) -> `service/TodoService` (all domain rules: trim, length, not-found, ordering) -> `repository/TodoRepository` interface with `SqliteTodoRepository` (SQL only) and `InMemoryTodoRepository` (unit tests only); `buildApp(deps)` in `app.ts` receives the repository; `server.ts` is the only place env is read and `listen` is called.
- **Persistence (AD-5, resolves PRD OQ1).** `better-sqlite3` on `DB_PATH` (default `/data/todos.db`, named volume `todo-data`); one connection per process; WAL journal; `synchronous = FULL`; reply only after commit; prepared statements with bound parameters only; `CREATE TABLE IF NOT EXISTS` at startup, no migration tool; api Dockerfile creates `/data` and chowns to runtime user before `USER`.
- **Validation (AD-6).** Server trims then requires 1 to `DESCRIPTION_MAX` characters, else VALIDATION_ERROR; rule in the service, route schema enforces string type only; client sends `description.trim()` and blocks submit locally only for empty-after-trim and over-max using the same constant and message mechanism; web renders description only as text content, no `dangerouslySetInnerHTML`, no markdown.
- **Frontend state (AD-7).** One list state `loading | ready | error`; `load()` on mount and on the retry control; successful writes patch the list from the returned Todo; no optimistic updates; at most one in-flight write per Todo id enforced by disabling that item's checkbox and delete button (no queuing); pending create disables the submit control; failed write leaves list at last persisted state and shows a non-blocking message naming the action; failed create keeps input text and focus; NOT_FOUND on PATCH or DELETE removes the item locally and shows the message.
- **List order (AD-8).** API returns `ORDER BY created_at DESC, rowid DESC`; `created_at` stored with millisecond precision; `completed` stored INTEGER 0/1, mapped to boolean in the repository; web renders received order, never re-sorts; new items inserted at index 0.
- **Single origin (AD-9).** nginx in the web container serves the Vite build and proxies `/api/` to `http://api:3000` (no trailing slash, no rewrite, `proxy_http_version 1.1`, `proxy_intercept_errors off`), sends `X-Content-Type-Options: nosniff` and `Content-Security-Policy: default-src 'self'`; Vite dev server proxies `/api/` to `API_PROXY_TARGET` (no `VITE_` prefix, default `http://localhost:3000`), `server.host: true`; web builds every URL from contract path constants; API enables no CORS.
- **Multi-user seam (AD-10).** No `ownerId` in v1; all repository reads and writes go through one scope-aware query path; `TodoService` gets its repository by injection; no module-level singleton list; route handlers assume nothing about ownership.
- **Operational envelope (AD-11).** api reads only `HOST` (0.0.0.0), `PORT` (3000), `DB_PATH`, `LOG_LEVEL` (info), `NODE_ENV`; pino JSON to stdout, exactly one completion line per request with method, url, statusCode, responseTime; health route runs `SELECT 1`; container health owned solely by `HEALTHCHECK` in each Dockerfile (`--interval=5s --timeout=3s --start-period=5s --retries=10`), compose declares no healthcheck and uses `depends_on: api: condition: service_healthy` on web; api check via `node -e` with global fetch against `http://127.0.0.1:3000/api/v1/health`; web check via busybox `wget` against `http://127.0.0.1:8080/healthz` static 200 location; both images multi-stage and non-root (api `node`, web `nginx-unprivileged` on 8080).
- **Compose shape (AD-11).** Unprofiled `api` and `web` are the built images run by bare `docker compose up`; host publishes web on `${WEB_PORT:-8080}` only; `dev` profile adds `api-dev` (publishes 3000, `tsx watch` plus contract `tsc --watch`) and `web-dev` (publishes 5173, `API_PROXY_TARGET=http://api-dev:3000`), both mounting the repo at `/app` with anonymous volumes over every `node_modules`, running `npm ci` then the workspace `dev` script on start; `.env.example` documents every variable.
- **E2E lifecycle (AD-11, AD-12).** E2E and CI run the unprofiled stack under compose project `todo-e2e` with `WEB_PORT=8081`; `test:e2e` script owns `down -v`, `up --build --wait`, Playwright with `baseURL http://localhost:8081`, `down -v`; Playwright declares no `webServer`, `workers: 1`, `beforeEach` purges via the API (list then delete each), API failures simulated via `page.route` interception; no test endpoint in the API.
- **Test homes (AD-12).** Unit api `apps/api/src/**/*.test.ts` (Vitest, TodoService vs InMemoryTodoRepository); unit web `apps/web/src/**/*.test.tsx` (Vitest, jsdom, Testing Library, api client mocked); integration `apps/api/test/*.int.test.ts` (Vitest, `fastify.inject`, buildApp with SqliteTodoRepository on a temp file per test file, one spec per endpoint); E2E `e2e/*.spec.ts`. Vitest sets `LOG_LEVEL=silent`. Coverage `@vitest/coverage-v8`, 70% lines and branches per app, enforced by root `test` script. 200-item figure is the performance fixture size.
- **Container build recipe (AD-13).** Build context is the repo root (`build: { context: ., dockerfile: apps/<app>/Dockerfile }`); root `.dockerignore` excludes `node_modules`, `dist`, `_bmad*`, `docs`, `e2e`, `.git`; stage `deps` copies root and workspace `package.json` files plus lockfile and runs full `npm ci` on `node:24-alpine` with `python3 make g++` in that stage only; stage `build` builds contract then app and runs `npm prune --omit=dev`; api runtime copies `/app` keeping workspace layout so the `@todo/contract` symlink resolves, never runs npm, `USER node`, `CMD ["node", "apps/api/dist/server.js"]`; web runtime `nginxinc/nginx-unprivileged:1.30-alpine` copies `apps/web/dist` to `/usr/share/nginx/html` and `apps/web/nginx.conf` to `/etc/nginx/conf.d/default.conf` as a `server {}` block only.
- **Conventions.** JSON camelCase, SQL snake_case mapped in repository; files kebab-case; components and types PascalCase; `id` from `crypto.randomUUID()` in the service; one Fastify plugin per resource; ESLint 10 flat config with typescript-eslint and eslint-plugin-react-hooks plus Prettier, one root config each, `lint` runs both; npm workspaces with one root lockfile; styling is plain CSS modules per component with one `tokens.css`, mobile-first, single breakpoint, no CSS framework; `@types/node` tracks the 24 line.
- **Pinned stack.** Node 24.22.1 (`node:24-alpine`), TypeScript 6.0.3, tsx 4.23.15, Fastify 5.12.7, typebox 1.4.3, ajv-formats 3.0.1, @fastify/type-provider-typebox 6.3.0, @fastify/sensible 6.0.7, better-sqlite3 13.0.3, React 19.3.1, Vite 8.3.5, @vitejs/plugin-react 6.1.2, Vitest 5.0.5, @vitest/coverage-v8 5.0.5, jsdom 30.1.3, @testing-library/react 16.3.3, @playwright/test 1.64.1, concurrently 10.0.6, ESLint 10.13.0, Prettier 3.9.10, Docker Compose v2.
- **Documentation homes.** `README.md` (setup, layout, commands); `docs/architecture.md` (copy of the readable architecture at project setup); `docs/ai-integration-log.md`; `docs/qa/coverage.md`, `docs/qa/accessibility.md`, `docs/qa/security.md`, `docs/qa/performance.md`.
- **Deferred by architecture (do not build).** Postgres, users and auth, migrations tool, pagination, filtering, sorting, clear completed, undo, UI Description editing, displaying createdAt, prod profile, TLS, CI provider choice, rate limiting. QA tooling (Lighthouse vs axe, Playwright MCP, Postman MCP, Chrome DevTools MCP) is chosen in the setup and QA stories and recorded in the AI integration log.

### UX Design Requirements

No UX design contract exists (no `ux-designs/` run, no legacy UX document). UX-relevant requirements come from PRD FR3 to FR7, FR14, NFR2, NFR4 and the architecture's Accessibility and Styling conventions. Extracted so stories can carry them:

UX-DR1: Component set per architecture: `TodoInput`, `TodoList`, `TodoItem`, `EmptyState`, `LoadingState`, `ErrorBanner`, composed under `App`.
UX-DR2: Each Todo is a list item with a labelled checkbox (Completion Status) and a labelled delete button; full keyboard path for create, toggle, delete; visible focus.
UX-DR3: Exactly one live region, `role="status"`, rendered by `ErrorBanner`, announces API failures and the Description validation message; `TodoInput` sets `aria-invalid` and `aria-describedby` pointing at it.
UX-DR4: Design tokens in one `tokens.css` (spacing, colour, type scale); plain CSS modules per component; mobile-first, single breakpoint; no CSS framework.
UX-DR5: Completed Todo styling uses at least two cues (strike-through, reduced contrast, checked control), colour not the sole cue (FR6).
UX-DR6: Designed Empty, Loading and Error States with human-written copy; page title set; no unstyled defaults; no layout shift on load (NFR2).
UX-DR7: Pending write disables that Todo's checkbox and delete button; pending create disables the submit control (AD-7).
UX-DR8: Responsive bounds: usable at 360 px and 1280 px, no clipping or overlap 320 px to 1920 px, touch targets at least 44 x 44 px, readable without zoom (FR7).

### FR Coverage Map

FR1: Epic 2 - Create a Todo from the input
FR2: Epic 2 - Validate Description on client and server
FR3: Epic 1 - Load and render the Todo List newest first, no onboarding
FR4: Epic 1 - Empty State
FR5: Epic 1 - Loading State
FR6: Epic 2 - Completed Todos visually distinct and exposed to AT
FR7: Epic 2 - Responsive layout bounds
FR8: Epic 2 - Toggle Completion Status both ways
FR9: Epic 2 - Delete a Todo immediately
FR10: Epic 1 (list, health, error envelope, contract docs) + Epic 2 (create, patch, delete) - CRUD API
FR11: Epic 1 (durable SQLite store, restart survival) + Epic 2 (one in-flight write per Todo) - Durable persistence
FR12: Epic 1 - Multi-user seam, verified by architecture review
FR13: Epic 1 - Health Endpoint and container health
FR14: Epic 1 (load failure Error State with retry) + Epic 2 (write failure messages) - Error State on failure
FR15: Epic 2 - Never lose typed input

## Epic List

### Epic 1: A running Todo app you can open
`docker compose up` brings up a healthy two-container stack; the user opens it and sees the Todo List, Loading State, Empty State, or a load Error State with retry. Foundation: monorepo scaffold (no starter template), contract package, API with list and health on SQLite, web shell with the `loading | ready | error` state machine, Dockerfiles, compose, four-level test infrastructure, README skeleton.
**FRs covered:** FR3, FR4, FR5, FR10 (list, health, error envelope), FR11 (durable store), FR12, FR13, FR14 (load failure and retry)

### Epic 2: Capture, complete and clear Todos
The user creates, ticks, unticks and deletes Todos; each action persists, is validated, handles failure without losing work, is keyboard and screen-reader usable, and works on phone and desktop.
**FRs covered:** FR1, FR2, FR6, FR7, FR8, FR9, FR10 (create, patch, delete), FR11 (one in-flight write), FR14 (write failures), FR15

### Epic 3: Prove it: quality gates and graded deliverables
Learner and grader can verify the brief's criteria: full E2E journey coverage (minimum 5 specs), coverage gate 70% per package, accessibility audit with zero critical violations, security review, performance report with Lighthouse mobile 90 or above, AI integration log, documentation of how BMAD guided the build, final README.
**FRs covered:** none new; validates FR1 to FR15. Driven by NFR3, NFR4, NFR5, NFR7, NFR8, NFR9, NFR11, NFR12.

Dependencies: Epic 2 builds on Epic 1; Epic 3 builds on Epics 1 and 2. Tests are written inside each story (QA from day one); Epic 3 holds audits, reports and journey-level E2E, not first tests.

## Epic 1: A running Todo app you can open

`docker compose up` brings up a healthy two-container stack; the user opens it and sees the Todo List, Loading State, Empty State, or a load Error State with retry. Foundation for everything else: monorepo scaffold, contract package, API with list and health on SQLite, web shell with the `loading | ready | error` state machine, Dockerfiles, compose, four-level test infrastructure, README skeleton.

### Story 1.1: Scaffold the workspace and the API contract package

As a developer,
I want the monorepo skeleton with `@todo/contract` built and lint, format and test commands wired,
So that every later story builds on one shared contract and runs tests from day one.

**Acceptance Criteria:**

**Given** a clean checkout
**When** I run `npm ci && npm run build`
**Then** `packages/contract` compiles to `dist/` before `apps/api` and `apps/web`
**And** it exports `Todo`, TypeBox request and response schemas, `DESCRIPTION_MAX = 500`, `ErrorCode` (as const object plus union type, no enum), `API_PREFIX`, `TODOS_PATH`, `todoPath(id)`, `HEALTH_PATH`.

**Given** the workspace
**When** I run `npm run lint`
**Then** ESLint 10 flat config (typescript-eslint, eslint-plugin-react-hooks) and Prettier run from one root config each and pass.

**Given** the workspace
**When** I run `npm test`
**Then** Vitest runs in `apps/api` and `apps/web` with `@vitest/coverage-v8` gated at 70% lines and branches per app and `LOG_LEVEL=silent`
**And** a contract schema test passes: a valid Todo is accepted, an unknown field is rejected, an empty PATCH body is rejected.

**Given** the repo root
**When** the story is complete
**Then** `tsconfig.base.json` (strict, erasableSyntaxOnly, verbatimModuleSyntax), ESM `"type": "module"`, `.env.example`, `.dockerignore`, a `README.md` skeleton and `docs/architecture.md` (copied from the readable architecture) exist
**And** every dependency matches the pinned versions in the architecture spine's Stack table.

**Given** `docs/ai-integration-log.md`
**When** this story is complete
**Then** the log exists with an entry for Story 1.1
**And** every later story appends its own entry as part of its definition of done (NFR12).

### Story 1.2: API lists Todos from a durable SQLite store and reports health

As a user of the API,
I want `GET /api/v1/todos` to return every Todo newest first from a file that survives restarts, and `GET /api/v1/health` to report whether the store is reachable,
So that the app has a trustworthy source of truth.

**Acceptance Criteria:**

**Given** the API is started with `DB_PATH` pointing at a file that does not exist
**When** the process starts
**Then** the table is created idempotently (`CREATE TABLE IF NOT EXISTS`)
**And** `GET /api/v1/todos` returns `200 []`.

**Given** Todos exist in the store
**When** I call `GET /api/v1/todos`
**Then** all are returned ordered `created_at DESC, rowid DESC`, `completed` as a boolean, fields `id`, `description`, `completed`, `createdAt`, bare JSON with no envelope
**And** restarting the API process with the same file returns the same list (FR11).

**Given** any unknown route
**When** it is requested
**Then** the response is `404 { code: "NOT_FOUND", message }`
**And** an unexpected error yields `500 { code: "INTERNAL_ERROR" }` with a generic message
**And** routes never build error bodies; one `setErrorHandler` and one `setNotFoundHandler` produce every envelope.

**Given** the store is reachable
**When** I call `GET /api/v1/health`
**Then** the response is `200 { status: "ok" }` after a successful `SELECT 1`
**And** when the store is not reachable the response is `503 { status: "degraded" }` (FR13).

**Given** the backend layering
**When** the code is reviewed
**Then** `routes -> TodoService -> TodoRepository` holds, with `SqliteTodoRepository` (prepared statements with bound parameters only, WAL journal, `synchronous = FULL`, one connection per process) and `InMemoryTodoRepository` for unit tests
**And** `buildApp(deps)` receives the repository, `server.ts` alone reads `HOST`, `PORT`, `DB_PATH`, `LOG_LEVEL`, `NODE_ENV` and calls `listen`
**And** all repository reads and writes go through one scope-aware query path and nothing holds a module-level list (FR12).

**Given** any request
**When** it completes
**Then** exactly one pino JSON line is logged with `method`, `url`, `statusCode`, `responseTime`.

**Given** the test suites
**When** `npm test` and `npm run test:int` run
**Then** unit tests cover `TodoService.list` ordering against the in-memory repository
**And** integration tests (`fastify.inject`, temp SQLite file per test file) cover list, health and the unknown-route envelope.

### Story 1.3: Web shell shows the Todo List with Loading, Empty and Error States

As Dana,
I want to open the app and immediately see my Todos, a Loading State while they load, an Empty State when there are none, or an Error State with retry if loading fails,
So that I always know where I stand without any onboarding.

**Acceptance Criteria:**

**Given** the app mounts
**When** the first list request is in flight
**Then** a designed Loading State (skeleton or spinner inside the Todo List region) is shown
**And** the Empty State message is never shown during loading (FR5).

**Given** the API returns zero Todos
**When** the list renders
**Then** a short, human-written Empty State invites the user to add the first Todo (FR4).

**Given** the API returns Todos
**When** the list renders
**Then** each Todo is a list item with a labelled checkbox reflecting its Completion Status and its Description rendered as text content only, in received order with no client-side re-sort
**And** no onboarding screen, tour, modal, tooltip sequence or instructional copy appears (FR3).

**Given** the list load fails with an error envelope, a non-JSON response, a 502 or a network failure
**When** the failure is handled
**Then** an Error State with a retry control replaces the Todo List, with user-facing copy authored in the web keyed by action and code and never showing the server `message`
**And** activating the retry control re-issues the load (FR14)
**And** the failure is announced through the single `role="status"` live region rendered by `ErrorBanner`.

**Given** the implementation
**When** the code is reviewed
**Then** `todos-client.ts` builds every URL from contract path constants and never throws past its boundary, `use-todos.ts` holds one `loading | ready | error` state, `vite.config.ts` proxies `/api/` from `API_PROXY_TARGET` (default `http://localhost:3000`) with `server.host: true`
**And** styling is CSS modules per component plus one `tokens.css`, mobile-first, no CSS framework; the page `<title>` is set; no unstyled browser defaults; no layout shift on load (NFR1, NFR2, UX-DR4, UX-DR6)
**And** the component set is `TodoInput`, `TodoList`, `TodoItem`, `EmptyState`, `LoadingState`, `ErrorBanner` composed under `App` (UX-DR1).

**Given** component tests with the api client mocked
**When** `npm test` runs
**Then** Loading, Empty, populated and load-error-with-retry render paths are covered.

### Story 1.4: Run the whole stack with docker compose up

As the DevOps engineer,
I want both services containerised and orchestrated with health checks,
So that one command starts a healthy app at `http://localhost:8080` and data survives restarts.

**Acceptance Criteria:**

**Given** the repository
**When** I run `docker compose up`
**Then** `api` and `web` build from the repo root per AD-13 (stages `deps`, `build`, `runtime`; `npm prune --omit=dev`; no `npm` at runtime; root `.dockerignore` excludes `node_modules`, `dist`, `_bmad*`, `docs`, `e2e`, `.git`)
**And** both run non-root (api as `node`, web as the `nginx-unprivileged` user on 8080)
**And** `web` starts only after `api` is healthy via `depends_on: { api: { condition: service_healthy } }` (NFR10).

**Given** the stack is up
**When** I open `http://localhost:${WEB_PORT:-8080}`
**Then** the app is served, nginx proxies `/api/` to `http://api:3000` unchanged (no rewrite, `proxy_http_version 1.1`, `proxy_intercept_errors off`), sends `X-Content-Type-Options: nosniff` and `Content-Security-Policy: default-src 'self'`, and serves `/healthz` with 200
**And** the API enables no CORS.

**Given** each Dockerfile
**When** the image runs
**Then** it owns the only `HEALTHCHECK` with `--interval=5s --timeout=3s --start-period=5s --retries=10`: api via `node -e` using global `fetch` against `http://127.0.0.1:3000/api/v1/health`, web via busybox `wget -qO- http://127.0.0.1:8080/healthz`
**And** compose declares no `healthcheck:` block (FR13).

**Given** Todos were written
**When** `docker compose restart` runs
**Then** the list is unchanged because `/data/todos.db` lives on the named volume `todo-data` with `/data` chowned to `node` before `USER`
**And** only `docker compose down -v` loses data (FR11).

**Given** the stack is running
**When** I run `docker compose logs`
**Then** one JSON line per API request is visible.

**Given** `docker compose --profile dev up`
**When** the dev services start
**Then** `api-dev` publishes 3000 and runs `tsx watch` plus contract `tsc --watch`, `web-dev` publishes 5173 with `API_PROXY_TARGET=http://api-dev:3000`, both mount the repo at `/app` with anonymous volumes over every `node_modules` and run `npm ci` then the workspace `dev` script
**And** `.env.example` documents `HOST`, `PORT`, `DB_PATH`, `LOG_LEVEL`, `NODE_ENV`, `API_PROXY_TARGET`, `WEB_PORT`.

### Story 1.5: E2E harness proves the empty and failed-load journeys against the built images

As the QA engineer,
I want a Playwright harness that runs the shipped containers in isolation,
So that every later journey test exercises the real stack.

**Acceptance Criteria:**

**Given** the repository
**When** I run `npm run test:e2e`
**Then** it runs `docker compose -p todo-e2e down -v`, then `up --build --wait` with `WEB_PORT=8081`, then Playwright with `baseURL http://localhost:8081`, `workers: 1` and no `webServer`, then `down -v`.

**Given** each spec
**When** it starts
**Then** `beforeEach` purges Todos through the API (list, then delete each), tolerating an empty list so no forward dependency on the delete endpoint exists.

**Given** the empty-state spec
**When** the page loads against an empty store
**Then** the Empty State text is visible and the Loading State is gone.

**Given** the load-failure spec intercepts `GET /api/v1/todos` with `page.route` and fails it
**When** the page loads
**Then** the Error State and retry control are visible and `getByRole("status")` carries the message
**And** after removing the route and activating retry, the Empty State shows.

**Given** the README
**When** a new developer reads it
**Then** setup, codebase layout and the commands `build`, `test`, `test:int`, `test:e2e`, `lint`, `docker compose up` and `docker compose --profile dev up` let them run the app and all tests with no other source (NFR9).

## Epic 2: Capture, complete and clear Todos

The user creates, ticks, unticks and deletes Todos; each action persists, is validated, handles failure without losing work, is keyboard and screen-reader usable, and works on phone and desktop.

### Story 2.1: Create a Todo through the API

As a user of the API,
I want `POST /api/v1/todos` to create a validated Todo,
So that tasks are stored durably with server-assigned identity and time.

**Acceptance Criteria:**

**Given** a body `{ description }` that is valid after trimming
**When** it is posted
**Then** the response is `201` with a Todo whose `id` is a UUID v4 from `crypto.randomUUID()` in the service, `description` is the trimmed value, `completed` is `false`, and `createdAt` is ISO 8601 UTC with millisecond precision
**And** the reply is sent only after the SQLite statement has committed (NFR6).

**Given** a description that is empty or whitespace-only after trimming, or longer than `DESCRIPTION_MAX`
**When** it is posted
**Then** the response is `400 { code: "VALIDATION_ERROR", message }` produced by the service rule
**And** the route schema enforces string type only (AD-6).

**Given** malformed JSON, an unsupported content type, an unknown field, or a non-string description
**When** it is posted
**Then** the response is `400 VALIDATION_ERROR`
**And** the API never returns 500 for user input (FR10).

**Given** a Todo was created
**When** I call `GET /api/v1/todos`
**Then** the new Todo is first.

**Given** the test suites
**When** they run
**Then** unit tests cover trim, length bounds, id and createdAt assignment against the in-memory repository
**And** integration tests cover 201, each 400 case, and list ordering after two creates.

### Story 2.2: Add a Todo from the input

As Dana,
I want to type a task and press Enter or tap the submit control,
So that it appears at the top of my list at once and I can keep going.

**Acceptance Criteria:**

**Given** the app is in the ready state
**When** I submit a valid Description
**Then** the client sends `description.trim()`, inserts the returned Todo at index 0, clears the input and keeps focus, within 100 ms under Normal conditions (FR1).

**Given** a create request is pending
**When** I try to submit again
**Then** the submit control is disabled and no second create is queued (FR11, UX-DR7).

**Given** the Description is empty after trimming or longer than `DESCRIPTION_MAX`
**When** I submit
**Then** no request is sent, a visible message is shown through the `role="status"` region, and the input carries `aria-invalid` and `aria-describedby` pointing at it (FR2, UX-DR3)
**And** a server `VALIDATION_ERROR` uses the same constant and the same message mechanism.

**Given** the API fails with an error envelope, a 502 or a network failure
**When** the failure is handled
**Then** the Todo List stays at its last persisted state, a non-blocking message names the action, and the input keeps the submitted text and focus (FR14, FR15).

**Given** keyboard-only use
**When** I press Enter or activate the visible submit control
**Then** both submit the Todo and focus is visible throughout.

**Given** the test suites
**When** they run
**Then** component tests cover successful insert, pending-disabled, client validation, server validation and failure keeping text
**And** E2E specs `create` and `validation` pass against the built images (UJ-1 including its edge case).

### Story 2.3: Tick and untick a Todo

As Dana,
I want to mark a Todo done or back to open from its checkbox and see it change instantly,
So that I can track what is left.

**Acceptance Criteria:**

**Given** an existing Todo
**When** `PATCH /api/v1/todos/:id` carries `{ completed }`, `{ description }` or both
**Then** the response is `200` with the updated Todo
**And** `{}` or unknown fields are `400 VALIDATION_ERROR` (`minProperties: 1`, `additionalProperties: false`), a malformed or unknown id is `404 NOT_FOUND`, and the description rules from Story 2.1 apply (FR10, FR8 both directions).

**Given** I activate a Todo's checkbox
**When** the request succeeds
**Then** the client patches `{ completed }` and replaces the item from the response within 100 ms under Normal conditions, with no optimistic update (AD-7).

**Given** a write is pending on that Todo
**When** I try another action on it
**Then** its checkbox and delete button are disabled and nothing is queued (FR11).

**Given** the API fails
**When** the failure is handled
**Then** the Todo shows its last persisted Completion Status and a message names the action (FR14)
**And** on `NOT_FOUND` the item is removed locally and the message is shown.

**Given** a Completed Todo
**When** it renders
**Then** at least two visual cues apply (strike-through, reduced contrast, checked control), colour is never the only cue, and the checked state is exposed to assistive technology (FR6, UX-DR5).

**Given** a Todo was ticked or unticked
**When** the page is refreshed
**Then** its Completion Status is unchanged.

**Given** the test suites
**When** they run
**Then** unit tests cover service update and not-found, integration tests cover 200, each 400 case, 404 and both fields together, component tests cover toggle, pending, failure and not-found
**And** an E2E `complete` spec covers tick, untick and refresh.

### Story 2.4: Delete a Todo and publish the API contract

As Dana,
I want to remove a Todo with one tap and have it gone for good,
So that my list only holds what matters.

**Acceptance Criteria:**

**Given** an existing Todo
**When** `DELETE /api/v1/todos/:id` is called
**Then** the response is `204` with an empty body
**And** a malformed or unknown id returns `404 NOT_FOUND` (FR10).

**Given** I activate a Todo's labelled delete button
**When** the request succeeds
**Then** the item is removed from the Todo List within 100 ms under Normal conditions, with no confirmation step and no undo (FR9).

**Given** a write is pending on that Todo
**When** I try another action on it
**Then** its checkbox and delete button are disabled (FR11).

**Given** the API fails
**When** the failure is handled
**Then** the Todo remains in its previous position and a message names the action (FR14)
**And** on `NOT_FOUND` the item is removed locally and the message is shown.

**Given** the last Todo is deleted
**When** the list updates
**Then** the Empty State reappears (FR4).

**Given** the API contract is now complete
**When** the story is done
**Then** it is documented in the repository (README or `docs/`) covering paths, verbs, request and response bodies, status codes and error codes
**And** the integration suite has one spec per endpoint matching that document (FR10).

**Given** the test suites
**When** they run
**Then** unit tests cover service delete and not-found, integration tests cover 204 and 404, component tests cover remove, pending, failure, not-found and return to Empty State
**And** an E2E `delete` spec passes and the harness `beforeEach` purge now exercises the real endpoint.

### Story 2.5: Keyboard, screen reader and small-screen fit

As Dana on her phone, and as a keyboard-only user,
I want every action reachable and understandable without a mouse or a wide screen,
So that the app works wherever I am.

**Acceptance Criteria:**

**Given** keyboard-only use
**When** I move through the app
**Then** create, tick, untick and delete are all reachable in a sensible tab order with visible focus (NFR4, UX-DR2).

**Given** a screen reader
**When** it reads the page
**Then** each Todo is a list item with a labelled checkbox and a labelled delete button
**And** errors and validation messages are announced through the single `role="status"` live region (UX-DR3).

**Given** viewports of 360 px and 1280 px
**When** the app renders
**Then** all controls are reachable without horizontal scrolling and touch targets are at least 44 x 44 px
**And** between 320 px and 1920 px no content is clipped or overlaps and text is readable on a phone without zooming (FR7, UX-DR8).

**Given** the write-failure journey (UJ-3)
**When** an E2E `error-handling` spec uses `page.route` to fail a create
**Then** the message is present in `getByRole("status")`, the input keeps its text and focus, and after removing the route the create succeeds (FR14, FR15).

**Given** the test suites
**When** they run
**Then** component tests cover labels and roles
**And** E2E runs the main journey at a 360 px viewport and asserts no horizontal overflow
**And** `tokens.css` holds the single breakpoint.

## Epic 3: Prove it: quality gates and graded deliverables

Learner and grader can verify the brief's criteria: full E2E journey coverage, coverage gate 70% per package, accessibility audit with zero critical violations, security review, performance report, AI integration log, documentation of how BMAD guided the build, final README.

### Story 3.1: Coverage gate and gap analysis

As the QA engineer,
I want coverage measured per package with gaps closed by meaningful tests,
So that the 70% gate is real, not gamed.

**Acceptance Criteria:**

**Given** the root `npm test` script
**When** it runs
**Then** `@vitest/coverage-v8` reports lines and branches per app
**And** the run fails if either app is below 70% on either measure (NFR7).

**Given** the coverage report
**When** gaps are analysed with AI assistance
**Then** new tests target untested behaviour (branches in service rules, client envelope handling, state transitions)
**And** each added test fails on a plausible regression (SM-C2).

**Given** `docs/qa/coverage.md`
**When** the story is done
**Then** it records before and after numbers per app, the gaps found, what was added, and what was deliberately left untested and why.

### Story 3.2: Accessibility audit with zero critical violations

As a keyboard and screen-reader user,
I want the app audited and fixed against WCAG AA,
So that nothing blocks me.

**Acceptance Criteria:**

**Given** an automated audit (axe-core through Playwright, or Lighthouse)
**When** it runs on the Empty, populated, Completed, validation-error and load-error states at 360 px and 1280 px
**Then** zero critical violations are reported (NFR4)
**And** serious or moderate findings are fixed or documented with a reason.

**Given** the audit is part of `npm run test:e2e`
**When** a critical violation appears
**Then** the suite fails.

**Given** manual checks
**When** performed
**Then** the full keyboard path and screen-reader announcements are confirmed
**And** a manual smoke on current Firefox and Safari passes (NFR11).

**Given** `docs/qa/accessibility.md`
**When** the story is done
**Then** the tool, states audited, findings and remediations are recorded.

### Story 3.3: Performance report against the 200-item fixture

As Dana,
I want the app to stay instant with a long list,
So that it never feels sluggish.

**Acceptance Criteria:**

**Given** a 200-Todo fixture loaded through the API
**When** the app renders and I create, tick and delete
**Then** initial render completes within 1 s under Normal conditions and each action reflects within 100 ms (NFR3, SM-4), asserted in E2E with a generous upper bound and backed by one manual check.

**Given** Lighthouse on the mobile preset against the built images
**When** it runs
**Then** the performance score is 90 or above.

**Given** Chrome DevTools MCP analysis
**When** it runs
**Then** findings (layout shift, bundle size, long tasks) are documented and any fix is applied.

**Given** `docs/qa/performance.md`
**When** the story is done
**Then** numbers, method and issues are recorded.

### Story 3.4: Security review and remediation

As the product owner,
I want the code reviewed for common web vulnerabilities,
So that untrusted Descriptions cannot harm anyone.

**Acceptance Criteria:**

**Given** an AI-assisted review of `apps/api` and `apps/web`
**When** it runs
**Then** XSS (text-only rendering, no `dangerouslySetInnerHTML`), injection (prepared statements only), CSP and `nosniff` headers, non-root containers, no secrets in images or env examples, and a dependency audit (`npm audit`) are each checked with evidence (NFR5).

**Given** a Description containing HTML or script
**When** it is created and rendered
**Then** it appears as literal text
**And** an integration test and an E2E assertion prove it.

**Given** `docs/qa/security.md`
**When** the story is done
**Then** findings, severity, remediations and accepted risks are recorded.

### Story 3.5: Journey coverage and unguided walkthrough

As the grader,
I want every user journey proven end to end and one real person to use the app unprompted,
So that SM-1 and SM-2 are evidenced.

**Acceptance Criteria:**

**Given** the E2E suite
**When** it runs
**Then** UJ-1 (phone viewport, four creates, empty-line edge case), UJ-2 (second browser context, tick, untick, delete, refresh, same list) and UJ-3 (API down, text kept, success after recovery) each map to a named spec
**And** at least 5 specs pass (NFR8).

**Given** a restart journey
**When** an E2E or integration test writes Todos, restarts the api container or process, and reads the list
**Then** the same list is returned (SM-2).

**Given** one recorded unguided walkthrough by a person who has not seen the app
**When** they use it
**Then** they complete create, tick, untick and delete with zero prompts and ask what no control does
**And** the record lives in `docs/qa/walkthrough.md` (SM-1).

### Story 3.6: Final documentation and BMAD process record

As the learner,
I want the graded documents complete,
So that the submission is self-explanatory.

**Acceptance Criteria:**

**Given** `README.md`
**When** verified by a clean-checkout run
**Then** setup, layout, every command, compose profiles, env vars, the API contract pointer and QA report links are current (NFR9).

**Given** `docs/ai-integration-log.md`
**When** reviewed
**Then** it has an entry per story covering agent usage and prompts, MCP servers used, AI-generated tests and what they missed, AI-assisted debugging, limitations and where human judgement was needed (NFR12).

**Given** `docs/bmad-process.md`
**When** reviewed
**Then** it explains how the PRD, architecture spine and epics guided the build, with links to the artefacts.

**Given** the framework comparison
**When** the story is done
**Then** a stub exists with the expectation confirmed with course staff or marked as unresolved (addendum D).

**Given** the project brief
**When** the deliverables are listed
**Then** it is recorded as a separate pending deliverable, not claimed by this repository.
