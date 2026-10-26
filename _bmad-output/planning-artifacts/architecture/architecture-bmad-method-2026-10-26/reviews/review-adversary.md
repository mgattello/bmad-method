---
review: adversary
target: ../ARCHITECTURE-SPINE.md
date: 2026-10-26
lens: "Construct two units one level down that each obey every AD to the letter yet still build incompatibly."
---

# Adversarial review: Architecture Spine, Todo App

## Method

Five builders, each reading only the spine and the PRD, never each other's code:

| Unit | Builds |
| --- | --- |
| API | `apps/api` (routes, service, repository, integration tests) |
| WEB | `apps/web` (fetch client, state, components, Vite config) |
| CONTRACT | `packages/contract` |
| E2E | `e2e/` and `docker-compose.yml` (profiles, volumes, healthchecks in compose) |
| DOCKER | both Dockerfiles and `nginx.conf` |

For each hole below, both units comply with every AD and convention as written, and the result still fails to integrate or diverges in behaviour. Each hole ends with the AD to add or tighten, with proposed wording.

Verdict: the spine nails the domain seams (contract, layering, server-is-truth) but leaves the operational seams open. Three of the holes break `docker compose up` outright before a single Todo is created.

Count: 4 critical, 8 high, 9 medium, 6 low.

---

## Critical

### C-1. API binds to localhost inside the container; no env var is allowed to fix it

**Units:** API vs DOCKER, E2E (compose).

**Divergence.** AD-11 says the API reads `PORT`, `DB_PATH`, `LOG_LEVEL`, `NODE_ENV` "and nothing else". The API builder writes `app.listen({ port })`. Fastify's default host is `localhost`, so the process binds `127.0.0.1:3000`. nginx in the web container proxies to `http://api:3000` (AD-9) and gets connection refused: every `/api/` call is a 502 in both profiles. The compose builder cannot repair it: adding `HOST=0.0.0.0` would violate the "nothing else" clause the API builder has honoured, and the API ignores it anyway. The api `HEALTHCHECK` executed inside the container hits `localhost` and passes, so the container reports healthy while unreachable.

**Fix.** Tighten AD-11:

> `server.ts` listens on `host: "0.0.0.0"` and `port: PORT`. The bind address is not configurable in v1.

### C-2. The contract package has no defined shipping format or name; Docker builds fail or apps resolve it differently

**Units:** CONTRACT vs API vs WEB vs DOCKER.

**Divergence.** AD-1 says what `packages/contract` exports, not how. Three independent choices are all compliant:

- CONTRACT ships TS source only (`"main": "src/index.ts"`), expecting consumers to compile it. Vite in WEB resolves that happily. `tsc` in API refuses to emit across a package boundary without `composite`/references, or emits with the contract's source paths baked in, and the production image (`node dist/server.js`) cannot `require` a `.ts` file.
- CONTRACT ships `dist/` with a `build` script. The DOCKER builder runs `npm ci` then `npm run build -w apps/api`; contract was never built, so `@x/contract` resolves to a package with no `dist`, and the build fails.
- The package name itself (`@todo/contract`, `contract`, `@todo-app/contract`) is a free choice; API and WEB each guess, DOCKER's `npm ci -w <name>` guesses a third.

Also unstated: whether `e2e/` is an npm workspace (it must be to "depend on contract for paths only"), so the DOCKER builder's `COPY` list and the E2E builder's import style diverge.

**Fix.** Add AD-13:

> **Contract packaging.** The package is named `@todo/contract`. It is TypeScript compiled by its own `build` script to `dist/` (ESM + `.d.ts`); `package.json` `exports` points only at `dist/`. Consumers import `@todo/contract`, never a relative path into `packages/`. Root `build` runs `contract` first. npm workspaces are exactly `packages/*`, `apps/*`, `e2e`. Both Dockerfiles use the repo root as build context, copy `package.json`, `package-lock.json`, `packages/contract`, and their own app, run `npm ci --workspace=<app> --include-workspace-root=false`, build `contract` then the app, and prune dev dependencies in the final stage. A root `.dockerignore` excludes `node_modules`, `dist`, `e2e/`, `_bmad*`.

### C-3. Two owners of container health, and the api image has no `curl`

**Units:** DOCKER vs E2E (compose).

**Divergence.** AD-11 puts `HEALTHCHECK` in the Dockerfiles. Compose also has a `healthcheck:` key, and the E2E builder needs one to write `depends_on: { api: { condition: service_healthy } }`. Both builders own health. Compose's definition silently overrides the Dockerfile's. The compose builder writes `test: ["CMD", "curl", "-f", "http://localhost:3000/api/v1/health"]`. `node:24-alpine` has no `curl` (it has busybox `wget`). The api container is permanently `unhealthy`, `web` never starts under `service_healthy`, E2E times out. Meanwhile the DOCKER builder's own `HEALTHCHECK` (say `wget -qO- --spider`) was correct and is never executed. The reverse also holds: compose omits healthcheck, Dockerfile uses `curl`.

**Fix.** Tighten AD-11:

> Container health is defined once, in each Dockerfile; `docker-compose.yml` never sets `healthcheck:` and references health only via `depends_on: condition: service_healthy`. api: `HEALTHCHECK --interval=10s --timeout=3s --retries=3 CMD wget -qO- http://127.0.0.1:3000/api/v1/health || exit 1`. web: `HEALTHCHECK ... CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1`. No image installs `curl`.

### C-4. The `dev` profile topology is undefined; compose, Vite and Dockerfile builders assume three different things

**Units:** E2E (compose) vs WEB (Vite config) vs DOCKER.

**Divergence.** AD-11 says `dev` is "bind-mounted sources, hot reload" and `test` is "built images", and that they "differ only by env vars and profile". These cannot all hold: hot reload means the web container runs Vite, not nginx, so the dev `web` service has a different image, command, and port. The spine does not say who builds that dev image. Compliant but incompatible choices:

- Compose builder: `web` dev service uses `build: { target: dev }`. The DOCKER builder's multi-stage file has stages `build` and `runtime`, no `dev`. Compose fails.
- Compose builder: `web` dev service is `image: node:24-alpine`, `command: npm run dev -w apps/web`, `ports: 8080:8080`. WEB builder's Vite config has the default `server.port 5173` and `host: localhost`; inside the container nothing listens on 8080 and the dev server refuses external connections. Dead stack.
- WEB builder sets the Vite proxy target per AD-9 to `http://api:3000` (`the same way`). That works only inside compose; `npm run dev` on the host (what a README "run it" section will say) proxies to a hostname that does not resolve.
- Two services cannot share the name `web` across profiles in one file; the compose builder names them `web` and `web-dev`. The E2E `playwright.config.ts` has no idea which name is up.

**Fix.** Rewrite the profile sentence of AD-11 as AD-14:

> **Compose topology.** Two profiles, two service pairs. Profile `test` (used by E2E and the graded `docker compose up`): services `api` and `web` built from the Dockerfiles, named volume `todo-data`, host port `8080` on `web`. Profile `dev`: services `api-dev` (`image: node:24-alpine`, `command: npm run dev -w apps/api`, bind-mount `.`) and `web-dev` (same image, `command: npm run dev -w apps/web`, bind-mount `.`, host port `8080`). Vite config: `server.host = true`, `server.port = 8080`, proxy `/api` to `process.env.API_PROXY_TARGET ?? "http://localhost:3000"`; compose `dev` sets `API_PROXY_TARGET=http://api-dev:3000`. api dev server runs `tsx watch src/server.ts`. The Dockerfiles have no dev stage. "Differ only by env vars and profile" is replaced by this table.

---

## High

### H-1. Contract path constants: Fastify pattern vs URL builder

**Units:** CONTRACT vs API vs WEB.

**Divergence.** AD-1 forbids literal paths in the apps and says contract exports "route path constants". The CONTRACT builder exports `TODOS = "/api/v1/todos"` and `TODO_BY_ID = "/api/v1/todos/:id"`. API registers `fastify.patch(TODO_BY_ID, ...)` fine. WEB needs a concrete URL: it either writes `TODO_BY_ID.replace(":id", id)` (fragile, and the first `:id`-style convention change breaks it silently) or concatenates `${TODOS}/${id}` (a literal path by another name). Alternative CONTRACT: exports only a builder `todoById(id)`, and now API cannot register a route from it. Each builder guesses; the pair diverges on the first rename.

**Fix.** Tighten AD-1:

> `contract/src/routes.ts` exports `API_PREFIX = "/api/v1"`, and for each resource both a Fastify pattern (`TODOS_PATH = "/todos"`, `TODO_BY_ID_PATTERN = "/todos/:id"`) and a URL builder (`todosUrl()`, `todoUrl(id)`) that returns the full relative URL. API registers the todos plugin with `{ prefix: API_PREFIX }` and uses the patterns; WEB and E2E use only the builders. The health path is `HEALTH_PATH = "/health"` under the same prefix.

### H-2. Malformed `:id`: 400 or 404 is decided by whichever builder adds a params schema

**Units:** CONTRACT vs API vs WEB vs E2E.

**Divergence.** AD-2 types `id` as UUID v4; nothing says whether `:id` is validated. CONTRACT adds `params: Type.Object({ id: Type.String({ format: "uuid" }) })` (Fastify 5 ships `ajv-formats`, so it is enforced): `PATCH /todos/abc` is `400 VALIDATION_ERROR`. API builder, reading AD-6 "the route schema enforces type and a 500 upper bound only", attaches no params schema: the service looks it up, misses, `404 NOT_FOUND`. The integration suite (API) and any WEB handling that keys off `NOT_FOUND` (see H-5) now disagree with the contract's own type. The PRD ("invalid fields return 400; non-existent ID returns 404") supports both readings.

**Fix.** Tighten AD-2 and AD-3:

> `:id` is validated by the contract's params schema (`format: "uuid"`). A syntactically invalid id is `400 VALIDATION_ERROR`; a well-formed id with no row is `404 NOT_FOUND`. Contract exports `params`, `body`, and `response` schemas for every route and API attaches all three.

### H-3. Non-envelope responses the client will meet anyway

**Units:** API vs WEB vs DOCKER (nginx).

**Divergence.** AD-3: "Every non-2xx body is `{ code, message }`. One Fastify error handler produces the envelope." The API builder registers `setErrorHandler` and stops: compliant. But route-not-found (`GET /api/v1/nothing`, or any path mistake in H-1) never reaches the error handler; Fastify's default 404 body is `{ message, error, statusCode }`. Likewise `@fastify/sensible`'s `reply.notFound()` and Fastify's own errors (`FST_ERR_CTP_EMPTY_JSON_BODY`, `FST_ERR_CTP_INVALID_MEDIA_TYPE`, body too large) carry their own `code` property; a handler that does `{ code: err.code, message: err.message }` is "one handler producing the envelope" and emits codes outside the enum. And when the api container is down, nginx answers `502` with an HTML page; when the network drops, `fetch` rejects with no body at all. The WEB builder, trusting AD-3 to the letter, does `const { code, message } = await res.json()` inside the error path; the JSON parse throws inside the catch, the hook's error state is never set, and the user sees nothing (FR-14 fails) or a blank app.

**Fix.** Tighten AD-3 and AD-7:

> AD-3: `buildApp` registers both `setErrorHandler` and `setNotFoundHandler`; both emit the envelope. The handler maps `err.validation` to `VALIDATION_ERROR`, `statusCode 404` to `NOT_FOUND`, every other `statusCode < 500` to `VALIDATION_ERROR`, and everything else to `INTERNAL_ERROR`. Fastify's `err.code` is never copied into the envelope. `@fastify/sensible` is used for `httpErrors` only and its bodies never reach the wire.
> AD-7: the `api/` client normalises every failure to `ApiError { code, message, status? }`: a non-2xx with a parseable envelope keeps its `code`; a non-2xx with any other body (nginx 502, HTML, empty) and a rejected `fetch` both become `INTERNAL_ERROR`. State and components see only `ApiError`.

### H-4. Error copy has two authors

**Units:** API vs WEB vs E2E.

**Divergence.** Conventions: "messages human-readable ... Client shows messages, never codes." AD-7: "a non-blocking error message naming the action is shown." The WEB builder reads the first and renders `error.message` from the server verbatim; the API builder's VALIDATION_ERROR message is AJV's `body/description must NOT have more than 500 characters` (compliant: human-readable, not a raw stack). It does not name the action, so AD-7 is now violated by the pair though not by either. For a network failure there is no server message at all, so the client must author copy anyway: two voices in one `ErrorBanner`. The E2E builder's "error handling" spec asserts on text it cannot know. FR-2's inline "a Description is required" wording is owned by nobody.

**Fix.** Replace the Errors convention and add to AD-7:

> User-facing copy is owned by `apps/web` exclusively, keyed by `(action, code)`: e.g. `create+VALIDATION_ERROR` -> "Add a description of 1 to 500 characters.", `toggle+INTERNAL_ERROR` -> "Couldn't update that todo. Try again." The server's `message` is for logs and developers and is never rendered. The client never renders `code` either. The copy table lives in `apps/web/src/copy.ts`; E2E asserts on `getByRole("status")` containing the action word, not on exact text.

### H-5. PATCH or DELETE returns 404 because another tab deleted the item

**Units:** WEB vs API.

**Divergence.** AD-7: "On write failure the list stays at its last persisted state." Tab A deletes a Todo; tab B toggles it; API answers `404 NOT_FOUND`. WEB builder 1 keeps the ghost item (letter of AD-7) with an error banner; the user retries forever, and `DELETE` on it also 404s, so the ghost cannot be removed except by reload. WEB builder 2 reads "server is truth" and drops the item. Both comply; behaviour diverges, and E2E cannot encode either.

**Fix.** Add to AD-7:

> On `NOT_FOUND` from PATCH or DELETE the client removes the item from the list (the server has told the truth) and, for PATCH only, shows the `toggle+NOT_FOUND` copy. On `NOT_FOUND` from DELETE no error is shown.

### H-6. E2E data isolation: "fresh DB volume" is per `down -v`, not per spec

**Units:** E2E vs compose vs API.

**Divergence.** AD-11's test profile gives a "fresh DB volume"; it is fresh only until the first run writes to it, and `docker compose up` on an existing volume reuses it. The E2E builder has five specs; `empty state` needs zero rows, `create` adds rows. Playwright defaults to `fullyParallel` with several workers; the specs share one SQLite file and race. The E2E builder who notices cleans up in `beforeEach` by listing and deleting via the API (allowed, contract paths only), but has no bulk delete and a 200-row list becomes a slow sweep. The compose builder who notices uses `tmpfs: /data`, which also defeats the restart test (SM-2). Nothing pins any of this down.

**Fix.** Add AD-15:

> **E2E isolation.** `playwright.config.ts`: `workers: 1`, `fullyParallel: false`, `retries: 0`, `baseURL http://localhost:8080`. Every spec `beforeEach` lists todos via `todosUrl()` and deletes each one; `webServer` is not used. The root script `test:e2e` runs `docker compose --profile test down -v && docker compose --profile test up -d --build --wait && playwright test; docker compose --profile test down -v`. The `test` profile uses named volume `todo-data-test`, distinct from `dev`'s `todo-data`. The restart journey (SM-2) is one spec that runs `docker compose restart api` through `child_process` and reloads.

### H-7. `completed` reaches the client as `0`/`1`

**Units:** API vs CONTRACT vs WEB.

**Divergence.** SQLite has no boolean; `SqliteTodoRepository` stores `INTEGER`. AD-1 says API "builds Fastify route schemas from these exports"; the API builder attaches `body` and `params` and skips `response` (AD-6 only mentions input). Rows come back with `completed: 1`. Without a response schema Fastify serialises `1` as-is. WEB types `completed` as `boolean`, writes `todo.completed === true` for the strike-through class and the cue silently never appears; `checked={1}` happens to render checked, so E2E `toBeChecked()` passes and the visual cue (FR-6) fails. With a response schema attached, fast-json-stringify coerces `1` to `true` and the bug is invisible; which of the two happens depends on a choice the spine does not make.

**Fix.** Add to AD-4 and AD-1:

> `SqliteTodoRepository` maps rows to `Todo` explicitly (`completed: row.completed === 1`); no row object leaves the repository. Every route attaches the contract's `response` schema for each status it emits, so serialisation is contract-checked.

### H-8. Same-millisecond `createdAt` plus `id` tie-break reorders the list on reload

**Units:** API vs WEB vs E2E.

**Divergence.** AD-8 orders by `createdAt DESC, id DESC`. `createdAt` is `toISOString()` (millisecond). Two creates in the same millisecond, trivial with `fastify.inject` and plausible from a fast E2E loop, tie on `createdAt`; the tie-break is a random UUID v4, so the second-created item may sort below the first. The client inserted the newer at index 0 "consistent with the API order" (AD-8), reloads, and the order flips. An E2E spec "create A, create B, reload, expect B above A" is flaky by design, and both builders followed the rule.

**Fix.** Tighten AD-8:

> Table `todos` has an `INTEGER PRIMARY KEY` row sequence (`seq`) in addition to `id TEXT UNIQUE`. `GET /todos` orders by `createdAt DESC, seq DESC`. `seq` is never exposed. Insertion order therefore always matches list order, and index-0 insertion on the client is exact.

---

## Medium

### M-1. Client trims before sending, or not; route `maxLength` is on the raw string

**Units:** WEB vs API.

**Divergence.** AD-6: route enforces 500 on the raw body; service trims then checks 1..500. WEB pre-checks `value.trim().length` (its only allowed shortcut is the empty case) and sends the raw value. A 499-character description with two leading spaces passes the client check and fails the route with 400. A different WEB builder trims before sending and never sees this. Divergent UX across two compliant clients.

**Fix.** Add to AD-6: "The client sends `description.trim()`; the client-side pre-check is `trimmed.length === 0` only. Any stored `description` is the trimmed value, and PATCH responses return it trimmed."

### M-2. PATCH `{}` and PATCH with unknown fields: who enforces "at least one"

**Units:** CONTRACT vs API.

**Divergence.** AD-2 says "at least one" but AD-6 says schema does type and bound "only" and AD-4 says the service owns rules. CONTRACT builder adds `minProperties: 1`; API builder also checks in the service; same code (400), fine. But if neither does (each assumes the other), `PATCH {}` returns `200` with the unchanged Todo. And `PATCH { foo: 1 }`: with `additionalProperties: false` Fastify's default `removeAdditional: true` strips it to `{}`; without it, the service sees neither field. Three integration suites, three answers.

**Fix.** Tighten AD-2: "The PATCH body schema in contract sets `additionalProperties: false` and `minProperties: 1`; the service additionally rejects an update with neither field as `VALIDATION_ERROR`. Unknown fields on any body are a `VALIDATION_ERROR`, not stripped: `buildApp` sets `ajv.customOptions.removeAdditional = false` and `coerceTypes = false`." (The coercion default would otherwise accept `{ completed: "true" }` and `{ description: 123 }` against the PRD's "invalid fields return 400".)

### M-3. The 200-item bound is read three ways

**Units:** API vs WEB vs E2E.

**Divergence.** Deferred: "the list endpoint returns all items (bounded at 200 for NFR-Performance)". API builder adds `LIMIT 200` to the query, or rejects the 201st POST. PRD FR-3: "returns every Todo (no pagination)". The E2E builder's performance spec seeds 250 rows and expects 250. No AD states the rule.

**Fix.** Add to AD-8: "No limit on the list query. 200 is the performance fixture size, not an API bound."

### M-4. In-flight guard: queue with stale intent, and unkeyed creates

**Units:** WEB vs E2E.

**Divergence.** AD-7: one in-flight write per id, "a further action waits". Builder 1 queues the action closure computed at click time: click, click on a checkbox sends `completed: true` twice, net `true`; the user expected a net untoggle. Builder 2 recomputes from settled state: net `false`. Builder 3 disables the control while in flight. E2E double-click spec cannot pick. Separately, create has no id, so the guard does not apply: two rapid submits send two POSTs whose responses can arrive out of order; index-0 insertion then disagrees with API order even with H-8 fixed.

**Fix.** Tighten AD-7: "While a write is in flight for a Todo, its checkbox and delete button are `disabled`; no action is queued. While a create is in flight the submit control is disabled and Enter is ignored. 'Waits' in FR-11 is satisfied by disabling, not queuing."

### M-5. Health `503` body contradicts AD-3

**Units:** API vs the spine itself (and any E2E or integration assertion on the body).

**Divergence.** AD-2: `503 { status: "degraded" }`. AD-3: "Every non-2xx body is `{ code, message }`." An API builder who lets the `SELECT 1` throw through the error handler returns `500 { code: INTERNAL_ERROR }`, violating AD-2 and lying to the orchestrator (500 vs 503 both fail the check, but the body and status differ from the contract). One who catches and replies 503 violates AD-3.

**Fix.** Amend AD-3: "Exception: `GET /health` is outside the envelope; it returns `{ status: "ok" }` or `503 { status: "degraded" }` and catches its own error."

### M-6. `LOG_LEVEL=silent` in the `test` profile hides the graded request logs

**Units:** E2E (compose) vs API.

**Divergence.** Conventions: "`LOG_LEVEL` default `info`, `silent` in tests." The compose builder reads "tests" as the `test` profile and sets `LOG_LEVEL=silent`. `docker compose logs api` during E2E is empty; NFR-Deployability's "logs readable through the orchestrator" fails on the only profile the grader runs; E2E debugging is blind.

**Fix.** Tighten the Logging convention: "`silent` applies to Vitest only (`buildApp({ logger: false })` in unit and integration tests). Compose profiles set `LOG_LEVEL=info`."

### M-7. Two live regions, and `alert` vs `status`

**Units:** WEB vs E2E.

**Divergence.** FR-2 wants the input to show a screen-reader-announced message; FR-14 wants errors announced; conventions name one `aria-live="polite"` region; the seed lists `ErrorBanner`. WEB builder puts a live region in `TodoInput` for validation and another in `ErrorBanner`; a failed create announces twice. The E2E builder locates `getByRole("alert")`; `aria-live="polite"` is `role="status"`, so the locator finds nothing.

**Fix.** Tighten the Accessibility convention: "Exactly one live region, `role="status"` (`aria-live="polite"`), rendered by `App` and fed by `ErrorBanner`; it announces API failures and the empty-description message. `TodoInput` additionally sets `aria-invalid` and `aria-describedby` to that region. E2E locates errors with `getByRole("status")`."

### M-8. nginx resolves `api` at startup and dies if api is not yet up

**Units:** DOCKER (nginx) vs E2E (compose).

**Divergence.** `proxy_pass http://api:3000` is resolved when nginx starts. Compose builder without `depends_on` (or with it but without `service_healthy`, see C-3) starts `web` first; nginx exits with "host not found in upstream". With C-3 fixed it works, but only by accident of ordering. Also `proxy_pass http://api:3000/;` (trailing slash) is "unchanged" to a casual reader and strips `/api/`.

**Fix.** Add to AD-9: "`location /api/ { proxy_pass http://api:3000; }` with no trailing slash and no `rewrite`; `proxy_http_version 1.1`; `proxy_intercept_errors off`. `web` declares `depends_on: api: condition: service_healthy`."

### M-9. Readiness: `/healthz` says 200 while the API is still down

**Units:** E2E vs DOCKER.

**Divergence.** The E2E builder polls `http://localhost:8080/healthz` to know the stack is ready. It is a static 200 from nginx and says nothing about api. First spec runs against a 502. The alternative `http://localhost:8080/api/v1/health` works, but nothing says which.

**Fix.** Add to AD-15 (H-6): "Readiness for E2E is `docker compose --wait` (which honours both HEALTHCHECKs); the specs never poll `/healthz`."

---

## Low

### L-1. Trailing slashes

API: Fastify default `ignoreTrailingSlash: false`, so `GET /api/v1/todos/` is 404. WEB builds from constants so never emits one; a human curling will. Tighten AD-2: "Paths have no trailing slash; `ignoreTrailingSlash` stays false."

### L-2. Running nginx as non-root on the stock image

AD-11 requires non-root; the stock `nginx:1.29-alpine` master runs as root and `USER nginx` with the stock conf fails on `/var/run/nginx.pid` and cache dirs. Single unit, but the spine can save a cycle: "Web image base is `nginxinc/nginx-unprivileged:1.29-alpine` (listens on 8080, non-root by default); `nginx.conf` is copied to `/etc/nginx/conf.d/default.conf`."

### L-3. `better-sqlite3` native build on alpine

Prebuilt binaries may not match `linux-musl` on every host arch (the author's machine is arm64). Add to AD-5 or the Dockerfile rule: "api build stage installs `python3 make g++` before `npm ci`; the runtime stage copies `node_modules` from it."

### L-4. `NODE_ENV` has no stated effect

Listed as read, never used. Either drop it or state: "`NODE_ENV=production` in images; the API does not branch on it."

### L-5. DELETE 204 and `res.json()`

A client that always parses JSON throws on 204. Covered by H-3's `ApiError` normalisation; add "2xx with no body resolves to `undefined`."

### L-6. The restart journey needs `restart: unless-stopped` and the volume mount in both profiles

SM-2 restarts the api. Compose builder may omit `restart` or mount `/data` only in `test`. Add to AD-14: "both profiles mount a named volume at `/data`."

---

## What the spine already gets right (so nobody "fixes" it)

- Contract-first with TypeBox and the dependency arrows: no hole found in the type-level seam once H-1 and H-7 close.
- Layering and the `InMemoryTodoRepository` test boundary: no cross-unit divergence.
- Index-0 insertion plus server ordering: correct once H-8 pins the tie-break.
- Single origin via proxy: correct once M-8 pins the `proxy_pass` form and C-1 pins the bind address.

## Summary of ADs to add or change

| Action | AD | Hole(s) |
| --- | --- | --- |
| Tighten | AD-11 (bind `0.0.0.0`, health ownership, logging) | C-1, C-3, M-6 |
| Add | AD-13 Contract packaging and workspaces | C-2 |
| Add | AD-14 Compose topology (replaces the profile sentence) | C-4, L-6 |
| Tighten | AD-1 (patterns + builders, response schemas) | H-1, H-7 |
| Tighten | AD-2 (`:id` validation, PATCH body strictness, trailing slash) | H-2, M-2, L-1 |
| Tighten | AD-3 (not-found handler, code mapping, health exemption) | H-3, M-5 |
| Tighten | AD-7 (`ApiError`, copy ownership, NOT_FOUND handling, disable not queue) | H-3, H-4, H-5, M-4, L-5 |
| Tighten | AD-8 (`seq` tie-break, no limit) | H-8, M-3 |
| Tighten | AD-6 (client sends trimmed) | M-1 |
| Tighten | AD-9 (`proxy_pass` form, `depends_on`) | M-8 |
| Add | AD-15 E2E isolation and readiness | H-6, M-9 |
| Tighten | Conventions: Errors, Logging, Accessibility | H-4, M-6, M-7 |
