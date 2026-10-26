---
title: 'Story 1.4: Run the whole stack with docker compose up'
type: 'feature'
created: '2026-10-26'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: 'a9d69930f8039a768c1926f8e678984985f1711d'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-bmad-method-2026-10-26/ARCHITECTURE-SPINE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The API (1.2) and the web shell (1.3) only run from `npm` on a developer machine. There are no images, no compose file and no proxy, so `docker compose up` (the graded command) does nothing and the browser cannot reach the API from the web origin.

**Approach:** Add `apps/api/Dockerfile` and `apps/web/Dockerfile` (stages `deps`, `build`, `runtime`, built from the repo root per AD-13), `apps/web/nginx.conf` (static build, `/api/` proxy, `/healthz`, security headers per AD-9), and `docker-compose.yml` with the unprofiled built images plus a `dev` profile (AD-11). Each Dockerfile owns its `HEALTHCHECK`; `web` waits for `api` healthy; `/data/todos.db` lives on the named volume `todo-data`.

Decisions settled here (not intent gaps): compose project `name: todo`; `api-dev` uses `DB_PATH=/data/dev.db` on the same `todo-data` volume so it never shares a SQLite file with `api` when both run under `--profile dev`; dev services run `node:24` (Debian, toolchain included) so `npm ci` can compile `better-sqlite3` inside the container; `concurrently` 10.0.6 is added to root devDependencies with a root `dev:api` script that runs contract `tsc --watch` beside api `tsx watch`.

## Boundaries & Constraints

**Always:** Build context `.` for both images; root `.dockerignore` keeps excluding `node_modules`, `dist`, `_bmad*`, `docs`, `e2e`, `.git`. `deps` stage: root `package.json` + `package-lock.json` + the three workspace `package.json` files, `apk add --no-cache python3 make g++`, full `npm ci`. `build` stage: contract then app, `npm prune --omit=dev`. api runtime: `node:24-alpine`, keeps the `/app` workspace layout (root `node_modules`, `packages/contract/{package.json,dist}`, `apps/api/{package.json,dist}`), no `npm` at runtime, `mkdir -p /data && chown node:node /data` before `USER node`, `CMD ["node","apps/api/dist/server.js"]`. web runtime: `nginxinc/nginx-unprivileged:1.30-alpine`, `apps/web/dist` to `/usr/share/nginx/html`, `apps/web/nginx.conf` to `/etc/nginx/conf.d/default.conf` as a `server {}` block only. `HEALTHCHECK --interval=5s --timeout=3s --start-period=5s --retries=10` in each Dockerfile only. Compose: no `healthcheck:`, no `ports` on `api`, `web` publishes `${WEB_PORT:-8080}:8080` and uses `depends_on: api: condition: service_healthy`. nginx: `location /api/ { proxy_pass http://api:3000; }` with no trailing slash and no `rewrite`, `proxy_http_version 1.1`, `proxy_intercept_errors off`; server-level `add_header X-Content-Type-Options nosniff` and `Content-Security-Policy "default-src 'self'"`; `/healthz` returns 200 with `return`, never with its own `add_header` (nginx locations with `add_header` stop inheriting the server headers). API enables no CORS. No source edits under `apps/api/src`, `apps/api/test`, `packages/contract` (Story 2.1 is in flight there).

**Never:** A prod profile, TLS, restart policies, a reverse proxy other than nginx, CORS, config files for the API, `healthcheck:` in compose, copying host `node_modules` into any image or dev container, a `dev` default profile, Postgres, migrations.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Bare up | `docker compose up --build -d --wait` | api healthy first, then web healthy; `GET :8080/` serves the shell with `nosniff` and CSP headers | `--wait` fails if either healthcheck never passes |
| Proxy | `GET :8080/api/v1/health` | `{"status":"ok"}` 200 from api, path unchanged | api down: nginx 502, web client maps to INTERNAL_ERROR |
| Health page | `GET :8080/healthz` | 200 `ok`, `text/plain`, same headers as `/` | N/A |
| Persistence | Todo rows exist, `docker compose restart` | same rows after restart; `down -v` is the only loss path | N/A |
| Logs | `docker compose logs api` after a request | one JSON line per request with `method`, `url`, `statusCode`, `responseTime` | N/A |
| Dev profile | `docker compose --profile dev config` | validates; `api-dev` 3000, `web-dev` 5173, `API_PROXY_TARGET=http://api-dev:3000`, anonymous volumes over the four `node_modules` | N/A |

</frozen-after-approval>

## Code Map

- `apps/api/src/server.ts` -- reads `HOST`, `PORT`, `DB_PATH` (default `/data/todos.db`), `LOG_LEVEL`, `NODE_ENV`; `mkdirSync(dirname(dbPath))`; do not change.
- `apps/api/src/app.ts` -- `onResponse` hook logs one completion line; `LOG_LEVEL=info` in compose keeps it visible; do not change.
- `apps/api/src/routes/health.ts` -- `GET /api/v1/health` 200 `{status:'ok'}` or 503; target of the api HEALTHCHECK.
- `apps/api/tsconfig.json` -- `outDir: dist`, so the entry is `apps/api/dist/server.js`.
- `apps/web/vite.config.ts` -- `server.host: true`, proxy `^/api/` to `API_PROXY_TARGET`; already correct for `web-dev`.
- `apps/web/package.json` -- `build` is `tsc -b && vite build` (type-checks tests, so dev deps must be present in `build` stage); `dev` is `vite`.
- `packages/contract/package.json` -- `build: tsc`, `dev: tsc --watch`; `exports` point at `dist/`.
- `package.json` (root) -- workspaces `packages/*`, `apps/*`, `e2e`; add `concurrently` 10.0.6 to devDependencies and `"dev:api": "concurrently -k -n contract,api \"npm run dev -w packages/contract\" \"npm run dev -w apps/api\""`; run `npm install` to update `package-lock.json`.
- `.dockerignore` -- already excludes everything AD-13 lists plus coverage, `.env`, db files; verified `npm ci` succeeds without the `e2e` directory (workspace path absent is tolerated). Do not change.
- `.env.example` -- already documents all seven variables; add one line noting `api-dev` uses `/data/dev.db`.
- `README.md` -- replace the `## Docker` placeholder ("Added in Story 1.4.") and the Prerequisites line.
- `docs/ai-integration-log.md` -- append `## Story 1.4: ...` with the same headings as 1.3.
- `docs/architecture.md` lines 148-160 -- compose table already matches; no change.
- Platform: Docker via Colima (`aarch64`, Compose v5.6.1); no arm64 prebuild of `better-sqlite3` was found, so the `deps` toolchain compiles it.

## Tasks & Acceptance

**Execution:**
- [x] `apps/api/Dockerfile` -- stages per Boundaries; `build` copies `packages/contract` and `apps/api` (sources, tsconfigs), runs `npm run build -w packages/contract && npm run build -w apps/api && npm prune --omit=dev`; `runtime` sets `ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 DB_PATH=/data/todos.db LOG_LEVEL=info`, `EXPOSE 3000`, HEALTHCHECK `CMD node -e "fetch('http://127.0.0.1:3000/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"` -- AD-13, AD-11.
- [x] `apps/web/Dockerfile` -- same `deps` layer text as api (shared cache); `build` copies `packages/contract` and `apps/web`, builds contract then web; `runtime` from `nginxinc/nginx-unprivileged:1.30-alpine`, copies `dist` and `nginx.conf`, `EXPOSE 8080`, HEALTHCHECK `CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1` -- AD-13.
- [x] `apps/web/nginx.conf` -- `server { listen 8080; root /usr/share/nginx/html; add_header ...; location = /healthz { default_type text/plain; return 200 'ok'; } location /api/ { proxy_pass http://api:3000; proxy_http_version 1.1; proxy_intercept_errors off; proxy_set_header Host $host; } location / { try_files $uri /index.html; } }` -- AD-9.
- [x] `docker-compose.yml` -- `name: todo`; `api` (build context `.`, dockerfile `apps/api/Dockerfile`, env block, `volumes: [todo-data:/data]`); `web` (build, `ports: ["${WEB_PORT:-8080}:8080"]`, `depends_on`); `api-dev` and `web-dev` under `profiles: [dev]` with `image: node:24`, `working_dir: /app`, `volumes: [.:/app, /app/node_modules, /app/packages/contract/node_modules, /app/apps/api/node_modules, /app/apps/web/node_modules]`, `api-dev` also `todo-data:/data`, env `DB_PATH=/data/dev.db`, `command: sh -c "npm ci && npm run dev:api"`, ports `3000:3000`; `web-dev` env `API_PROXY_TARGET=http://api-dev:3000`, `command: sh -c "npm ci && npm run dev -w apps/web"`, ports `5173:5173`, `depends_on: [api-dev]`; `volumes: todo-data: {}` -- AD-11.
- [x] `package.json` + `package-lock.json` -- `concurrently` and `dev:api` as in the Code Map -- dev profile.
- [x] `.env.example` -- one comment line for `api-dev`'s `DB_PATH` -- documentation.
- [x] `README.md` -- Prerequisites line without "(added in Story 1.4)"; `## Docker` section: `docker compose up --build`, open `http://localhost:8080`, `WEB_PORT`, logs, `restart` keeps data, `down -v` deletes it, `--profile dev up` with ports 3000/5173 and the first-start `npm ci` cost, image layout in two sentences -- graded deliverable.
- [x] `docs/ai-integration-log.md` -- Story 1.4 entry -- definition of done.

**Acceptance Criteria:**
- Given a clean checkout, when `docker compose up --build -d --wait` runs, then it exits 0 and `docker compose ps` shows `api` and `web` both `healthy`, with `web` started after `api` became healthy.
- Given the stack is up, when `curl -i http://localhost:8080/` runs, then the status is 200, the body contains `<title>Todo</title>` and the headers include `X-Content-Type-Options: nosniff` and `Content-Security-Policy: default-src 'self'`.
- Given the stack is up, when `curl http://localhost:8080/api/v1/health` and `/api/v1/todos` run, then the bodies are `{"status":"ok"}` and a JSON array, and `docker compose logs api` shows one `request completed` JSON line per call.
- Given `docker exec todo-api-1 id -u` and `docker exec todo-web-1 id -u`, then neither is `0`, and `docker exec todo-api-1 sh -c 'ls -ld /data'` shows owner `node`.
- Given a Todo row written to `/data/todos.db` (via `POST /api/v1/todos` if present, else by observing the file), when `docker compose restart` runs and the stack is healthy again, then `GET /api/v1/todos` returns the same rows.
- Given the repo, when `docker compose config` and `docker compose --profile dev config` run, then both validate, the default config has no `healthcheck` key, and the dev config shows the four `node_modules` anonymous volumes and `API_PROXY_TARGET=http://api-dev:3000`.
- Given the workspace, when `npm run lint` and `npm test` run, then both pass unchanged (no app source touched).
- Given `git diff main --stat`, then nothing under `apps/api/src`, `apps/api/test` or `packages/contract` changed.

## Implementation Notes

- Implemented by a dispatch subagent from the spec alone; the dispatcher re-verified every AC against the diff from baseline `a9d6993` with its own `docker compose up --build -d --wait` run (api healthy before web started; headers, proxy, `/healthz`, one completion line per request, uids 1000/101, `/data` owned by `node`, row persisted across `docker compose restart`, configs valid with no `healthcheck` key, `npm run lint` and `npm test` green, boundary paths untouched), then `docker compose down` and volume removal.
- `POST /api/v1/todos` is 404 on this branch (Story 2.1 in flight), so the persistence row was inserted with the image's own `better-sqlite3` inside the container.
- `better-sqlite3` 13.0.3 does ship `linuxmusl-arm64` and `linux-arm64` prebuilds (the Code Map's "none found" came from guessing GitHub asset names); the `deps` toolchain stays per AD-13 and compiles nothing here.
- `add_header ... always` keeps `nosniff` and the CSP on nginx's own 502 while `api` is down. `tsconfig.base.json` is copied into the `build` stage. The api runtime copies only `package.json`, `node_modules` and each workspace's `package.json` + `dist`, so no sources ship. Measured: `todo-api` 319 MB on disk (77.8 MB content), `todo-web` 90.7 MB (26 MB content).
- Dev profile was started for real once (`npm ci` inside both containers, `api-dev` on 3000, `web-dev` on 5173 proxying to `api-dev`), then removed with `down -v`.

## Spec Change Log

## Review Triage Log

Round 1, three layers (blind-hunter 11, edge-case-hunter 9, verification-gap 5 gaps + 2 other), 27 findings, 18 rows after grouping duplicates.

| # | Layer | Location | Claim | Verdict | Evidence | Route |
|---|---|---|---|---|---|---|
| 1 | edge-case, blind | `package.json` `dev:api`, `docker-compose.yml` `web-dev` | Fresh clone: `tsx watch` and Vite start before contract `dist` exists; `tsx watch` only watches files it loaded, so it never recovers | medium | Confirmed: `dist/` is gitignored and `.dockerignore` does not apply to the bind mount; it worked here only because the host had a built `dist`. Developer on the documented `--profile dev` path hits it. | patch |
| 2 | edge-case, blind, verification-gap | `docker-compose.yml` `api-dev`, README Dev profile | `--profile dev` as first mount of a new `todo-data` volume leaves `/data` root-owned; non-root `api` cannot create `todos.db` | medium | Confirmed: `docker run node:24 ls -ld /data` is "No such file", so Docker creates the mount point as root; `api` and `api-dev` start together with no ordering. README never mentions it nor how to stop the dev pair. | patch |
| 3 | edge-case, blind | `docker-compose.yml` dev services | `sh -c` is PID 1 and does not forward SIGTERM; every `stop`/`down` waits 10 s then SIGKILLs the watchers | low | Confirmed by the command shape (`sh -c "a && b"` keeps `sh` as parent). Met on every dev stop; fix is one line (`init: true`). | patch |
| 4 | blind | `apps/web/nginx.conf` `location /` | A missing `/assets/*` file returns `index.html` 200 as text/html; a stale cached page then loads HTML as a module script | low | Confirmed by `try_files $uri /index.html` with no assets location. Direct correction: `location /assets/ { try_files $uri =404; }`. Cache headers and gzip are out of intent (performance is Epic 3). | patch (404 only) |
| 5 | blind | README Docker and Dev profile | "unless `package-lock.json` changes" (any workspace `package.json` also busts the layer); "first start takes a few minutes" contradicts "on every start" and the measured seconds; `web-dev` has no readiness gate on `api-dev` | low | Confirmed against the Dockerfile `COPY` lines and the compose `depends_on` without condition. Text fixes. | patch |
| 6 | blind | `.env.example` | Comment sits under "nothing loads this file" while compose reads a `.env` for `WEB_PORT` interpolation and ignores the rest | low | Confirmed: compose interpolates `${WEB_PORT:-8080}` from `.env`; the `environment:` blocks hardcode the api values. One sentence fixes it. | patch |
| 7 | blind | `docs/ai-integration-log.md` 1.4 entry | Toolchain "compiles nothing" was tested only on `aarch64`; x86_64 unverified | low | Confirmed: this machine is `aarch64`. Text fix. | patch |
| 8 | verification-gap | `apps/web/nginx.conf` `/api/` | No automated check of the proxy passthrough | low | Pre-verified by the layer; `test:e2e` is a stub until Story 1.5, which asserts the Empty State through the built images. | defer |
| 9 | verification-gap | `apps/web/nginx.conf` headers, `/healthz` | Headers and `/healthz` contract verified only by hand; 1.5 ACs assert page states only | low | Pre-verified. No harness exists in this tree to hold the Playwright `request` spec the layer proposes. | defer |
| 10 | verification-gap | `docker-compose.yml` volume wiring | Persistence across `restart` observed only manually | low | Pre-verified. No write endpoint until Story 2.1; a restart spec belongs in the E2E harness after it. | defer |
| 11 | verification-gap | `package.json` `dev:api` chain | Dev profile command chain verified only by one manual run | low | Pre-verified. Architecture names the built images as the graded command. | defer |
| 12 | verification-gap | `apps/api/Dockerfile` `USER node` | Non-root and `/data` ownership are human-only checks | low | Pre-verified. Hardening invariant; `docker compose exec api id -u` belongs in a future CI wrapper. | defer |
| 13 | verification-gap (other) | `apps/web/dist/index.html` | CSP claim rests on a stale local `dist` with no stylesheet | false | The image's `/usr/share/nginx/html/index.html` has one external module script and one stylesheet link, nothing inline (inspected with `docker run`). The local `dist` is stale and not shipped. | reject |
| 14 | edge-case, blind | `apps/web/nginx.conf` `proxy_pass` | `api` resolved once at startup; a recreated `api` with a new address leaves `web` on 502 | low | Real only when `api` is recreated alone (`--force-recreate api`); `up` recreates dependents, and `restart`/`stop`+`start` kept the address (verified). Fix (resolver plus variable) departs from AD-9's literal rule. Rejected: low, unlikely, adds complexity. | reject |
| 15 | edge-case | `apps/api/Dockerfile` HEALTHCHECK | Probe hardcodes 3000 while `PORT` is overridable | low | AD-11 prescribes that exact probe and compose pins `PORT=3000`; only a deliberate override breaks it. Rejected: unlikely, fix changes a spine-prescribed command. | reject |
| 16 | edge-case | `docker-compose.yml` `api` | No restart policy, so a crashed api never self-heals | false | The frozen intent lists restart policies under Never. | reject |
| 17 | edge-case | `apps/web/nginx.conf` | `/api` exact or `/apix` returns `index.html` instead of the API 404 envelope | low | Contract paths all live under `/api/v1/`; no client requests `/api`. Rejected: unlikely, adds a location block. | reject |
| 18 | blind | `apps/api/Dockerfile` runtime | Nested `apps/api/node_modules` or `packages/contract/node_modules` are not copied; a future version conflict vanishes silently | low | No nested entries exist (lockfile and host checked). "Silently" is refuted: the container would crash at import and `up --wait` fails loudly. Rejected: undemonstrated state, fix adds guards. | reject |
| 19 | edge-case, blind | `docker-compose.yml` dev services, README | Dev containers run as root over the bind mount; on a Linux host `dist` and tsbuildinfo become root-owned | low | True on Linux only; this project runs on macOS under Colima where uid mapping hides it. A `user:` fix breaks `npm ci` into root-owned anonymous volumes. Rejected: unlikely here, fix adds complexity. | reject |


## Verification

**Commands:**
- `docker compose up --build -d --wait && docker compose ps` -- expected: exit 0, both services `healthy`.
- `curl -si http://localhost:8080/ | head -20` -- expected: 200, `nosniff`, CSP header.
- `curl -s http://localhost:8080/api/v1/health; curl -s http://localhost:8080/healthz` -- expected: `{"status":"ok"}` and `ok`.
- `docker compose logs api | grep -c 'request completed'` -- expected: equals the number of API requests made.
- `docker compose restart && docker compose ps` then `curl -s http://localhost:8080/api/v1/todos` -- expected: both healthy, data unchanged.
- `docker compose --profile dev config >/dev/null && docker compose config | grep -c healthcheck` -- expected: validates; `0`.
- `docker image ls todo-api todo-web` -- expected: both present; record sizes.
- `docker compose down` -- expected: no containers left (`docker compose ps -a` empty).
- `npm run lint && npm test` -- expected: green.
