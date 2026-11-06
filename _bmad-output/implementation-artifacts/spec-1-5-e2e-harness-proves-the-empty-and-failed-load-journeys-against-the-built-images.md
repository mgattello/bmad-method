---
title: 'Story 1.5: E2E harness proves the empty and failed-load journeys against the built images'
type: 'feature'
created: '2026-10-26'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: 'e68f83c5cb3915fd5dedf33795e142c065ad686c'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-bmad-method-2026-10-26/ARCHITECTURE-SPINE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `npm run test:e2e` is an `echo` stub. Nothing exercises the shipped images end to end, so the Empty and Error States from Story 1.3 and the container contract from Stories 1.2 and 1.4 are proven only by hand.

**Approach:** Turn the `e2e` workspace into the Playwright harness per AD-11 and AD-12: a lifecycle runner (`docker compose -p todo-e2e down -v`, `WEB_PORT=8081 ... up --build --wait`, Playwright on Chromium against `http://localhost:8081`, `down -v` always), `playwright.config.ts` with `workers: 1` and no `webServer`, a shared `beforeEach` purge through the API, the empty-state and load-failure specs, and a stack spec that pins the container contract deferred from 1.2 and 1.4 (security headers, `/api/` passthrough, `/healthz`, one log line per request, persistence across `restart`, non-root uids). README gets the E2E section including the one-time `npx playwright install chromium`.

Decisions settled here (not intent gaps): the runner is `e2e/run.ts` executed by Node 24's built-in type stripping (no new dependency; `erasableSyntaxOnly` guarantees it runs), with a `finally` that always issues the closing `down -v` and exits with Playwright's status; specs assert user-visible copy as string literals because `e2e` never imports `apps/*`; `purgeTodos` accepts a 404 from `DELETE /api/v1/todos/:id` until Story 2.4 ships the route and throws on any other non-2xx; the stack spec shells out to `docker compose -p todo-e2e` with `WEB_PORT=8081` in its env (so `up --wait` never recreates `web` on another port); Chromium is installed by hand once and documented, never by the script; the stack spec's persistence test is the last test in the last spec file so its surviving row (no DELETE yet) cannot affect the journeys.

## Boundaries & Constraints

**Always:** `@playwright/test` pinned `1.64.1` in `e2e/package.json` devDependencies; `@todo/contract` `*` in dependencies, used for paths only (`TODOS_PATH`, `todoPath`, `HEALTH_PATH`). `e2e/playwright.config.ts`: `testDir: '.'`, `testMatch: '*.spec.ts'`, `fullyParallel: false`, `workers: 1`, `retries: 0`, `reporter: 'list'`, `use: { baseURL: 'http://localhost:8081', trace: 'retain-on-failure' }`, exactly one project `chromium` from `devices['Desktop Chrome']`, no `webServer`. Root `test:e2e` = `npm run build -w packages/contract && node e2e/run.ts`. `run.ts` runs every docker command from the repo root with `-p todo-e2e` and `WEB_PORT=8081`: `down -v`, then `up --build --wait`, then the Playwright CLI (`createRequire(import.meta.url).resolve('@playwright/test/cli')` under `process.execPath`, `cwd` = `e2e`, extra argv forwarded), then `down -v` in `finally`; exit code is Playwright's, or non-zero when `up` fails. Every spec file calls `purgeTodos(request)` in `test.beforeEach`: `GET TODOS_PATH`, then `DELETE todoPath(id)` per row, tolerating `[]` and a 404 DELETE. Messages are read through `page.getByRole('status')`. The load failure is `page.route` with a predicate (`url.pathname === TODOS_PATH`) that aborts GET only and continues other methods. `e2e/tsconfig.json` extends the base with `module: 'nodenext'`, `types: ['node']`, `noEmit: true`, `allowImportingTsExtensions: true`, `include: ['*.ts']`, and `e2e` gets a `typecheck` script so root `lint` covers it; ESLint and Prettier pass over `e2e/`. `README.md` E2E section and `docs/ai-integration-log.md` entry are part of done.

**Never:** a `webServer` block; a test endpoint or test-only flag in the API; polling `/healthz` or `/api/v1/health` for readiness in the runner (health comes from the two `HEALTHCHECK`s via `--wait`); Firefox or WebKit projects; `--with-deps`; installing browsers from `test:e2e`; edits under `apps/web/src`, `apps/api`, `packages/contract`, `docker-compose.yml`, the Dockerfiles or `nginx.conf`; writing `e2e/create.spec.ts` or `e2e/validation.spec.ts` (Story 2.2 owns them); new root devDependencies; `tsx`, `ts-node` or a bundler for the runner; `COMPOSE_PROJECT_NAME` instead of `-p`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Full run | `npm run test:e2e`, Chromium installed, Docker up | contract built; `todo-e2e` torn down with its volume; `todo-e2e-api` and `todo-e2e-web` built; both healthy; `empty-state`, `load-failure`, `stack` pass on `chromium`; `down -v`; exit 0; `docker compose -p todo-e2e ps -a` empty; the default `todo` project and port 8080 untouched | `up --build --wait` fails: `down -v` still runs, exit non-zero |
| Spec failure | any assertion fails | `down -v` still runs; exit status 1; trace under `e2e/test-results/` | N/A |
| Extra args | `npm run test:e2e -- --grep "Empty"` | forwarded to Playwright; only matching tests run; lifecycle unchanged | N/A |
| Purge, empty store | `GET /api/v1/todos` -> `[]` | no DELETE issued | N/A |
| Purge, rows but no DELETE route | rows exist, `DELETE /api/v1/todos/:id` -> 404 | tolerated; test proceeds | any other non-2xx on list or delete throws with status and body |
| Empty-state spec | fresh store, `page.goto('/')` | title `Todo`; `No todos yet. Add your first one above.` visible inside region `Todo List`; `Loading your todos` has count 0 and no `[aria-busy="true"]` remains; status region empty | N/A |
| Load-failure spec | route aborts `GET /api/v1/todos`, `page.goto('/')` | status region text is `We couldn't load your todos. Check your connection and try again.`; button `Retry` visible; empty-state text not visible; loading gone | after `page.unroute` and clicking `Retry`: empty-state text visible, status region empty |
| Stack: headers | `request.get('/')`, `request.get('/healthz')` | both 200; `x-content-type-options: nosniff`; `content-security-policy: default-src 'self'`; `/healthz` body `ok`; `/` body contains `<title>Todo</title>` | N/A |
| Stack: proxy passthrough | `GET /api/v1/health`, `GET /api/v1/todos`, `GET /api/v1/nope` | `{"status":"ok"}`; a JSON array; 404 `{ code: 'NOT_FOUND', message }` (the api envelope, so the path reached the api unchanged) | N/A |
| Stack: log line | after the health GET, `docker compose -p todo-e2e logs --no-log-prefix api` | a JSON line with `"url":"/api/v1/health"`, `"statusCode":200`, `method`, `responseTime` | N/A |
| Stack: non-root | `exec -T api id -u`, `exec -T web id -u`, `exec -T api stat -c %U /data` | neither `0`; `node` | N/A |
| Stack: persistence (last test) | `POST /api/v1/todos {description}` 201, then `docker compose -p todo-e2e restart` and `up --wait` | `GET /api/v1/todos` contains the same `id` and `description`; test timeout raised to 120 s | N/A |
| Missing Chromium | browsers not installed | Playwright's own error names `npx playwright install`; `down -v` still runs; exit non-zero | N/A |

</frozen-after-approval>

## Code Map

- `package.json` (root) -- `test:e2e` is `echo ...`; replace per Boundaries. `lint` already runs `npm run typecheck --workspaces --if-present`, so an `e2e` `typecheck` script is picked up with no root change. Run `npm install` to refresh `package-lock.json` (one root lockfile).
- `e2e/package.json` -- stub (`name @todo/e2e`, `type module`, no scripts). Add `scripts: { test: 'playwright test', typecheck: 'tsc' }`, `dependencies: { '@todo/contract': '*' }`, `devDependencies: { '@playwright/test': '1.64.1' }`.
- `e2e/README.md` -- stub; rewrite as a short file map plus how to run specs alone against a stack you started by hand (`WEB_PORT=8081 docker compose -p todo-e2e up --build -d --wait`, then `npm test -w e2e -- --headed`).
- `e2e/tsconfig.json` -- new, per Boundaries. `apps/api/tsconfig.test.json` is the `noEmit` precedent.
- `e2e/stack.ts` -- new, plain TS with no Playwright or contract import: `COMPOSE_PROJECT = 'todo-e2e'`, `WEB_PORT = '8081'`, `BASE_URL`, `REPO_ROOT` (from `import.meta.url`), `compose(args, { stdio? })` = `spawnSync('docker', ['compose', '-p', COMPOSE_PROJECT, ...args], { cwd: REPO_ROOT, env: { ...process.env, WEB_PORT } })` returning stdout and throwing on a non-zero status. Imported by `run.ts`, `playwright.config.ts` and `stack.spec.ts` with the explicit `./stack.ts` specifier (Node needs it; `allowImportingTsExtensions` lets `tsc` accept it). Verify Playwright's loader resolves the `.ts` specifier; if it does not, the Playwright-loaded files use `./stack.js` and `run.ts` keeps `./stack.ts`.
- `e2e/run.ts` -- new lifecycle runner per Boundaries; `stdio: 'inherit'` for every child.
- `e2e/support.ts` -- new: `purgeTodos(request: APIRequestContext)` and the copy literals `EMPTY_STATE_TEXT`, `LOAD_ERROR_TEXT`, `LOADING_TEXT`, `RETRY_LABEL`, `LIST_REGION_NAME = 'Todo List'`.
- `e2e/playwright.config.ts`, `e2e/empty-state.spec.ts`, `e2e/load-failure.spec.ts`, `e2e/stack.spec.ts` -- new, per the matrix. `stack.spec.ts` sorts after the two journey files; keep the persistence test last inside it and set `test.setTimeout(120_000)` on it.
- `README.md` -- Prerequisites: add the Chromium line; Commands row for `test:e2e`; the sentence "every root script except `test:e2e` does that for you" is now wrong (all do); Layout line for `e2e/`; replace `## E2E` ("Added in Story 1.5.") with: one-time `npx playwright install chromium`, what `npm run test:e2e` does step by step, the `todo-e2e` project and `todo-e2e-*` image names, port 8081 so the default stack on 8080 keeps running, where traces land, how to pass Playwright args, the purge-and-missing-DELETE note, and the stack spec's `restart`.
- `docs/ai-integration-log.md` -- append `## Story 1.5: ...` after the Story 2.1 entry with the Story 1.4 headings (`Date`, `Agent usage`, `Prompts`, `MCPs and tools`, `What the AI missed, and debugging`, `Decisions made while implementing`, `Review rounds`, `Limitations`). Include spec names, test counts and wall time.
- `docs/architecture.md` lines 39, 50, 169-171 -- already describe this harness; verify, do not rewrite.
- Read-only references: `apps/web/src/copy.ts` (the four literals above, exact text), `apps/web/src/App.tsx` (`<section aria-label="Todo List">`; `ErrorBanner` is the only `role="status"` and is always in the DOM, empty when no error; `LoadingState` renders `aria-busy="true"` with visually hidden `Loading your todos`), `apps/web/src/api/todos-client.ts` (a thrown `fetch` maps to `INTERNAL_ERROR`, so `route.abort()` yields the `INTERNAL_ERROR` copy), `apps/api/src/routes/todos.ts` (GET and POST only; unknown routes answer 404 `{ code: 'NOT_FOUND' }` from `app.ts`), `apps/api/src/app.ts` (`request completed` line carries `method`, `url`, `statusCode`, `responseTime`), `apps/web/nginx.conf` (headers with `always`; `/healthz` `text/plain` `ok`), `docker-compose.yml` (`name: todo`, `${WEB_PORT:-8080}`, no `image:` so `-p todo-e2e` names the images `todo-e2e-api`/`todo-e2e-web`), `.dockerignore` (`e2e` excluded; images unaffected; `npm ci` in the `deps` stage tolerates the absent workspace, verified in 1.4), `.gitignore` (`test-results/`, `playwright-report/` already ignored), `eslint.config.js` (`tseslint.configs.recommended` applies to `e2e/*.ts`; `test-results` ignored).
- Environment facts: Node 24.18 runs `node file.ts` with no warning (verified); `@playwright/test@1.64.1` is on the registry; `~/Library/Caches/ms-playwright` does not exist, so `npx playwright install chromium` is required; ports 8080 and 8081 are free and no compose project is running; Docker via Colima (`aarch64`), Compose v5.6.1.

## Tasks & Acceptance

**Execution:**
- [x] `e2e/package.json` -- scripts, `@todo/contract`, `@playwright/test` 1.64.1; `npm install` at the root; `npx playwright install chromium` -- AD-12, Stack table.
- [x] `e2e/tsconfig.json` -- per Boundaries -- root `lint` type-checks the harness.
- [x] `e2e/stack.ts` -- constants and `compose()` -- one home for the project name and port.
- [x] `e2e/run.ts` -- lifecycle per Boundaries with `finally` teardown and forwarded argv -- AD-11.
- [x] `e2e/playwright.config.ts` -- per Boundaries -- AD-11, AD-12.
- [x] `e2e/support.ts` -- `purgeTodos` and copy literals -- AD-12 purge rule.
- [x] `e2e/empty-state.spec.ts` -- matrix row "Empty-state spec" -- story AC 3.
- [x] `e2e/load-failure.spec.ts` -- matrix row "Load-failure spec" -- story AC 4.
- [x] `e2e/stack.spec.ts` -- headers, passthrough, log line, non-root, persistence (last) -- deferred-work entries from 1.2 and 1.4.
- [x] `package.json` (root) -- `test:e2e` per Boundaries -- story AC 1.
- [x] `e2e/README.md`, `README.md` -- per Code Map -- story AC 5 (NFR9).
- [x] `docs/ai-integration-log.md` -- Story 1.5 entry -- definition of done.

**Acceptance Criteria:**
- Given a clean checkout with Docker running and Chromium installed, when `npm run test:e2e` runs, then it exits 0, the output shows `down -v`, the image builds, `--wait` reaching healthy, the three spec files passing on `chromium`, and the closing `down -v`; afterwards `docker compose -p todo-e2e ps -a` lists nothing and `docker volume ls` has no `todo-e2e_todo-data`.
- Given the default stack is not running before the run, when the run finishes, then `docker compose ps -a` (project `todo`) is still empty and nothing listens on 8080.
- Given `npm run test:e2e -- --grep no-such-test`, when it runs, then Playwright reports no tests, the exit status is non-zero, and `docker compose -p todo-e2e ps -a` is empty afterwards.
- Given the workspace, when `npm run lint` and `npm test` run, then both pass, and `lint` type-checks `e2e` (break `e2e/support.ts` on purpose, see `lint` fail, restore).
- Given `git diff main --stat`, then nothing under `apps/`, `packages/`, `docker-compose.yml` changed, and `e2e/create.spec.ts` and `e2e/validation.spec.ts` do not exist.
- Given the README, when a new developer follows Prerequisites and the E2E section, then they can run `npm run test:e2e` with no other source.

## Implementation Notes

## Spec Change Log

## Review Triage Log

Round 1, three layers (blind-hunter 10, edge-case-hunter 8, verification-gap 1 gap + 2 other), 21 findings, 16 rows after grouping duplicates.

| # | Layer | Location | Claim | Verdict | Evidence | Route |
|---|---|---|---|---|---|---|
| 1 | blind, edge-case | `e2e/run.ts` `finally` | Closing `down -v` is unguarded; with Docker unreachable the second throw is uncaught, buries the first message and skips `process.exit` | medium | Confirmed: `compose()` throws on non-zero and nothing catches inside `finally`. Docker not running is an everyday case. | patch |
| 2 | blind, edge-case (x2) | `e2e/run.ts` | No SIGINT/SIGTERM handling: Ctrl-C kills Node before `finally`, leaving `todo-e2e` and its volume up on 8081 | medium | Confirmed: default SIGINT disposition terminates the parent; the README promises teardown "whatever happened". With a listener installed Node survives, the child exits from its own SIGINT, `spawnSync` returns and the catch/finally path runs. | patch |
| 3 | blind | `e2e/load-failure.spec.ts` Retry step | Empty State after Retry does not prove a re-request happened | low | The hook cannot reach `ready` without a fetch, so the app is proven indirectly; a `waitForResponse` makes the E2E prove it directly at two lines. | patch |
| 4 | blind | `e2e/stack.spec.ts` headers | Proxied `/api/` responses never checked for the security headers; a location-level `add_header` regression would pass | low | Confirmed: only `/` and `/healthz` are asserted. These headers are the deferred 1.4 check this harness exists to hold. | patch |
| 5 | verification-gap (other) | `e2e/stack.spec.ts` headers | Headers asserted on 200s only; dropping `always` in `nginx.conf` would pass | low | Confirmed; the proxied `nope` 404 covers it together with row 4. | patch |
| 6 | edge-case | `e2e/stack.spec.ts` log-line test | `compose logs` read right after the response can miss the line (`onResponse` logs after the reply is sent) | medium | Real race, microsecond window, in a harness every later story reuses; `expect.poll` is a direct correction. | patch |
| 7 | blind | `e2e/playwright.config.ts` | No `forbidOnly`; a stray `test.only` shrinks the suite while `test:e2e` exits 0 | low | Confirmed; one config line. | patch |
| 8 | edge-case | `e2e/README.md` hand-run flow | A second `npm test -w e2e` against the same stack fails `empty-state` on the restart row | low | Confirmed: the purge gets 404 until Story 2.4. One sentence fixes it. | patch |
| 9 | blind | spec ordering decision | Files sorting after `stack.spec.ts` (Story 2.2's `validation.spec.ts`) meet the restart row until DELETE ships | low | Real but inherent in 2.2 landing before 2.4: 2.2's own `create.spec.ts` leaves rows too. Resolved by Story 2.4's DELETE making the purge effective. | defer |
| 10 | verification-gap | `e2e/run.ts` exit-status and teardown contract | No automated check that a red suite or a failed `up` exits non-zero and still tears down | low | Pre-verified; both paths were exercised by hand in this story. Filed disposition: close when a pipeline first calls `test:e2e`. | defer |
| 11 | blind, edge-case | `e2e/stack.spec.ts` `apiLogLines` | A `{`-prefixed non-JSON line makes `JSON.parse` throw | low | pino emits JSON only; the line shape was never shown to occur. Rejected: unlikely, fix adds a guard. | reject |
| 12 | edge-case | `e2e/stack.ts` env | `COMPOSE_PROFILES=dev` exported in the shell starts the dev pair under `todo-e2e` | low | True of every compose invocation in this repo, including the default stack; needs a global export nobody documents. Rejected: unlikely, fix adds env surgery. | reject |
| 13 | edge-case | `e2e/support.ts` purge | A 2xx non-array body yields a raw TypeError instead of the status-and-body message | low | Non-2xx (nginx 502) is handled; a 2xx non-array from the api was never shown. Rejected: unlikely, fix adds a guard. | reject |
| 14 | blind | `e2e/stack.spec.ts` persistence | `--force-recreate api` (nginx one-time resolution) is untested | low | That scenario was triaged in Story 1.4 (row 14) as unlikely and deliberately not fixed; a test for an accepted risk adds a 10 s step. | reject |
| 15 | blind | spec frontmatter vs `sprint-status.yaml`; empty Implementation Notes / Change Log | Status vocabulary mismatch; matrix wording (`toHaveText` vs `toContainText`) and deviations unrecorded | false | The workflow sets `in-progress` and `done` in the sprint file and `in-review` only inside the spec; Implementation Notes are filled at present time. Fix edits this build's spec. | reject |
| 16 | verification-gap (other) | `package-lock.json` | Lockfile now carries Playwright under `e2e`; images still build | false | No defect: the layer verified the image build and that no install script runs. Informational. | reject |

## Verification

**Commands:**
- `npm install && npx playwright install chromium` -- expected: lockfile gains `@playwright/test` 1.64.1 under `e2e`; Chromium downloaded.
- `npm run lint && npm test` -- expected: green; lint output includes the `e2e` typecheck.
- `time npm run test:e2e` -- expected: exit 0; 3 files, all tests passed on `chromium`; record counts and wall time.
- `docker compose -p todo-e2e ps -a; docker volume ls | grep todo-e2e; docker compose ps -a; lsof -nP -iTCP:8080 -sTCP:LISTEN` -- expected: all empty.
- `npm run test:e2e -- --grep no-such-test; echo $?` -- expected: non-zero; project torn down.
- `git diff main --stat` -- expected: only `e2e/`, root `package.json`, `package-lock.json`, `README.md`, `docs/ai-integration-log.md` and this spec.
