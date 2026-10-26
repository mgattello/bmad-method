---
title: 'Story 2.1: Create a Todo through the API'
type: 'feature'
created: '2026-10-26'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: 'a9d69930f8039a768c1926f8e678984985f1711d'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-bmad-method-2026-10-26/ARCHITECTURE-SPINE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The API only lists Todos. Story 2.2 (the input) and every later write path need `POST /api/v1/todos` to create a validated Todo with server-assigned identity and time, stored durably before the reply.

**Approach:** Extend the Story 1.2 layers in place: `routes/todos.ts` gains the POST route (contract body schema, `201` Todo), `TodoService.create` owns trim and the 1..`DESCRIPTION_MAX` rule plus `id` and `createdAt`, the `TodoRepository` port gains `insert`, implemented as a prepared statement in `SqliteTodoRepository` and an array push in `InMemoryTodoRepository`. The existing error handler keeps producing every envelope. Unit and integration suites prove the rule, the shape, durability and ordering.

## Boundaries & Constraints

**Always:** Paths and schemas from `@todo/contract` only (`TODOS_PATH`, `CreateTodoBodySchema`, `TodoSchema`, `DESCRIPTION_MAX`, `ErrorCode`). Route schema enforces type and shape only (`CreateTodoBodySchema`: `description: string`, no unknown fields); the service trims, then requires 1..`DESCRIPTION_MAX` characters and stores the trimmed value (AD-6). `id` is `crypto.randomUUID()` and `createdAt` is `new Date().toISOString()` (ISO 8601 UTC, millisecond precision), both set in the service, never by the client (AD-2). The reply is sent only after the synchronous better-sqlite3 `run()` has returned with `synchronous = FULL` (AD-5). `routes -> TodoService -> TodoRepository`, downward only; SQL only in `SqliteTodoRepository` as prepared statements with bound parameters (AD-4, AD-10). Route handlers never build error bodies: the one `setErrorHandler` emits `{ code, message }` for every non-2xx (AD-3). Newest first stays an API guarantee (AD-8): a created Todo is first on the next `GET`. The API never answers user input with 500. Coverage stays at or above 70% lines and branches for `apps/api`.

**Never:** No PATCH or DELETE routes (2.3, 2.4). No web changes (2.2). No schema or contract edits (`packages/contract` is read-only; the `todos` table already has every column). No `ownerId`, no migration tool, no `@fastify/sensible`, no clock or id injection into `TodoService` (tests use `vi.setSystemTime` and `vi.spyOn(crypto, 'randomUUID')`). Do not restructure the Story 1.2 files or rename their exports. Do not touch existing entries in `docs/ai-integration-log.md`. Do not edit `docs/architecture.md` section 3 unless its POST row is wrong (it already matches AD-2).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Create | `POST /api/v1/todos` `{ "description": "  Buy milk  " }` | `201` `{ id, description: "Buy milk", completed: false, createdAt }`, `id` UUID v4, `createdAt` matches `^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$`, fields exactly `id, description, completed, createdAt` | N/A |
| Durable | after a `201`, a second app on the same file (and a direct better-sqlite3 read) | the row is present with the same four values | N/A |
| Ordering | two creates, then `GET` | second created first, then first, then older seeded rows | N/A |
| Bounds | description of exactly `DESCRIPTION_MAX` chars after trim; of 1 char | `201` | N/A |
| Empty after trim | `""`, `"   "`, `"\t\n"` | `400 { code: "VALIDATION_ERROR", message }`; nothing inserted | service throws `ValidationError`; handler emits envelope |
| Too long | `DESCRIPTION_MAX + 1` chars after trim (padding does not count) | `400 VALIDATION_ERROR`; nothing inserted | same |
| Wrong type | `{ "description": 42 }`, `{ "description": null }`, `{}` | `400 VALIDATION_ERROR` | schema (no coercion) |
| Unknown field | `{ "description": "x", "completed": true }` | `400 VALIDATION_ERROR` (never stripped) | schema (`removeAdditional: false`) |
| Malformed JSON | `{not json` with `content-type: application/json`; empty body with that header | `400 VALIDATION_ERROR` | Fastify content-type parser error, mapped by handler |
| Unsupported content type | `content-type: text/plain` body `description=x` | `400 VALIDATION_ERROR` (Fastify 415 mapped to 400) | handler |
| Store failure | repository closed, valid body | `500 { code: "INTERNAL_ERROR", message: "Unexpected error" }`, no library text, error logged | handler |

</frozen-after-approval>

## Code Map

- `apps/api/src/app.ts` -- `buildApp`: Ajv `coerceTypes: false`, `removeAdditional: false`; `statusOf(error)`; `setErrorHandler` maps 404 -> `NOT_FOUND`, other 4xx -> `400 VALIDATION_ERROR` with the fixed `'Invalid request'`, else 500. Add one branch before the generic 4xx mapping: `error instanceof ValidationError` -> `400 { code: VALIDATION_ERROR, message: error.message }` (our own text, not library text), logged at `debug`. Nothing else changes.
- `apps/api/src/routes/todos.ts` -- `todoRoutes` plugin with `GET TODOS_PATH`. Add `app.post(TODOS_PATH, { schema: { body: CreateTodoBodySchema, response: { 201: TodoSchema } } }, async (request, reply) => reply.code(201).send(service.create(request.body.description)))`.
- `apps/api/src/service/todo-service.ts` -- `TodoService { list(), ping() }`. Add `create(description: string): Todo`.
- `apps/api/src/service/errors.ts` -- new: `export class ValidationError extends Error { statusCode = 400; name = 'ValidationError' }` (class fields, no parameter properties: `erasableSyntaxOnly`).
- `apps/api/src/repository/todo-repository.ts` -- port `{ list, ping, close }`. Add `insert(todo: Todo): void` (throws when the store is unreachable; the Todo is stored as given).
- `apps/api/src/repository/sqlite-todo-repository.ts` -- `openDatabase`, `scoped()` (read filter seam), `listStmt`, `pingStmt`. Add `insertStmt` prepared in the constructor: `INSERT INTO todos (id, description, completed, created_at) VALUES (?, ?, ?, ?)`, `completed` bound as `0 | 1`. Table unchanged.
- `apps/api/src/repository/in-memory-todo-repository.ts` -- seeded array; `list` reverses then stable-sorts (mirrors `rowid DESC`). Add `insert` = push.
- `apps/api/src/app.test.ts` -- three inline `TodoRepository` literals (`unordered`-style stubs and `broken`) must gain `insert` or they stop type-checking. Reuse `withLogCapture` for the 500 log assertion. Existing `/echo` test already proves coercion and malformed JSON generically.
- `apps/api/src/service/todo-service.test.ts` -- unit suite for `list`/`ping`; add `describe('TodoService.create')`.
- `apps/api/src/repository/sqlite-todo-repository.test.ts` -- temp-file suite (`mkdtemp` in `beforeAll`); add an insert-then-list case and 0/1 mapping of `completed` on write.
- `apps/api/test/todos.int.test.ts` -- `GET` spec on a temp SQLite file with a `seed()` helper; add `describe(\`POST ${TODOS_PATH}\`)` here (one spec per endpoint path). `apps/api/test/not-found.int.test.ts` shows the closed-store 500 pattern.
- `packages/contract/src/todo.ts` -- `DESCRIPTION_MAX = 500`, `CreateTodoBodySchema` (`additionalProperties: false`), `TodoSchema`. Read-only.
- Docs: `README.md` "Run the API locally" (curl examples for GET and health; add the POST example) and the `test:int` Commands row; `apps/api/test/README.md` spec table; `docs/architecture.md` section 3 already documents POST and the VALIDATION_ERROR cases (verify, do not rewrite); `docs/ai-integration-log.md` (append a Story 2.1 entry after Story 1.3, same headings as 1.2 and 1.3).

## Tasks & Acceptance

**Execution:**
- [x] `apps/api/src/service/errors.ts` -- `ValidationError` with `statusCode = 400` -- the service's only signal for a rule failure.
- [x] `apps/api/src/repository/todo-repository.ts` -- add `insert(todo: Todo): void` with a one-line doc comment -- the port (AD-4, AD-10).
- [x] `apps/api/src/repository/sqlite-todo-repository.ts` -- `insertStmt` prepared once; `insert(todo)` runs it with `completed ? 1 : 0` -- durable write, SQL stays in one file (AD-5).
- [x] `apps/api/src/repository/in-memory-todo-repository.ts` -- `insert` pushes a copy -- unit-test double keeps the tie-break order.
- [x] `apps/api/src/service/todo-service.ts` -- `create(description)`: `const trimmed = description.trim()`; throw `ValidationError` when `trimmed.length === 0` or `> DESCRIPTION_MAX` (message names the rule, e.g. `description must be 1 to 500 characters after trimming`, built from the constant); build `{ id: crypto.randomUUID(), description: trimmed, completed: false, createdAt: new Date().toISOString() }`; `repository.insert(todo)`; return it -- AD-6, AD-2.
- [x] `apps/api/src/routes/todos.ts` -- POST route as in the Code Map -- AD-2; the handler builds no error body (AD-3).
- [x] `apps/api/src/app.ts` -- `ValidationError` branch in the error handler -- rule text reaches developers, library text never does.
- [x] `apps/api/src/service/todo-service.test.ts` -- `create`: trims and stores the trimmed value; exactly `DESCRIPTION_MAX` accepted, `DESCRIPTION_MAX + 1` rejected, padding not counted; empty and whitespace rejected with `ValidationError` and `repository.insert` not called; `id` from `crypto.randomUUID` (spy) and `createdAt` from `vi.setSystemTime` (exact string, `.000Z` and non-zero ms cases); two creates then `list()` returns the second first; repository `insert` failure propagates -- unit level per AC.
- [x] `apps/api/src/repository/sqlite-todo-repository.test.ts` -- insert two rows through the repository, `list()` returns newest first with booleans, and a raw better-sqlite3 read sees `completed` as `0`; `insert` after `close()` throws -- repository level.
- [x] `apps/api/src/app.test.ts` -- POST through `buildApp` with the in-memory repository: 201 shape and `content-type`; service rejection is `400 VALIDATION_ERROR` whose `message` is the rule text, schema rejection is `400 VALIDATION_ERROR` `'Invalid request'`; `broken` repository gives 500 with one error log line; add `insert` to the inline stubs -- app level.
- [x] `apps/api/test/todos.int.test.ts` -- POST describe covering every I/O Matrix row on the temp SQLite file, including durability via a second `buildApp` on the same file and a direct `openDatabase` read, and ordering after two creates against the seeded rows -- integration home (AD-12).
- [x] `apps/api/test/README.md`, `README.md`, `docs/ai-integration-log.md` -- test README todos row lists the POST cases; README `test:int` row and a `curl -X POST localhost:3000/api/v1/todos -H 'content-type: application/json' -d '{"description":"Buy milk"}'` example after the GET one, noting `201` and the `400 { code: "VALIDATION_ERROR" }` reply for an empty or over-long description; AI log Story 2.1 entry (Date, Agent usage, Prompts, MCPs and tools, What the AI missed and debugging, Decisions made while implementing, Review rounds placeholder line, Limitations) -- graded deliverables.

**Acceptance Criteria:**
- Given a clean worktree, when `npm run build && npm run lint` run, then api compiles and ESLint, Prettier and every `typecheck` pass.
- Given `npm test`, when the api suite runs, then all tests pass and coverage is at or above 70% lines and branches (expected to stay near the current 100/95).
- Given `npm run test:int`, when the specs run, then all pass with the POST cases added to `todos.int.test.ts`.
- Given `DB_PATH=<tmp>/todos.db PORT=3999 npx tsx src/server.ts` from `apps/api`, when the README POST curl runs, then `201` with a Todo, and a following `GET` lists it first.
- Given the diff, when reviewed, then no literal `/api/v1`, no `500` literal for the description limit, and no SQL exist outside the places the spine assigns them, and nothing under `apps/web` or `packages/contract` changed.

## Implementation Notes

## Spec Change Log

## Review Triage Log

Round 1 (blind hunter BH, edge-case hunter EC, verification gap VG). 16 findings, 15 rows (BH2 and EC1 share a root cause): 11 patched, 5 rejected, 0 deferred.

| # | Finding | Verdict | Evidence | Route |
|---|---------|---------|----------|-------|
| 1 | BH1 `todos.int.test.ts` ordering test asserts `ids.slice(-3)` equals the GET describe's seed rows | low | True: `seed()` runs only inside the second GET test; `it.only` on the POST describe fails on never-inserted rows. Direct deletion. | patch |
| 2 | BH2 + EC1 `trimmed.length` counts UTF-16 code units, so 251 emoji are rejected | low | True, but the client's `.length` and HTML `maxlength` count the same unit, so both sides agree; only descriptions of more than 250 astral characters differ. Fix is a one-line comment naming the unit. | patch |
| 3 | BH3 `scoped()` comment says every todos query passes through it; `insertStmt` does not | low | True: comment is now wrong and AD-10 readers would look in the wrong place. Direct correction of the comment. | patch |
| 4 | BH4 no test for `[]` body, missing content-type, form-urlencoded, 413 | low | The generic 4xx branch already maps all of these (pinned by the 418 and `/echo` tests); no 500 is reachable. Two cheap rows added to the `it.each` table. | patch |
| 5 | BH5 README hard-codes "500 characters" and leaves a dangling wrapped line | low | True on both; wording moves to the constant with 500 as today's value, paragraph rewrapped. | patch |
| 6 | BH6 AI log entry lists commands but no test counts or coverage | low | True: Story 1.2 recorded both. Counts are 35 unit, 20 integration, api 100/100. | patch |
| 7 | BH7 test README todos row is one 900-character cell | low | True; split into GET and POST rows. | patch |
| 8 | BH8 port says "stores as given" but SQLite throws on duplicate id while the double accepts it | low | Real difference, but ids come only from `crypto.randomUUID()` in the service, so no caller can reach it; the fix adds a guard to the double. | rejected |
| 9 | BH9 too-long unit case never pins `statusCode: 400` | low | True; same try/catch shape as the empty case. | patch |
| 10 | BH10 `count()` is `async` for sync work; regexes differ between suites; shared capture helper suggested | low | `async` dropped (deletion). The regex difference and a shared helper change no behaviour and the helper is new surface. | patch (async only), rest rejected |
| 11 | EC2 zero-width-only description passes `trim()` and creates a visually empty Todo | low | True (U+200B is not whitespace for `trim()`), but nobody types it in everyday use and the fix adds a stripping branch the spine does not ask for. | rejected |
| 12 | EC3 lone surrogate in JSON echoes in the 201 but is stored as U+FFFD | maybe-false | Not checked whether better-sqlite3 replaces lone surrogates; if true it is a cosmetic difference on malformed input (low). | rejected |
| 13 | EC4 `open(deps)` constructs a default `SqliteTodoRepository` even when `deps.repository` is given, leaking a connection | low | True: the spread overrides after construction; one-line `??` fix. | patch |
| 14 | EC5 seeded `T2` is later than a wall clock set before 2026-10-26T11:00Z | low | Only a clock set earlier than the day the test was written triggers it; fix would re-derive seed times. | rejected |
| 15 | VG1 the `ValidationError` branch's `debug` level and the one-line-per-request guarantee are unobserved for rejected POSTs | medium | Pre-verified by the layer: changing `debug` to `info` leaves every test green. Add the capture test. | patch |

## Design Notes

- Envelope `message` for a service rejection carries the rule text (`description must be 1 to 500 characters after trimming`), not the handler's generic `'Invalid request'`: AD-3 reserves `message` for logs and developers and only forbids library-supplied text. Schema failures keep the generic string because Ajv's text is library text. The web never shows either.
- `ValidationError` sets `statusCode = 400` so even without the `instanceof` branch the generic 4xx mapping would still answer 400; the branch exists only to pass our message through.
- `insertStmt` is prepared directly, like `pingStmt`; `scoped()` appends a read filter and has nothing to add to an INSERT. When an owner arrives, it becomes a bound column on this one statement, so the one-place-change promise of AD-10 holds.
- Durability needs no extra code: better-sqlite3 `run()` is synchronous and `synchronous = FULL` is set in `openDatabase`, so control returns to the route only after the commit is on disk. The integration test proves it by reading the file through a second connection.
- Golden unit example:

```ts
vi.setSystemTime(new Date('2026-10-26T12:00:00.123Z'));
vi.spyOn(crypto, 'randomUUID').mockReturnValue('11111111-2222-4333-8444-555555555555');
expect(service.create('  Buy milk ')).toEqual({
  id: '11111111-2222-4333-8444-555555555555',
  description: 'Buy milk',
  completed: false,
  createdAt: '2026-10-26T12:00:00.123Z',
});
```

## Verification

**Commands:**
- `npm run build` -- expected: contract, api and web compile.
- `npm run lint` -- expected: ESLint, Prettier and every workspace typecheck pass.
- `npm test` -- expected: all suites pass; api coverage at or above 70% lines and branches.
- `npm run test:int` -- expected: todos, health and not-found specs pass including the new POST cases.
- `git diff --stat main -- apps/web packages/contract` -- expected: empty.
- `grep -rn "/api/v1" apps/api/src apps/api/test` -- expected: no matches (paths come from the contract).

**Manual checks (if no CLI):**
- Smoke: `DB_PATH=<tmp>/todos.db PORT=3999 npx tsx src/server.ts` in `apps/api`; the README POST curl returns `201` and the GET curl lists it first; one JSON log line per request.
