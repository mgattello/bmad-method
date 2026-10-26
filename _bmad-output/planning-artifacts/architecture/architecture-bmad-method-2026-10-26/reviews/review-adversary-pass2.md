---
review: adversary-pass2
target: ../ARCHITECTURE-SPINE.md
date: 2026-10-26
lens: "Second pass. Close the first-pass criticals and highs, then attack the new operational rules (AD-1, AD-3, AD-5, AD-9, AD-11, AD-12, Conventions) with units that read only the spine and the PRD."
---

# Adversarial review, pass 2: Architecture Spine, Todo App

Verdict: the rewrite closes the domain-level and compose-shape holes (bind address, health ownership, error envelope, copy ownership, NOT_FOUND, E2E isolation, non-root volume, docs home). What it still does not pin is the Docker build recipe for an npm-workspaces monorepo and the dev-profile mechanics. Two compliant pairs still kill the graded `docker compose up` before a Todo exists, both inside the Dockerfiles.

Closure: 11 closed, 3 partial, 2 open (of 16 first-pass critical and high findings).
New: 2 critical, 6 high, 7 medium, 6 low.

Units in this pass: API (`apps/api`), WEB (`apps/web`), CONTRACT (`packages/contract`), COMPOSE (`docker-compose.yml`), DOCKER (two Dockerfiles + `nginx.conf`), E2E (`e2e/`). Each reads only the spine and the PRD.

---

## Part 1. Closure of first-pass critical and high findings

| # | Finding (pass 1) | Status | Closed by / what remains |
| --- | --- | --- | --- |
| adv C-1 | API binds loopback inside the container | CLOSED | AD-11: `HOST` default `0.0.0.0`, `listen({ host: HOST, port: PORT })`. |
| adv C-2 | Contract has no shipping format, name, or build order; Docker builds fail | PARTIAL | AD-1 pins name `@todo/contract`, ESM, `dist/`, `exports`/`types`, root build order, "each Dockerfile does the same". Not pinned: build context, which files each Dockerfile must COPY for `npm ci` to accept the workspace lockfile, whether `e2e` is a workspace, `.dockerignore`, dev-dependency pruning. See N-C1, N-H1, N-H2. |
| adv C-3 | Two owners of container health; no `curl` in api image | CLOSED | AD-11: HEALTHCHECK in Dockerfiles only, compose has no `healthcheck:`, api uses `node -e` + `fetch`, web uses busybox `wget`. |
| adv C-4 | `dev` profile topology undefined | PARTIAL | AD-11 names `api-dev`/`web-dev`, ports, mounts, `VITE_API_PROXY_TARGET`. Not pinned: the image and command each dev service runs, where `node_modules` come from under a bind mount, Vite `server.host`, who rebuilds `contract/dist`. See N-H3, N-H4, N-M1. |
| adv H-1 | Path constants: Fastify pattern vs URL builder | OPEN | AD-1 still says "route path constants" and the seed says `src/routes.ts # path constants`. CONTRACT exports `TODO_BY_ID = "/api/v1/todos/:id"`; WEB and E2E must `.replace(":id", …)` or concatenate, which is the literal path AD-1 forbids. Pass-1 wording still applies. |
| adv H-2 | Malformed `:id`: 400 or 404 | CLOSED | AD-2: malformed or absent `:id` is `NOT_FOUND`. Residual: CONTRACT must therefore not put `format: "uuid"` on the params schema (that yields 400). One clause would make it explicit; see N-L1. |
| adv H-3 | Non-envelope responses the client meets | CLOSED | AD-3: `setNotFoundHandler`, library codes rewritten, client normalises nginx 502 / non-JSON / network to `INTERNAL_ERROR`, never throws past its boundary. |
| adv H-4 | Error copy has two authors | CLOSED | AD-3 + Conventions Errors: copy authored in `apps/web`, keyed by action + code, `message` never shown. |
| adv H-5 | 404 on PATCH/DELETE from another tab | CLOSED | AD-7: `NOT_FOUND` on PATCH or DELETE removes the item locally and shows the message. |
| adv H-6 | E2E isolation per run and per spec | CLOSED | AD-12 (`workers: 1`, `beforeEach` purge via API) + AD-11 (`-p todo-e2e`, `down -v` before `up`). |
| adv H-7 | `completed` reaches the client as `0`/`1` | PARTIAL | AD-2 types `completed: boolean`; Conventions map snake_case columns "in the repository". Nothing says the repository maps `INTEGER` to boolean or that routes attach contract `response` schemas; a repository that returns `SELECT *` rows unchanged still "maps columns". See N-M2. |
| adv H-8 | Same-millisecond `createdAt`, random tie-break | OPEN | AD-8 chose `ORDER BY created_at DESC, id DESC` with a UUID v4 `id`. Deterministic across reloads, but not insertion order: two creates in one millisecond (trivial under `fastify.inject`, possible from a Playwright loop) can list the older first, while AD-8 also mandates client index-0 insertion. The integration suite and the E2E "create A then B, reload" spec can disagree with the client. Pass-1 `seq` fix (or `created_at` as a monotonic nanosecond/`hrtime` string) still applies. |
| rec C1 | `dev` as default profile cannot be expressed | CLOSED | AD-11: unprofiled `api`/`web` are the built images; `dev` profile adds `*-dev`. |
| rec H1 | E2E isolation undecided | CLOSED | AD-12 + AD-11 (same as adv H-6). |
| rec H2 | Non-root user vs root-owned `/data` volume | CLOSED | AD-5: api Dockerfile creates and `chown`s `/data` before `USER`. |
| rec H3 | Graded docs have no home | CLOSED | Conventions Documentation homes + Structural Seed (`README.md`, `docs/architecture.md`, `docs/ai-integration-log.md`, `docs/qa/*`). |

---

## Part 2. New holes in the operational rules

For each: the two units, the compliant choices, the failure, and the wording that closes it.

### Critical

#### N-C1. Docker build context is unstated; the compose builder and the Dockerfile builder pick different roots

**Units:** COMPOSE vs DOCKER.

AD-1 says each Dockerfile builds `contract` first "inside the image", so the DOCKER builder writes `COPY package.json package-lock.json ./`, `COPY packages/contract packages/contract`, `COPY apps/api apps/api` from the repo root. The COMPOSE builder, seeing the Dockerfile live at `apps/api/Dockerfile` (Structural Seed), writes `build: ./apps/api`, the idiomatic form. Context is now `apps/api`; `packages/contract` and the root lockfile are outside it; `COPY` fails and `docker compose up` dies at build. The reverse pair (Dockerfile written for an `apps/api` context, compose using root) fails the same way with `COPY apps/api` not found. Both units obey every AD.

Even with the root context, a second trap: with root context and no `.dockerignore`, the host `node_modules` (darwin-arm64 native `better-sqlite3`), `apps/*/dist`, `_bmad-output/` and `.git` are sent to the daemon on every build; `npm ci` then deletes `node_modules` anyway, but the host-built `packages/contract/dist` is copied in and may mask a broken contract build.

**Fix.** Add to AD-1 (or a new AD-13 "Image build recipe"):

> Both Dockerfiles are built with the repository root as context: compose declares `build: { context: ., dockerfile: apps/api/Dockerfile }` and `build: { context: ., dockerfile: apps/web/Dockerfile }`. A root `.dockerignore` excludes `**/node_modules`, `**/dist`, `.git`, `e2e/`, `docs/`, `_bmad*`, `*.md`. Every `COPY` path in a Dockerfile is repo-root relative.

#### N-C2. `nginx.conf` copied to `/etc/nginx/nginx.conf` replaces the unprivileged image's main config; nginx cannot start as non-root

**Units:** DOCKER (Dockerfile) vs DOCKER (nginx.conf) vs AD-11.

The seed names the file `apps/web/nginx.conf` and AD-11 says `/healthz` is "a static `200` location in `nginx.conf`". The natural Dockerfile line is `COPY apps/web/nginx.conf /etc/nginx/nginx.conf` (same basename, same path). That overwrites the main config `nginxinc/nginx-unprivileged` ships, which is where the image sets `pid /tmp/nginx.pid`, points every `*_temp_path` at `/tmp`, removes the `user` directive, and includes `conf.d/*.conf`. Two outcomes, both fatal:

- The builder wrote a `server { … }` block only: nginx exits with `"server" directive is not allowed here`.
- The builder wrote a full `events {} http { server {} }` file: nginx starts as uid 101, tries `/var/run/nginx.pid` and `/var/cache/nginx/client_temp`, gets `Permission denied`, exits. The web container never becomes healthy, `--wait` and E2E time out, and the graded `docker compose up` shows `web` exited.

The correct target is `/etc/nginx/conf.d/default.conf` (a `server {}` block listening on `8080`), which is exactly what the image's own main config includes. The spine pins the image (pass-1 L-2, M4) but not the path, and the file name invites the wrong one.

**Fix.** Add to AD-11 (web bullet) and rename the seed entry:

> The web image copies `apps/web/nginx.conf` to `/etc/nginx/conf.d/default.conf`; it contains one `server { listen 8080; … }` block and nothing outside `server`. `/etc/nginx/nginx.conf` from the base image is never replaced. Seed: `apps/web/nginx.conf  # server block only -> /etc/nginx/conf.d/default.conf`.

### High

#### N-H1. `npm ci` in the image needs every workspace manifest, not just the app being built

**Units:** DOCKER vs root `package.json` (CONTRACT/COMPOSE builder who owns root).

Conventions: "npm workspaces; one root `package-lock.json`". The lockfile records every workspace (`apps/web`, `e2e`, …) as `link: true` entries. The api Dockerfile COPYs root `package.json`, `package-lock.json`, `packages/contract`, `apps/api` and runs `npm ci --workspace=apps/api`. npm's sync check still loads the whole workspace tree from the root `workspaces` globs; the lock references `apps/web` and `e2e` that are absent from the context, and `npm ci` aborts with "package.json and package-lock.json are not in sync" (or installs with a resolved tree that differs from the lock, depending on npm version). The builder who copies `.` instead ships `apps/web` sources into the api image and pulls React into the api `node_modules`. Nothing in the spine says which workspaces exist (is `e2e` one?) or what to COPY.

**Fix.** Add to the Package manager convention and the image recipe:

> Workspaces are exactly `packages/contract`, `apps/api`, `apps/web`, `e2e`, listed in that order in root `package.json`. Each Dockerfile's deps stage copies root `package.json`, `package-lock.json`, and the four workspace `package.json` files (at their paths, no sources) before `npm ci --workspace=<own app> --workspace=packages/contract --include-workspace-root=false`; sources are copied afterwards.

#### N-H2. Runtime stage: the `@todo/contract` symlink dangles and dev-dependency pruning re-triggers the native build

**Units:** DOCKER vs CONTRACT (packaging).

npm links `node_modules/@todo/contract -> ../../packages/contract`. The DOCKER builder's runtime stage, following "multi-stage, non-root", does `COPY --from=build /app/node_modules ./node_modules` and `COPY --from=build /app/apps/api/dist ./dist` and runs `node dist/server.js`. The symlink is copied as a symlink; `packages/contract` is not in the runtime image; `ERR_MODULE_NOT_FOUND: @todo/contract`. The container crash-loops and never reports healthy.

Second pair: the builder who prunes with `npm ci --omit=dev` in the runtime stage re-runs `better-sqlite3`'s install script. On `node:24-alpine` (musl) the prebuilt-binary lookup can miss and fall back to `node-gyp`, which needs `python3 make g++` that the runtime stage does not have. Build fails. The builder who instead `npm prune --omit=dev` in the build stage and copies the pruned tree is fine, but the spine lets either happen.

**Fix.** Add to the image recipe:

> api runtime stage preserves the workspace layout: `WORKDIR /app`, `COPY --from=build /app/node_modules`, `/app/packages/contract/package.json`, `/app/packages/contract/dist`, `/app/apps/api/package.json`, `/app/apps/api/dist`, and if present `/app/apps/api/node_modules`. `CMD ["node", "apps/api/dist/server.js"]`. The build stage installs `python3 make g++` before `npm ci` and runs `npm prune --omit=dev` after building; the runtime stage never runs `npm ci` or `npm install`.

#### N-H3. `api-dev` bind mounts: host `node_modules` inside a Linux container, or no `node_modules` at all

**Units:** COMPOSE vs DOCKER vs README.

AD-11: `api-dev` runs `tsx watch` with bind-mounted `apps/api` and `packages/contract`. Three compliant shapes, all dead:

- `image: node:24-alpine`, `volumes: [./apps/api:/app/apps/api, ./packages/contract:/app/packages/contract]`, `command: npx tsx watch src/server.ts`: no root `node_modules` in the container, `tsx` not found.
- Same with `./:/app` (whole repo): the host's `node_modules` is mounted, including darwin-arm64 `better_sqlite3.node`; Node on Alpine throws `invalid ELF header` on first `require`.
- `build: { target: build }` from the api Dockerfile plus the mounts: works only if the Dockerfile has a stage named exactly that and if the mount does not shadow the image's `apps/api/node_modules`.

**Fix.** Add to AD-11 dev bullet:

> `api-dev` and `web-dev` use `image: node:24-alpine`, `working_dir: /app`, bind-mount the repo root (`./:/app`) and mask `node_modules` with anonymous volumes (`/app/node_modules`, `/app/apps/api/node_modules`, `/app/apps/web/node_modules`, `/app/packages/contract/node_modules`); their `command` is `sh -c "npm ci && npm run build -w packages/contract && npm run dev -w apps/api"` (web: `-w apps/web`). Dev dependencies are installed inside the container, never from the host.

#### N-H4. Vite dev server inside `web-dev` is unreachable on the published port

**Units:** WEB (vite.config) vs COMPOSE.

AD-11 publishes `5173` from `web-dev`. Vite's default `server.host` is `localhost`; inside the container the dev server binds `127.0.0.1:5173`, the published port forwards to the container's eth0, and the browser gets connection reset. The WEB builder has no reason to set `host: true` (AD-9 only mentions the proxy target). Pass-1 C-4's fix included `server.host = true`; the rewrite dropped it.

**Fix.** Add to AD-9:

> `vite.config.ts` sets `server: { host: true, port: 5173, strictPort: true, proxy: { "/api": { target, changeOrigin: false } } }`.

#### N-H5. `-p todo-e2e` publishes 8080 while the default project is up: port collision on the grader's own flow

**Units:** E2E (runner script) vs COMPOSE vs README.

AD-11's E2E project namespaces volumes and networks but not host ports. The graded flow is `docker compose up` (default project, `8080`), then `npm run test:e2e`. The runner's `docker compose -p todo-e2e up --build --wait` fails with `Bind for 0.0.0.0:8080 failed: port is already allocated`, and the `down -v` that precedes it only cleans `todo-e2e`. The E2E suite is "5 passing Playwright tests" in the rubric; a grader who follows the README order gets zero.

**Fix.** Add to AD-11 and AD-12:

> compose publishes web on `${WEB_PORT:-8080}:8080`. The `test:e2e` runner exports `WEB_PORT=8081`, and `playwright.config.ts` sets `baseURL` to `http://localhost:${process.env.WEB_PORT ?? "8081"}`. The two projects can run side by side.

#### N-H6. TypeScript 6.0 defaults: `types: []`, `module: esnext` break the api workspace unless the root base says otherwise

**Units:** API vs root `tsconfig.base.json` (CONTRACT or whoever owns root) vs WEB.

Conventions pin TypeScript 6.0.3 and "`tsconfig` per workspace extending a root base" with `erasableSyntaxOnly` on (the flag exists since 5.8, fine). TS 6.0 changed defaults: `strict: true`, `module: "esnext"`, `types: []`, `noUncheckedSideEffectImports: true`. Consequences for compliant units:

- API relies on `@types/node` being auto-included (as in every prior TS). With `types: []` by default, `process.env`, `crypto.randomUUID` and `node:` imports fail to type-check in the api and contract builds. The root base author does not know to add `"types": ["node"]` because the spine never mentions it.
- `module: "esnext"` resolves with `moduleResolution: "bundler"` semantics by default; `node dist/server.js` at runtime needs `nodenext` (explicit `.js` extensions on relative imports) or the api runtime fails with `ERR_MODULE_NOT_FOUND` on `./app` while `tsc` and Vite were happy.
- `@types/node 26.6.5` (Stack) describes Node 26 APIs on a Node 24.22.1 runtime: code that compiles can call an API that does not exist in the container.

**Fix.** Add to the TypeScript convention and Stack:

> Root base: `strict`, `erasableSyntaxOnly`, `verbatimModuleSyntax`, `isolatedModules`, `skipLibCheck`. `apps/api` and `packages/contract`: `module` and `moduleResolution` `nodenext`, `types: ["node"]`, relative imports carry `.js`. `apps/web` and `e2e`: `module: esnext`, `moduleResolution: bundler`, `types: ["vite/client"]` (web). `@types/node` is pinned to the `24.x` line matching the runtime.

### Medium

#### N-M1. Nobody rebuilds `packages/contract/dist` under `tsx watch`

**Units:** COMPOSE (dev profile) vs CONTRACT (packaging) vs API (dev loop).

AD-1 points `exports` at `dist/`. `api-dev` bind-mounts `packages/contract` and runs `tsx watch` over `apps/api`. Editing `packages/contract/src/*` changes nothing the api sees until someone runs `tsc` in contract; on a fresh clone `dist/` does not exist and `api-dev` fails on import. Vite in `web-dev` has the same dependency (it serves `dist/index.js`). The dev profile's hot reload promise is one third true.

**Fix.** Add to AD-11 dev bullet: "`api-dev`'s command runs `npm run build -w packages/contract` before `tsx watch`, and `contract` exposes `dev: tsc --watch`; a `contract-dev` service (same image, `./:/app`, `command: npm run dev -w packages/contract`) runs under the `dev` profile and both `*-dev` services `depends_on` it with `condition: service_started`."

#### N-M2. `completed` as `0`/`1` and response serialisation (pass-1 H-7 residue)

**Units:** API (repository) vs WEB.

Conventions map column names in the repository, but nothing requires value mapping or contract `response` schemas on routes. `SELECT * ` rows reach the wire with `completed: 1`; WEB's `todo.completed === true` cue never fires.

**Fix.** Add to AD-4: "`SqliteTodoRepository` maps each row to `Todo` explicitly (`completed: row.completed === 1`); no row object leaves the repository." Add to AD-1: "Every route attaches the contract `response` schema for each status it emits."

#### N-M3. `VITE_API_PROXY_TARGET` is read where Vite does not provide it, and is also inlined into the bundle

**Units:** WEB (vite.config) vs `.env.example` / README.

Vite does not load `.env*` into `process.env` while evaluating `vite.config.ts`; `process.env.VITE_API_PROXY_TARGET` is set only when the shell or compose `environment:` exports it. Under compose `dev` it works; `npm run dev` on the host with the documented `.env.example` copied to `.env` silently falls back to `localhost:3000`, and the README's "configure via `.env`" claim is false for this var. Separately, the `VITE_` prefix makes Vite expose the value as `import.meta.env.VITE_API_PROXY_TARGET` in client code; any WEB builder who reads it there builds absolute URLs, violating AD-9 by following its own var name.

**Fix.** Rename to `API_PROXY_TARGET` (no prefix, so it is never exposed to client code) in AD-9, AD-11, Conventions Config and `.env.example`; `vite.config.ts` reads it with `loadEnv(mode, process.cwd(), "")` merged over `process.env`.

#### N-M4. Playwright `webServer` and the runner script both own the compose lifecycle

**Units:** E2E (playwright.config) vs E2E (root `test:e2e`).

AD-11 says "the runner does `down -v` before `up`" without saying what the runner is. The E2E builder uses Playwright's `webServer: { command: "docker compose -p todo-e2e up --build --wait", url, reuseExistingServer: false }`, the documented pattern, and the root script author also wraps `docker compose … up` around `playwright test`. Playwright's `webServer` refuses to start when the port is already bound and `reuseExistingServer` is false; the run errors before the first spec. With `reuseExistingServer: true` the compose `down -v` after tests never runs because `webServer` teardown kills a process that already exited.

**Fix.** Add to AD-12: "`playwright.config.ts` declares no `webServer`. The root `test:e2e` script is the only owner of the stack: `docker compose -p todo-e2e down -v; docker compose -p todo-e2e up --build --wait && playwright test -c e2e; status=$?; docker compose -p todo-e2e down -v; exit $status`."

#### N-M5. HEALTHCHECK timing is unspecified; the stack takes 30 seconds to admit it is healthy

**Units:** DOCKER vs COMPOSE vs E2E.

Compose does honour the image's `HEALTHCHECK` for `depends_on: condition: service_healthy` (confirmed). But without `--interval`, Docker's defaults are interval 30s, timeout 30s, start-period 0s, retries 3. `web` waits up to 30s for the first api probe; `up --wait` for E2E adds the same for web; a slow cold start that misses three probes at 30s spacing takes 90s to flip to `unhealthy`. Not fatal, but the "both containers report healthy" gate looks hung, and the api probe (`node -e` + fetch) targets `3000` while AD-11 lets compose override `PORT`.

**Fix.** Add to AD-11: "`HEALTHCHECK --interval=5s --timeout=3s --start-period=10s --retries=5` on both images. Compose never overrides `PORT` or `HOST` for `api`; the probe URL is fixed."

#### N-M6. Root `build` fan-out "in dependency order" is not what `npm run build --workspaces` does

**Units:** root `package.json` author vs CI/Docker.

npm runs `--workspaces` scripts in the order of the `workspaces` array, not by dependency graph. A root `package.json` with `workspaces: ["apps/*", "packages/*", "e2e"]` and `"build": "npm run build --workspaces --if-present"` builds `apps/api` before `packages/contract` on a fresh clone and fails on the missing `dist/index.d.ts`. The convention's "dependency order" is a promise only the author who already knows this can keep.

**Fix.** Conventions Package manager: "`workspaces` lists `packages/contract` first; root scripts call workspaces explicitly: `build: npm run build -w packages/contract && npm run build -w apps/api -w apps/web`; `test` likewise after `build -w packages/contract`."

#### N-M7. Health route and the global error handler: `response` schema and the 503 path

**Units:** API (health route) vs API (error handler) vs CONTRACT.

AD-3 exempts health from the envelope and AD-11 says it "returns 200 only on success, else 503". Fine in prose; two implementation traps remain. If `SELECT 1` throws and the route does not catch, `setErrorHandler` emits `500 { code: INTERNAL_ERROR }`: the HEALTHCHECK still fails (correct), but the contract's documented `503 { status: "degraded" }` never happens and the integration spec written from AD-2 fails. If N-M2's "attach response schemas to every route" is adopted, CONTRACT must export health schemas for `200` and `503` or Fastify strips `status` from the body. The web client never calls health, so the AD-3 exemption creates no client-side conflict (confirmed).

**Fix.** Add to AD-11: "the health handler wraps `SELECT 1` in try/catch and replies `503 { status: "degraded" }` itself; it never reaches `setErrorHandler`. `contract` exports `HealthResponse` for both statuses."

### Low

#### N-L1. `:id` params schema must not carry `format: "uuid"`

AD-2 decides malformed ids are `NOT_FOUND`; a CONTRACT builder adding `Type.String({ format: "uuid" })` to params produces `400`. Add to AD-2: "the params schema types `id` as plain `string`; no format."

#### N-L2. `synchronous = FULL` + WAL is fine, but `synchronous` is per-connection

`better-sqlite3` exposes both via `db.pragma("journal_mode = WAL")` and `db.pragma("synchronous = FULL")` (confirmed). `journal_mode` persists in the file; `synchronous` does not and must be set on every open. Add "both pragmas run on every connection open" to AD-5. Also note the `-wal`/`-shm` siblings for the integration-test temp-file cleanup.

#### N-L3. `wget` in `nginx-unprivileged:alpine`

Busybox `wget` is present and exits non-zero on a non-2xx, so the web probe is sound. The api probe's `node -e` one-liner needs the shell form of `HEALTHCHECK CMD` to avoid JSON-quoting the JS; say so.

#### N-L4. nginx caches the resolved `api` IP

`proxy_pass http://api:3000` resolves once at start. `docker compose up --build` after an api change recreates `api` and, because of `depends_on`, recreates `web` too, so this is safe in the default flow; `docker compose restart api` keeps the IP. Only `docker compose up -d api --force-recreate` alone can leave nginx with a stale IP. Low; optionally pin `resolver 127.0.0.11 valid=10s;` with a variable upstream in AD-9.

#### N-L5. `typebox` v1 and the Fastify type provider

Stack lists `typebox 1.4.3` (the v1 package name) and `@fastify/type-provider-typebox 6.3.0` (which moved to TypeBox v1 in 6.0). Consistent. Add one line to AD-1 so CONTRACT does not install `@sinclair/typebox` from older docs: "the TypeBox package is `typebox` (v1), not `@sinclair/typebox`."

#### N-L6. `.env` at root does not reach containers by itself

Compose reads root `.env` for interpolation only; `HOST`, `PORT`, `DB_PATH`, `LOG_LEVEL` reach the api container only via `environment:` or `env_file:`. Say in AD-11 which (recommend `environment:` with `${VAR:-default}` interpolation so `.env.example` is honest).

---

## What is now sound (do not reopen)

- Error envelope end to end (AD-3 + AD-7 + Errors convention).
- Health ownership and probe commands (AD-11), compose honouring image HEALTHCHECK for `service_healthy`.
- Non-root api with `/data` prepared before `USER` (AD-5).
- E2E isolation at the spec level with `workers: 1` and `beforeEach` purge; nothing races.
- Default stack = built images; `dev` profile is additive (AD-11).

## Summary of ADs to add or change

| Action | AD | Holes |
| --- | --- | --- |
| Add | AD-13 Image build recipe (context, `.dockerignore`, COPY list, prune, runtime layout) | N-C1, N-H1, N-H2 |
| Tighten | AD-11 web bullet (`conf.d/default.conf`) | N-C2 |
| Tighten | AD-11 dev bullet (image, command, `node_modules` masking, contract watch) | N-H3, N-M1 |
| Tighten | AD-9 (Vite `server.host`, `API_PROXY_TARGET` rename, `loadEnv`) | N-H4, N-M3 |
| Tighten | AD-11 + AD-12 (`WEB_PORT`, runner owns compose, no `webServer`, HEALTHCHECK timings) | N-H5, N-M4, N-M5 |
| Tighten | Conventions TypeScript + Stack (`types: ["node"]`, `nodenext` for api, `@types/node@24`) | N-H6 |
| Tighten | Conventions Package manager (workspace list and order, explicit script order) | N-H1, N-M6 |
| Tighten | AD-1 (path pattern + URL builder, response schemas, `typebox` package) | adv H-1, N-M2, N-L5 |
| Tighten | AD-8 (`seq` or monotonic tie-break) | adv H-8 |
| Tighten | AD-4 / AD-11 (boolean mapping, health try/catch) | N-M2, N-M7 |
