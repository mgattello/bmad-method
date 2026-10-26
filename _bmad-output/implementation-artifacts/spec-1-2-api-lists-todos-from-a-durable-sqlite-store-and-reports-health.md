---
title: 'Story 1.2: API lists Todos from a durable SQLite store and reports health'
type: 'feature'
created: '2026-10-26'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '755baec7ba3448aece0ce1e30b2565dd8aedbed2'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-bmad-method-2026-10-26/ARCHITECTURE-SPINE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `apps/api` is a compiling placeholder. The web shell (1.3), the compose stack (1.4) and the E2E harness (1.5) all need a real API that lists Todos from a file that survives restarts and reports whether that file is reachable.

**Approach:** Replace the placeholder with the layered Fastify app from the spine: `buildApp(deps)` with one error handler and one not-found handler, `routes/todos.ts` (`GET /api/v1/todos`) and `routes/health.ts`, `TodoService`, the `TodoRepository` port with `SqliteTodoRepository` (better-sqlite3, WAL, `synchronous = FULL`) and `InMemoryTodoRepository`, and `server.ts` as the only env reader. Unit and integration suites prove ordering, persistence across restart, health and the error envelope.

## Boundaries & Constraints

**Always:** Pins from the spine's Stack table: fastify 5.12.7, @fastify/type-provider-typebox 6.3.0, typebox 1.4.3, ajv-formats 3.0.1, better-sqlite3 13.0.3, @types/better-sqlite3 9.6.0, tsx 4.23.15. Paths and schemas come only from `@todo/contract`. `routes -> TodoService -> TodoRepository`, downward only; `TodoService` is the only caller of the repository (health reaches the store through `TodoService.ping()`). SQL lives only in `SqliteTodoRepository`, as prepared statements with bound parameters, every statement built from one private scope helper (the owner seam). `buildApp` sets Ajv `coerceTypes: false`, `removeAdditional: false`, disables Fastify's default request logging and emits exactly one `info` completion line per request with `method`, `url`, `statusCode`, `responseTime`. `server.ts` alone reads `HOST`, `PORT`, `DB_PATH`, `LOG_LEVEL`, `NODE_ENV`; `buildApp` reads no env. Error handler maps status 404 to `NOT_FOUND`, any other 4xx to `400 VALIDATION_ERROR`, everything else to `500 INTERNAL_ERROR` with a generic message, logs the original error at `error` level for 5xx, and never forwards a library message. Health is the only non-envelope error body (`503 { status: "degraded" }`). Coverage stays at or above 70% lines and branches for `apps/api`.

**Never:** No create, PATCH or DELETE routes (Epic 2), though the error handler already covers validation failures. No `@fastify/sensible`, no CORS, no migration tool, no `ownerId` column, no module-level list or singleton database. No Dockerfile or compose changes (1.4). No web changes (1.3). Do not edit `packages/contract`. Do not touch existing entries in `docs/ai-integration-log.md`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Fresh store | `DB_PATH` file absent, `GET /api/v1/todos` | table created idempotently on open; `200 []` | N/A |
| Ordering | rows with `created_at` `T2`, `T1`, `T1` (the two `T1` inserted in that order) | `[T2, second T1, first T1]`; `completed` boolean; fields exactly `id, description, completed, createdAt`; bare JSON array | N/A |
| Restart | build app on file F, read, close; build a new app on F | same list, same order | N/A |
| Unknown route | `GET /api/v1/nope`, `GET /api/v1/todos/` | `404 { code: "NOT_FOUND", message }` | not-found handler |
| Store failure | connection closed, `GET /api/v1/todos` | `500 { code: "INTERNAL_ERROR", message: "Unexpected error" }`, no stack or library text in body | error handler, error logged |
| Health ok | store open, `GET /api/v1/health` | `200 { status: "ok" }` after `SELECT 1` | N/A |
| Health degraded | connection closed | `503 { status: "degraded" }` | route catches the ping failure |
| Request log | any completed request | exactly one JSON line with `method`, `url`, `statusCode`, `responseTime`; none when `logger: false` | N/A |

</frozen-after-approval>

## Code Map

- `apps/api/src/server.ts`, `apps/api/src/server.test.ts` -- placeholder entry and smoke test; delete the test, rewrite the entry.
- `apps/api/package.json` -- add deps and devDeps above, `dev: "tsx watch src/server.ts"`, drop `--passWithNoTests` from `test:int` (deferred item from 1.1).
- `apps/api/tsconfig.json` (`src` only, tests excluded), `apps/api/tsconfig.test.json` (already includes `test/**/*.ts`), `apps/api/vitest.config.ts` (unit, `src/**/*.test.ts`, coverage include `src/**/*.ts`, thresholds 70/70), `apps/api/vitest.int.config.ts` (`test/**/*.int.test.ts`) -- reuse; the only config edit is `coverage.exclude: ['src/server.ts']` because the entry point only wires env and `listen`.
- `packages/contract/src/*.ts` -- `TODOS_PATH`, `HEALTH_PATH`, `TodoListSchema`, `HealthBodySchema`, `ErrorBodySchema`, `ErrorCode`, `Todo`. Import from `@todo/contract` only.
- Probe facts (scratchpad, Node 24.18): better-sqlite3 13.0.3 ships `prebuilds/darwin-arm64.node` and `linuxmusl-*` (no install script, no toolchain); Fastify 5 `inject` works with TypeBox response schemas; a closed better-sqlite3 connection throws `The database connection is not open`; Fastify's default 404 body is `{ message, error, statusCode }` and must be replaced.
- `docs/ai-integration-log.md` (append a Story 1.2 entry in the 1.1 format), `README.md` (Commands and Layout rows for api, a "Run the API locally" note), `apps/api/test/README.md` (describe the three specs).
- `_bmad-output/implementation-artifacts/deferred-work.md` -- read-only; the `--passWithNoTests` entry is resolved here.

## Tasks & Acceptance

**Execution:**
- [x] `apps/api/package.json` -- deps `fastify`, `@fastify/type-provider-typebox`, `typebox`, `ajv-formats`, `better-sqlite3`, `@todo/contract`; devDeps `@types/better-sqlite3`, `tsx`; scripts `dev`, `test:int` without `--passWithNoTests`; description updated -- runtime stack per spine, deferred item closed.
- [x] `apps/api/src/repository/todo-repository.ts` -- `interface TodoRepository { list(): Todo[]; ping(): void; close(): void }`; `list` returns newest first (`createdAt` desc, insertion desc); `ping` throws when the store is unreachable -- the port (AD-4, AD-10).
- [x] `apps/api/src/repository/sqlite-todo-repository.ts` -- `openDatabase(path)` applies `journal_mode = WAL`, `synchronous = FULL`, runs `CREATE TABLE IF NOT EXISTS todos (id TEXT PRIMARY KEY, description TEXT NOT NULL, completed INTEGER NOT NULL CHECK (completed IN (0, 1)), created_at TEXT NOT NULL)`; class holds prepared statements built through one private scope helper; maps snake_case rows to `Todo` with boolean `completed`; `ORDER BY created_at DESC, rowid DESC`; `ping` runs `SELECT 1`; `close` is idempotent -- AD-5, AD-8.
- [x] `apps/api/src/repository/in-memory-todo-repository.ts` -- array seeded via constructor, `list` returns a stable newest-first copy, `ping` no-op, `close` no-op -- unit test double.
- [x] `apps/api/src/service/todo-service.ts` -- `TodoService` receives the repository; `list()` returns the repository list stably sorted by `createdAt` desc (ties keep repository order); `ping()` delegates -- domain rules live here (AD-4).
- [x] `apps/api/src/routes/todos.ts`, `apps/api/src/routes/health.ts` -- one plugin per resource; todos `GET TODOS_PATH` with `response: { 200: TodoListSchema }`; health `GET HEALTH_PATH` with `HealthBodySchema` for 200 and 503, `try { service.ping() }` and `reply.code(503)` on failure; routes never build error bodies -- AD-3, AD-11.
- [x] `apps/api/src/app.ts` -- `buildApp({ repository, logger? })`: Fastify with TypeBox type provider, `ajv.customOptions` as above, `disableRequestLogging: true`, `onResponse` hook logging the four fields, `setErrorHandler` and `setNotFoundHandler` per the mapping rule, `onClose` hook calling `repository.close()`, registers both plugins -- the composition root.
- [x] `apps/api/src/server.ts` -- reads the five env vars with defaults `0.0.0.0`, `3000`, `/data/todos.db`, `info`; `mkdirSync(dirname(DB_PATH), { recursive: true })`; `new SqliteTodoRepository(DB_PATH)`; `buildApp({ repository, logger: { level: LOG_LEVEL } })`; `listen({ host, port })`; on `SIGINT`/`SIGTERM` calls `app.close()` -- the only env reader (AD-11).
- [x] `apps/api/src/service/todo-service.test.ts`, `apps/api/src/repository/sqlite-todo-repository.test.ts`, `apps/api/src/app.test.ts` -- unit: service ordering and tie-break against the in-memory repository; SQLite repository on a temp file (table created twice without error, pragmas, 0/1 to boolean, order, ping, idempotent close); `buildApp` with the in-memory repository: list, health ok, health 503 when `ping` throws, 404 envelope, 500 envelope when `list` throws, one log line per request captured through `logger: { level: 'info', stream }` -- proves the I/O Matrix.
- [x] `apps/api/test/todos.int.test.ts`, `apps/api/test/health.int.test.ts`, `apps/api/test/not-found.int.test.ts` -- `fastify.inject` with `SqliteTodoRepository` on a temp file per spec file (`mkdtemp` in `beforeAll`, removed in `afterAll`); todos seeds rows directly with better-sqlite3 using explicit `created_at`, asserts fresh `[]`, ordering, field set and restart persistence with a second app on the same file; health asserts 200 then 503 after closing the repository; not-found asserts the envelope for an unknown route, trailing slash and 500 after closing -- AD-12 integration home.
- [x] `apps/api/vitest.config.ts` -- add `coverage.exclude: ['src/server.ts']` -- entry point is process wiring.
- [x] `apps/api/test/README.md`, `README.md`, `docs/ai-integration-log.md` -- test README lists the three specs; README commands row for `test:int` now real, Layout line for `apps/api/src/{app,server,routes,service,repository}`, a local run example `DB_PATH=./todos.db npm run dev -w apps/api`; AI log Story 1.2 entry (agent usage, prompts, MCPs and tools, version pins, what the AI missed and debugging, decisions, limitations, review rounds) -- graded deliverables.

**Acceptance Criteria:**
- Given a clean checkout, when `npm ci && npm run build && npm run lint` run, then api compiles against `@todo/contract`, ESLint, Prettier and `typecheck` (tests included) pass.
- Given `npm test`, when the api suite runs, then every unit test passes and coverage is at or above 70% lines and branches.
- Given `npm run test:int`, when the three specs run, then all pass and a mis-globbed spec directory would fail the run (no `--passWithNoTests`).
- Given `DB_PATH=<tmp>/todos.db PORT=3999 npx tsx src/server.ts` from `apps/api`, when `curl localhost:3999/api/v1/health` runs, then `{"status":"ok"}` and one JSON log line with the four fields appear, and `/api/v1/todos` returns `[]`.
- Given the diff, when reviewed, then no literal `/api/v1` path, no `Todo` type and no SQL exist outside the places the spine assigns them.

## Implementation Notes

- Fastify 5.12.7 deprecates the top-level `disableRequestLogging` option (FSTDEP023); the same effect is set through `logController: new LogController({ disableRequestLogging: true })` so startup prints no warning.
- `apps/api/tsconfig.test.json` needed `rootDir: "."` (it is `noEmit`): the 1.1 config inherited `rootDir: "src"` while including `test/**/*.ts`, which the first integration spec exposed as TS6059.
- The `SELECT 1` ping statement is prepared directly; `scoped()` wraps the todos queries only, since an owner filter on a connection probe has no meaning.
- No write routes exist yet, so `app.test.ts` proves the `VALIDATION_ERROR` mapping and the Ajv options by registering throwaway routes on the built app.
- `*.db`, `*.db-wal`, `*.db-shm` added to `.gitignore` for the README local-run example.
- `InMemoryTodoRepository` mirrors the SQL order; the service test uses an unordered stub as well so the service sort is proven on its own.
- Deferred item from Story 1.1 applied: `--passWithNoTests` removed from the api `test:int` script now that `apps/api/test/` holds three specs; `npm run test:int` fails on "No test files found".
- Dispatcher check against the diff from baseline `755baec`: the test literals `'/api/v1/nope'` were replaced with `${API_PREFIX}/nope` so no `/api/v1` literal exists outside the contract (AC 5). Full verification green: contract 18, api 19 unit (100% lines, 95% branches, `server.ts` excluded), web 2, integration 5 in 3 files, e2e placeholder exit 0.
- Build review (edge-case 13, blind 11, verification-gap 3): 21 triage rows, 5 patched by the implementation subagent (`.dockerignore` and README for the local `apps/api/todos.db`, order-independent integration seed via `openDatabase`, 4xx causes logged at debug, `createdAt` format invariant stated on the port, AI log native-build facts reconciled plus Python 3 in README prerequisites), 1 deferred (no automated test of `server.ts` env wiring; Story 1.5 boots the built image), 15 rejected. Full verification rerun green with the same counts.

## Spec Change Log

## Review Triage Log

| # | Layer | Location | Claim | Verdict | Evidence | Route |
|---|---|---|---|---|---|---|
| 1 | edge-case | `apps/api/src/server.ts:9` | `PORT=""` gives `Number('')` = 0, an ephemeral port | low | True, but only an explicitly empty `PORT` reaches it; nobody sets that in everyday use; fix adds a validation branch. | reject |
| 2 | edge-case, blind | `apps/api/src/server.ts:11-16` | Unknown `LOG_LEVEL` makes pino throw with a raw stack | low | Loud failure at boot on a misconfigured env is correct behaviour; fix adds a guard. | reject |
| 3 | edge-case, blind | `apps/api/src/server.ts:14-15` | `mkdirSync`/open failure prints a raw stack, not a JSON line | low | Loud failure before `listen`; the stack names the path; fix wraps startup in a try/catch and a second logger. | reject |
| 4 | edge-case, blind | `apps/api/src/server.ts:18-26` | Shutdown has no deadline; second Ctrl-C ignored | low | Fastify 5 closes idle keep-alive connections on `close` and every handler is synchronous, so `close` settles; fix adds a timer. | reject |
| 5 | edge-case | `apps/api/src/server.ts:25-26` | SIGINT then SIGTERM calls `close()` twice | maybe-false | Would need to confirm avvio rejects a second `close`; at worst exit code 1 on a process already stopping, so low. | reject |
| 6 | edge-case | `apps/api/src/repository/sqlite-todo-repository.ts:16` | WAL pragma result unchecked | low | Local disk and the named volume support WAL; fix adds a guard. | reject |
| 7 | edge-case | `apps/api/src/repository/sqlite-todo-repository.ts:19-25` | Pre-existing `todos` table with other columns | false | `prepare()` throws in the constructor before `listen`; loud failure, not silent misbehaviour. | reject |
| 8 | edge-case | `apps/api/src/repository/sqlite-todo-repository.ts:46` | `VACUUM` may renumber `rowid` and change tie order | low | Nothing runs `VACUUM`; the spine mandates the `rowid` tie-break; fix changes the schema. | reject |
| 9 | edge-case, blind | `apps/api/src/service/todo-service.ts:16`, `todo-repository.ts` | Ordering relies on an unstated canonical `createdAt` format | low | Real invariant: text order is chronological only for `YYYY-MM-DDTHH:mm:ss.sssZ`; the server assigns it that way (spine Dates convention); a comment on the port is a direct correction. | patch |
| 10 | edge-case | `apps/api/src/repository/in-memory-todo-repository.ts:15` | `list()` shares Todo references with the seed | low | Test double only; no caller mutates items; fix adds a map. | reject |
| 11 | edge-case, blind, verification-gap | `apps/api/test/todos.int.test.ts:27-34` | Second test depends on the first creating the table | low | Confirmed: `seed()` opens a raw `Database` and inserts without `CREATE TABLE`; `it.only` fails with "no such table"; one-call fix. | patch |
| 12 | edge-case, blind | `apps/api/test/health.int.test.ts`, `not-found.int.test.ts` | App leaks when an `expect` fails before `close()` | low | Only on an already-failing test; fix restructures with try/finally. | reject |
| 13 | edge-case | test files with `INSERT` | AC "no SQL outside the repository" fails literally | false | The AC targets production code; the spec's Tasks sanction direct seeding; the fix would edit this build's spec. | reject |
| 14 | blind | `.dockerignore`, `README.md` | `*.db` not docker-ignored; README implies the file lands at the repo root | medium | `npm run dev -w apps/api` runs with cwd `apps/api`, so `./todos.db` is `apps/api/todos.db`; 1.4's build stage copies `apps/api`, so a local database would ship inside the image; three-line addition plus one README sentence. | patch |
| 15 | blind | `apps/api/src/routes/*.ts` | Full-path registration instead of prefix + `/todos` | low | Identical HTTP surface; `${TODOS_PATH}/:id` serves Epic 2; fix adds a prefix plugin layer or edits the spec; already recorded in the AI log. | reject |
| 16 | blind | `sqlite-todo-repository.ts:52` | `SELECT 1` does not prove the file is reachable | false | AD-11 and the story AC mandate `SELECT 1` on the open connection; SQLite keeps an unlinked open file usable, so "deleted file" is not an outage. | reject |
| 17 | blind | `apps/api/src/app.ts:48-53` | 4xx causes are never logged | low | Confirmed: the 4xx branches log nothing, so a validation failure cannot be diagnosed from logs (AD-3 says `message` is for logs); one `debug` line is a direct correction. | patch |
| 18 | blind | spec vs `sprint-status.yaml` | Status fields disagree | false | `sprint-status.yaml` is synced by the workflow (sync-sprint-status at step 5), not by the diff. | reject |
| 19 | blind, verification-gap | `docs/ai-integration-log.md`, `README.md` Prerequisites | Native-build statements contradict each other; "Dockerfile already provides Python"; one 180-column line | low | Confirmed: `node_modules/better-sqlite3/build/` holds `Makefile`, `config.gypi`, `obj.target` and no `.node`, so node-gyp configure ran (needs Python 3) and nothing compiled; no Dockerfile exists yet. Text correction plus a README prerequisite. | patch |
| 20 | blind | `package-lock.json` | Lockfile absent from the review diff | false | Excluded as generated; checked: additions are fastify, pino, avvio, find-my-way, esbuild platform packages, better-sqlite3, tsx, the type provider; no removals. | reject |
| 21 | verification-gap | `apps/api/src/server.ts` | Env wiring, `listen` and shutdown have no automated test | medium (unverified by test) | Pre-verified gap; the file is excluded from coverage and only the manual smoke run exercises it. Filed disposition: defer; Story 1.5 boots the built image through this entry. | defer |

## Design Notes

Scope seam: every statement in `SqliteTodoRepository` is prepared from one private helper so an owner filter later is a one-place change.

```ts
// All queries pass through here; the multi-user seam (AD-10).
private scoped(sql: string): string {
  return sql; // later: append a WHERE owner_id = ? clause
}
this.listStmt = db.prepare(this.scoped('SELECT id, description, completed, created_at FROM todos') + ' ORDER BY created_at DESC, rowid DESC');
```

Health: `503` is produced by the route, not the error handler, because AD-3 names health as the one non-envelope error body. Both layers order the list: SQL is the guarantee, the service's stable sort is the domain rule the unit test pins.

## Verification

**Commands:**
- `npm ci` -- expected: no native build output; `node_modules/better-sqlite3/prebuilds/` present.
- `npm run build` -- expected: `apps/api/dist/server.js` and `dist/app.js` exist.
- `npm run lint` -- expected: exit 0.
- `npm test` -- expected: api coverage at or above 70% lines and branches; contract and web unchanged.
- `npm run test:int` -- expected: three spec files pass; no "No test files found".
- `npm run test:e2e` -- expected: placeholder still exits 0.
- `cd apps/api && DB_PATH=$TMPDIR/todo-smoke/todos.db PORT=3999 LOG_LEVEL=info npx tsx src/server.ts` then `curl -s localhost:3999/api/v1/todos; curl -s localhost:3999/api/v1/health; curl -s localhost:3999/api/v1/x` -- expected: `[]`, `{"status":"ok"}`, `{"code":"NOT_FOUND",...}` and one log line per request.
