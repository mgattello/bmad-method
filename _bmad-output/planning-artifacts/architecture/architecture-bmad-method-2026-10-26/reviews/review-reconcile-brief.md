# Review: reconcile training brief and addendum against the spine

Reviewed: `ARCHITECTURE-SPINE.md` (draft, 2026-10-26) against `CONTEXT.md` (training brief) and `prd-bmad-method-2026-10-26/addendum.md`.

Verdict: the spine lands every graded tool, container and test-level choice that is architectural, but as written the compose profile scheme cannot satisfy the headline grade (`docker-compose up`), E2E isolation is undecided, and the graded documentation set (README, AI integration log, QA reports) has no home in the structural seed.

## Coverage table (graded items)

| Graded item (brief / addendum) | Spine status | Where |
| --- | --- | --- |
| Jest or Vitest, commands in `package.json` | Decided (Vitest, root scripts) | AD-12, Conventions: Package manager |
| Playwright E2E, min 5 passing | Decided (`e2e/*.spec.ts`, five named specs) | AD-12 |
| Playwright MCP | Silent | none |
| Postman MCP or similar | Silent | none |
| Chrome DevTools MCP (debug + performance) | Silent | none |
| Multi-stage Dockerfiles | Decided | AD-11, Structural Seed |
| Non-root users | Decided (no mechanism) | AD-11 |
| Health checks (endpoint + container) | Decided | AD-2, AD-11 |
| Compose networking, volumes, env | Decided (network implicit) | AD-9, AD-11, Structural Seed |
| `docker-compose logs` | Decided implicitly (stdout JSON) | AD-11, Conventions: Logging |
| Dev/test via env vars + profiles | Decided, but infeasible as written | AD-11 |
| 70% coverage | Decided (per app, lines + branches) | AD-12 |
| Performance report (Chrome DevTools MCP) | Silent, not in Deferred | none |
| Accessibility WCAG AA | Decided (structure) + deferred (audit tooling, with reason) | Conventions: Accessibility, Deferred |
| Security review (XSS, injection) | Partial: XSS decided, SQL injection silent | AD-6, AD-5 |
| README with setup instructions | Silent | none |
| AI integration log | Silent | none |
| Architecture docs / how BMAD guided the build | Silent on where they ship | none |
| QA reports (coverage, accessibility, security) | Silent on where they live | none |

## Critical

### C1. "dev (default)" profile cannot be expressed in Compose; bare `docker-compose up` may start nothing
AD-11 says profiles are `dev` (default) and `test`, and that dev and test "differ only by env vars and profile". Compose has no default profile: services carrying `profiles: [dev]` do not start on a bare `docker compose up` (the graded command, brief Step 3 / addendum C and D), and services with no profile always start, so `--profile test` would start both stacks on the same 8080 port, or the two stacks need different service names and the "only env vars" claim fails.
**Fix:** make the unprofiled `web` and `api` services the built-image stack (this is what `docker compose up` grades and what AD-12 wants E2E to hit); put `web-dev` / `api-dev` (bind mounts, hot reload) under `profiles: [dev]` and an `e2e` runner under `profiles: [test]`; let test differ from default only by env (`DB_PATH` / volume name, `NODE_ENV=test`). Write the three exact commands into AD-11: `docker compose up`, `docker compose --profile dev up web-dev api-dev`, `docker compose --profile test up --wait && npm run test:e2e`. If dev must stay the default, commit a `.env` with `COMPOSE_PROFILES=dev` and say so, but note that then the graded `up` runs the bind-mounted stack, not the optimised images.

## High

### H1. E2E isolation and "fresh DB volume" are undecided; the empty-state spec will be flaky
AD-12 requires five E2E specs including empty state against one shared API/SQLite, with Playwright's default parallel workers, and AD-2 forbids any reset endpoint ("No other endpoints in v1"); AD-11 says the test profile has a "fresh DB volume" without saying how. Create/delete specs running alongside the empty-state spec break the graded "5 passing Playwright tests".
**Fix:** in AD-12 set `workers: 1`, `fullyParallel: false`, and a `beforeEach` purge that lists and deletes every Todo through the contract paths at `baseURL/api/v1`; in AD-11 give the test profile its own volume name (`todo-data-test`) or `tmpfs`, and make `test:e2e` run `docker compose --profile test down -v` first.

### H2. Non-root user plus named volume at `/data` will fail at first write unless the Dockerfile prepares the directory
AD-5 and AD-11 require a non-root API user writing `/data/todos.db` on a named volume. A named volume mounted on a path that does not exist in the image is created root-owned, so the first `CREATE TABLE` fails, health returns 503 and the container reports unhealthy, breaking the graded `docker-compose up`.
**Fix:** add to AD-11: the api Dockerfile runs `mkdir -p /data && chown node:node /data` before `USER node`, and compose mounts `todo-data:/data`; the integration tests use a temp path so no test depends on `/data`.

### H3. Graded documentation has no home: README, AI integration log, QA reports, BMAD trail
Brief Success Criteria and addendum D grade a README with setup instructions, an AI integration log with five headings, QA reports (coverage, accessibility, security, performance) and "documentation of how BMAD guided the implementation"; the spine's Structural Seed lists none of these and the sources `_bmad-output/` sit outside the `todo-app/` tree.
**Fix:** add `README.md`, `docs/ai-integration-log.md` (agent usage, MCP servers, test generation, debugging, limitations), `docs/qa/{coverage,accessibility,security,performance}.md` and `docs/bmad-trail.md` (or a pointer to `_bmad-output/`) to the Structural Seed, and state whether `todo-app/` is this repo's root or a subfolder so graders can find the BMAD artefacts next to the code.

## Medium

### M1. MCP tooling (Playwright MCP, Postman MCP, Chrome DevTools MCP) and the performance report are neither decided nor deferred
Brief Step 2 and 4 and addendum B name three MCP servers and a performance report as graded activities; the spine's Deferred list covers only Lighthouse/axe. These are process choices, not structure, but silence means no story will carry them.
**Fix:** add a Deferred entry: "MCP servers for authoring and validation (Playwright MCP for E2E authoring, Postman MCP for contract checks through `http://localhost:8080/api/v1`, Chrome DevTools MCP for debugging and the performance report) are development tooling, chosen in the QA and setup stories and recorded in `docs/ai-integration-log.md`." Note the API is reachable only through the nginx proxy (Conventions: Ports), so Postman MCP targets 8080, never 3000.

### M2. `LOG_LEVEL` "silent in tests" can empty `docker-compose logs` during the graded run
Conventions: Logging says `LOG_LEVEL` is `silent` in tests; an implementer will naturally set that in the compose `test` profile env, after which `docker compose logs api` shows nothing while the E2E suite runs, undermining brief Step 3 "logs are accessible via docker-compose logs".
**Fix:** reword to "`silent` only for the in-process app under Vitest (unit and integration); every compose profile keeps `info`".

### M3. Dev profile hot reload contradicts "differ only by env vars and profile" and the web Dockerfile shape
AD-9 says the Vite dev server proxies `/api/`, AD-11 says dev has hot reload, yet the web Dockerfile is "build stage -> nginx stage" with no dev target, and nginx cannot hot reload. Dev therefore differs by image target and command, not just env.
**Fix:** either add a `dev` target (node image, `vite --host --port 8080`) to both Dockerfiles and reference it from the dev services, or drop container-level hot reload and run dev with `npm run dev` on the host against `docker compose up api`; state which in AD-11.

### M4. Non-root nginx is harder than the spine implies with `nginx:1.29-alpine`
AD-11 requires non-root for the web container, but the stock nginx image starts as root and needs writable `/var/cache/nginx`, `/var/run/nginx.pid` and a `user` directive change to run otherwise.
**Fix:** pin `nginxinc/nginx-unprivileged:1.29-alpine` in the Stack table (listens on 8080 by default, matching Conventions: Ports), or document the chown + pid-path steps in AD-11.

### M5. SQL injection is not ruled out, so the graded security review has nothing to cite for "injection"
Brief Step 4 security review names XSS and injection; AD-6 settles XSS (text-only rendering) but AD-5 only says the repository "contains SQL only" and never requires parameterised statements. Also silent: nginx security headers, request body limits (deferred).
**Fix:** add to AD-5: "all SQL is prepared statements with bound parameters; no string interpolation of input into SQL", and to AD-9: nginx sends `X-Content-Type-Options: nosniff` and a CSP of `default-src 'self'`; cite both in `docs/qa/security.md`.

### M6. Web container start order against the api is undecided; nginx exits if `api` does not resolve
AD-9 hardcodes `proxy_pass http://api:3000`; nginx resolves upstream names at startup and exits with "host not found" if `web` starts before `api` exists on the network, which shows up as a failed `docker-compose up` on cold start.
**Fix:** add `depends_on: api: condition: service_healthy` for `web` to AD-11 (this also makes `docker compose up --wait` a reliable E2E precondition).

## Low

### L1. `e2e/` is not one of the "three workspaces" yet imports `contract`
Design Paradigm says three workspaces; the tree has four packages and `e2e` depends on `contract`. **Fix:** list `e2e` as a fourth workspace (or say it is the root package) so the import resolves.

### L2. Coverage report has no script or output path for the graded deliverable
AD-12 enforces 70% "in CI" while CI is deferred, and the brief wants a coverage report handed in. **Fix:** put thresholds in each app's `vitest.config.ts` so `npm test` fails locally too, and add a root `test:coverage` script that writes `coverage/` per app and is cited by `docs/qa/coverage.md`.

### L3. Component-test environment missing from the Stack
AD-12 uses Testing Library for web unit tests but the Stack lists no DOM environment or matchers. **Fix:** add `jsdom` (or `happy-dom`) and `@testing-library/jest-dom` with versions.

### L4. HEALTHCHECK probe command unspecified on alpine images
AD-11 declares HEALTHCHECK on both images; `node:24-alpine` has no curl. **Fix:** specify busybox `wget -qO- http://localhost:3000/api/v1/health || exit 1` (api) and `wget -qO- http://localhost:8080/healthz || exit 1` (web), with `--interval`/`--start-period` values.

### L5. `better-sqlite3` native build on `node:24-alpine` may need toolchain in the build stage
If no musl prebuild matches Node 24.22.1, `npm ci` compiles from source and the multi-stage build fails without `python3 make g++`. **Fix:** add those to the build stage in AD-11 or note `node:sqlite` as a zero-native-dependency alternative to evaluate.

### L6. Accessibility convention omits the checks Lighthouse/axe flag as critical
Conventions: Accessibility covers labels, live region and keyboard but not `lang`, viewport meta, 4.5:1 contrast or visible focus, all of which are common "critical" findings. **Fix:** add those four to the convention so the WCAG AA zero-critical target is designed in, not audited in.

### L7. "Exactly one completion line per request" needs explicit Fastify configuration
Fastify logs "incoming request" and "request completed" by default; AD-11 requires one line with `responseTime`. **Fix:** note `disableRequestLogging: true` plus an `onResponse` hook, or relax the rule to "one completion line".

### L8. nginx access logs are not JSON, so the AD-11 "Prevents" claim (log formats that differ between containers) is not met
Not graded, but the claim is false as written. **Fix:** either define a JSON `log_format` in `nginx.conf` or narrow the claim to the api container.

### L9. `docker-compose` (v1 syntax) versus `docker compose` (Stack)
The brief uses `docker-compose up` / `docker-compose logs`; the Stack pins Compose v2. Both work where the v2 compat shim is installed. **Fix:** README states both forms and requires Compose v2.

### L10. No capability-map row for project setup and test infrastructure
Addendum A step 5 makes "test infra first" a sequencing requirement; the Capability map has no row to derive that story from. **Fix:** add a row "Project scaffold + test infra" governed by AD-12 and Conventions: Package manager.
