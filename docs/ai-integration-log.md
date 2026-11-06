# AI Integration Log

Append-only record of how AI agents were used on this project: one entry per story, written as
part of that story's definition of done. Each entry covers agent usage, the prompts that drove
the work, MCP servers or tools involved, what the AI got wrong or missed, how problems were
debugged, and limitations worth knowing about.

## Story 1.1: Scaffold the workspace and the API contract package

**Date:** 2026-10-26

**Agent usage.** Claude Code (model Fable 5.1) ran as a BMAD build dispatch agent with the
story spec as its only brief. It read the spec's `context:` files (the epic 1 context and the
architecture spine), then hand-scaffolded the monorepo without a starter template: root
workspace config, `packages/contract` with schemas and tests, placeholder `apps/api` and
`apps/web` workspaces wired to Vitest, the `e2e` stub, and the docs. It ran every verification
command itself (`npm ci`, `npm run build`, `npm run lint`, `npm test`, `npm run test:int`).

**Prompts.** One prompt: implement the story spec, treating it as the sole source of truth, and
report what changed and how it was verified. No follow-up prompting was needed.

**MCPs and tools.** No MCP servers were used. Version and API facts came from the npm registry
through the npm CLI (`npm view`) and from a throwaway probe install in a scratch directory,
where the agent confirmed before writing any code that typebox 1.4.3 exposes a default `Type`
export, a `Static` type and a `typebox/value` default export, that `additionalProperties` and
`minProperties` are honoured by `Value.Check`, that `eslint-plugin-react-hooks` 7 ships
`configs.flat.recommended`, and that `tsc` 6.0.3 accepts `erasableSyntaxOnly` and
`verbatimModuleSyntax`.

**Version pins.** Every package pinned in the spine's Stack table that this story installs
exists in the registry at exactly that version, so no deviation was needed: typescript 6.0.3,
typebox 1.4.3, react and react-dom 19.3.1, @types/react and @types/react-dom 19.3.0, vite
8.3.5, @vitejs/plugin-react 6.1.2, vitest and @vitest/coverage-v8 5.0.5, jsdom 30.1.3,
@testing-library/react 16.3.3, @testing-library/dom 10.4.2, @types/node 24.19.2, eslint
10.13.0, @eslint/js 10.0.1, typescript-eslint 8.72.0, eslint-plugin-react-hooks 7.1.1,
prettier 3.9.10. Fastify, better-sqlite3, tsx and Playwright are not installed yet (Stories 1.2
to 1.5).

**What the AI missed, and debugging.** Three things failed on first run, all caught by the
story's own verification commands:

1. ESLint flagged an unused `_createdAt` variable from a rest-destructure in the contract test.
   Replaced with an explicit object that omits the field.
2. The web smoke test failed with "Found multiple elements with the role heading". The test
   mounts `main.tsx` into `#root` and also renders `App` through Testing Library, whose
   `render` binds queries to `document.body`, so both trees matched. Fixed by scoping queries
   with `within(container)`.
3. After that, asserting on `#root` immediately after importing `main.tsx` found nothing:
   `createRoot().render` schedules work through React's concurrent scheduler and had not
   committed yet (it had only appeared earlier because Testing Library's `render` flushed it
   inside `act`). Fixed by importing the module inside `act(...)`, which also avoids a "not
   wrapped in act" warning.

**Decisions made while implementing.** Every root script that reaches an app builds the
contract first: `test` and `test:int` so a clean checkout can run them without a separate build
step, and `lint`, which after ESLint and Prettier runs `typecheck` in every workspace (api and web
type-check against the contract's `dist/`). Test files are excluded from each `tsc` build so they
are not emitted to `dist/`; contract and api type-check them through a `tsconfig.test.json`, web
through `tsconfig.app.json` via `tsc -b`. The web `tsconfig.node.json` adds `types: ["node"]`
alongside `vite/client` because `vite.config.ts` reads `process.env.API_PROXY_TARGET`. Coverage is
enabled for the contract package as well as the two apps. `todoPath` URL-encodes its id so a
malformed id cannot change the path shape. The api `dev` script is left for Story 1.2, which
introduces `tsx`.

**Review rounds.** Round 1 (build review) raised 18 findings, 11 patched. The main ones: the
README told developers to copy a `.env` file that nothing loads; `document.getElementById('root')
as HTMLElement` crashed inside `createRoot` when `#root` was missing; `??` kept an empty
`API_PROXY_TARGET` so the proxy threw per request; the `/api` proxy key prefix-matched paths such
as `/apiary.png`; and the contract's type exports were pinned by no type-check because test files
were excluded from `tsc`. Round 2 (code review) raised 21 findings, 13 patched, mainly the
remaining type exports still unpinned by any annotation, stale log text, drift between the ignore
files and the lint config, and test setup gaps (no Testing Library cleanup, api integration folder
not type-checked).

**Limitations.** The web placeholder shows the list endpoint path on
screen so the smoke test exercises the contract import; Story 1.3 replaces that shell. No
Docker was available locally, which this story did not need.

## Story 1.2: API lists Todos from a durable SQLite store and reports health

**Date:** 2026-10-26

**Agent usage.** Claude Code (model Fable 5.1) ran as a BMAD build dispatch agent with the
story spec as its only brief. It read the spec's `context:` files (the epic 1 context and the
architecture spine), then replaced the `apps/api` placeholder with the layered Fastify app:
`buildApp` as the composition root with the error and not-found handlers, `routes/todos.ts`
and `routes/health.ts`, `TodoService`, the `TodoRepository` port with `SqliteTodoRepository`
and `InMemoryTodoRepository`, and `server.ts` as the only env reader. It wrote the three unit
suites and three integration specs, updated the docs, and ran every verification command itself
(`npm ci`, `npm run build`, `npm run lint`, `npm test`, `npm run test:int`, `npm run test:e2e`
and the `tsx` smoke run with `curl`). A dispatcher session planned the spec, checked the diff
against it, ran the review round and re-engaged the same implementation agent for the fixes.

**Prompts.** One prompt: implement the story spec, treating it as the sole source of truth, load
its context files first, and report what changed, how it was verified and what is left. One
follow-up message listed the five review findings to fix with the smallest change each.

**MCPs and tools.** No MCP servers were used. Version facts came from `npm view`. Before writing
any code the agent did a throwaway install of the pinned stack in a scratch directory and ran two
probe scripts, which confirmed: better-sqlite3 13.0.3 ships `prebuilds/` for darwin, linux and
linuxmusl, so `npm ci` compiles nothing (see Limitations for the node-gyp configure step);
`@fastify/type-provider-typebox` 6.3.0 exports `TypeBoxTypeProvider` and
`FastifyPluginAsyncTypebox` and re-exports typebox 1.x; a Fastify 5 error handler sees
`statusCode` 400 with `validation` set for schema failures and `FST_ERR_CTP_INVALID_JSON_BODY`
for malformed JSON; `reply.elapsedTime` is available in `onResponse`; a closed better-sqlite3
connection throws `The database connection is not open` and `close()` twice does not throw; and
Fastify's default 404 body is `{ message, error, statusCode }`, so it had to be replaced.

**Version pins.** Every package the spine's Stack table assigns to this story exists at exactly
that version and was installed as pinned: fastify 5.12.7, @fastify/type-provider-typebox 6.3.0,
typebox 1.4.3, ajv-formats 3.0.1, better-sqlite3 13.0.3, @types/better-sqlite3 9.6.0, tsx
4.23.15. No deviation. `@fastify/sensible` is in the Stack table but the spec forbids it here.

**What the AI missed, and debugging.** Everything below was caught by the story's own
verification commands or by the probe, not by a reviewer:

1. The probe showed Fastify 5.12.7 prints deprecation `FSTDEP023` for the top-level
   `disableRequestLogging` option the spec names. The intent (no default request lines, one
   custom completion line) is met with the replacement API,
   `logController: new LogController({ disableRequestLogging: true })`, so the server starts
   without a warning.
2. `tsc` failed twice on first build: Fastify 5.12 types the `setErrorHandler` error as
   `unknown`, so `error.statusCode` did not compile (fixed with a `statusOf(error: unknown)`
   helper that trusts only a numeric `statusCode`); and `return { status: 'ok' }` in the health
   route widened to `string` against the TypeBox-typed response (fixed with typed `HealthBody`
   constants).
3. `npm run lint` then failed in `typecheck`: the `tsconfig.test.json` from Story 1.1 included
   `test/**/*.ts` but inherited `rootDir: "src"`, which no file had exercised until the first
   integration spec existed (TS6059). Fixed with `rootDir: "."` in the test tsconfig; it is
   `noEmit`, so nothing else changes.
4. `@types/better-sqlite3` types `db.pragma()` as `unknown`; the repository unit test needed a
   cast to read `table_info` column names.
5. Two self-inflicted slips while editing: a `perl` substitution on the README used `|` as its
   delimiter while the Markdown table rows contain `|`, which corrupted the file (rewritten in
   full), and the first smoke run pointed at `apps/api/node_modules/.bin/tsx`, which does not
   exist in a hoisted workspace (the binary is in the root `node_modules/.bin`).
6. While applying the review fixes, the agent's rewrite of this log's Limitations paragraph
   overwrote the Story 1.1 Limitations paragraph and dropped the rest of this entry. The
   dispatcher restored the file from the last commit and re-appended the entry, which is why the
   spec forbids touching existing entries.

**Decisions made while implementing.** Routes register the full `TODOS_PATH` and `HEALTH_PATH`
from the contract, as the spec words it, rather than a prefix plus `/todos`. The `SELECT 1` ping
is prepared directly, not through the `scoped` helper: the helper is the owner seam for todos
queries and an owner filter on a connection probe would be meaningless. Error messages are three
fixed strings (`Not found`, `Invalid request`, `Unexpected error`) so no library text can leak.
`InMemoryTodoRepository` mirrors the SQL order (createdAt desc, insertion desc), so the service
test also uses an unordered stub repository to prove the service's own stable sort. Because no
write routes exist yet, the unit test proves the `VALIDATION_ERROR` branch and the Ajv
`coerceTypes: false` / `removeAdditional: false` settings by adding throwaway routes to the
built app (a thrown error with `statusCode: 418`, a `POST` with a TypeBox body schema, malformed
JSON). `ajv-formats` is installed only because the type provider declares it as a peer;
Fastify's default Ajv already registers formats, so nothing calls it. `NODE_ENV` is read and
logged once at startup; nothing branches on it. `*.db`, `*.db-wal` and `*.db-shm` were added to
`.gitignore` and `.dockerignore` because the README's local-run example writes
`apps/api/todos.db` inside the workspace. `server.ts` handles `SIGINT` and `SIGTERM` by calling
`app.close()`, which runs the `onClose` hook that closes the repository; the smoke run confirmed
exit code 0 and the port released. The Story 1.1 deferred item was applied: `--passWithNoTests`
is gone from the api `test:int` script now that three specs exist.

**Review rounds.** Before the review the dispatcher replaced two `/api/v1/nope` test literals
with `${API_PREFIX}/nope` so no `/api/v1` literal exists outside the contract. Round 1 (build
review, three parallel reviewers: blind hunter, edge-case hunter, verification gap) raised 27
findings, triaged into 21 rows: 5 patched, 1 deferred, 15 rejected. Patched: `*.db` files were
git-ignored but not docker-ignored and the README implied the local database lands at the repo
root (it lands in `apps/api/`); the todos integration seed opened the file without creating the
table, so the second test depended on the first; the 4xx branches of the error handler logged
nothing, so a validation failure could not be diagnosed; the `createdAt` format invariant that
makes string order time order was unstated on the port; and this entry's native-build paragraph
contradicted itself and named a Dockerfile that does not exist yet. Deferred: `server.ts` has no
automated test (Story 1.5 boots the built image through it). Rejected findings were loud-failure
startup cases (invalid `PORT` or `LOG_LEVEL`, unwritable `DB_PATH`), a shutdown deadline, WAL and
VACUUM edge cases, and the prefix-versus-full-path registration style.

**Limitations.** npm 11's allow-scripts gate blocks esbuild's `postinstall` with a warning; `tsx`
still runs because esbuild resolves its platform package without that script. better-sqlite3 has
no install script, but because it ships a `binding.gyp` npm runs its implicit `node-gyp rebuild`
during `npm ci`: on this machine that ran only the configure step
(`node_modules/better-sqlite3/build/` holds `Makefile`, `config.gypi` and `obj.target`, and no
`.node`), nothing was compiled, and the module loads `prebuilds/<platform>.node`. That configure
step needs Python 3 on the host, now listed in the README prerequisites; the Story 1.4 api
Dockerfile `deps` stage is planned to install `python3 make g++` (AD-13). No Docker was available
locally, which this story did not need. Coverage for the api is 100% lines and 95% branches with
`src/server.ts` excluded as process wiring.

## Story 1.3: Web shell shows the Todo List with Loading, Empty and Error States

**Date:** 2026-10-26

**Agent usage.** Claude Code (model Fable 5.1) ran as a BMAD build dispatch agent in a git
worktree on branch `epic-1/story-1-3`, with the story spec as its only brief. It read the spec's
`context:` files (the epic 1 context and the architecture spine), inspected the existing web
workspace, root configs and contract exports, then wrote the client, the state hook, the six
components with their CSS modules, `tokens.css`, `App`, the rewired entry point and the four test
files. It ran every verification command itself (`npm run build`, `npm run lint`, `npm test`, the
spec's greps and the `git diff main` boundary check). Story 1.2 (the API) was built in parallel on
another branch and is not in this tree; everything here runs against a mocked client.

**Prompts.** One prompt: implement the story spec, treating it as the sole source of truth, load
the spec's context files first, and report what changed, how it was verified and what is left.
No follow-up prompting was needed.

**MCPs and tools.** No MCP servers were used. The agent worked through the shell: file writes,
`eslint`, `prettier`, `tsc -b`, `vitest` and `git`. Before writing tests it checked that
`@testing-library/react` 16 exports `renderHook` and that the Node 24 globals `fetch` and
`Response` are available under the jsdom environment, so the client tests could build real
`Response` objects instead of hand-rolled fakes.

**What the AI missed, and debugging.** The first `npm run lint` failed on one finding and
Prettier flagged four files; tests passed on the first run.

1. `react-hooks/set-state-in-effect` fired on the first version of `use-todos.ts`. The mount
   effect called `load()`, and `load` set `{ status: 'loading' }` synchronously before awaiting
   the client, which the React Compiler rule traces through the local `useCallback`. The spec
   anticipated this ("restructure rather than disable"). The fix splits the hook into
   `fetchInto(id)` (await the client, apply the result only if `id` is still the latest) and
   `load()` (set `loading`, then `fetchInto`). The mount effect calls `fetchInto` directly because
   the initial state is already `loading`, so no synchronous `setState` runs inside the effect,
   and the stale-response guard is shared by both paths.
2. Prettier rewrapped a long `if ... return` in the client, the ternary in the hook, a long
   `waitFor` line in the hook test and the `font-family` list in `tokens.css`. Fixed with
   `prettier --write`.

**Decisions made while implementing.** The Retry button is rendered inside the `role="status"`
element, so the message and the control are announced together and E2E can locate both through
`getByRole('status')`; when there is no message the banner stays in the DOM and in normal flow
with no class, so it occupies no visible space but is already in the accessibility tree before the
first message is inserted. The unmount case is handled by the sequence counter alone: the
effect cleanup bumps `seq`, which invalidates the pending request on unmount and on StrictMode's
first pass, so no `isMounted` flag exists. `TodoItem` passes the whole `Todo` to the optional
`onToggle` and `onDelete` props so Story 2 can read `id` and `completed` without a second lookup.
`TodoInput` is a controlled input with `useId` for its label. The visually hidden rule lives in
`LoadingState.module.css` and `:focus-visible` outlines live in each component's module, because
the spec limits `tokens.css` to custom properties and the base rules. `main.test.tsx` mocks the
client with a factory rather than an automock: `vi.resetModules()` re-instantiates the module per
test, which would discard any `mockResolvedValue` set on an automocked function. Client tests
assert the exact `fetch` call (`TODOS_PATH` plus the `accept` header) and that the serialised
result never contains the server message.

**Review rounds.** Round 1 (build review, three layers: blind hunter, edge-case hunter,
verification gap) raised 22 findings (18 after grouping duplicates), 9 patched, 9 rejected, 0 deferred. The main patches: the
empty banner used `display: none`, which removed the live region from the accessibility tree so the
first failure would not reliably be announced; skeleton rows were 44px while a rendered item was
54px, so the list shifted when the skeleton was replaced; the native checkbox was sized 44px and
rendered oversized next to 16px text (now natural size, the row and its label keep the 44px
target); the `TodoInput` submit path had no test, so removing `preventDefault` would have reloaded
the page with every test still green; the completed-item class was never asserted; and the
"server message not rendered" assertion was vacuous because the mocked result carried no message.

**Limitations.** Only jsdom tests exist, so touch-target size, visible focus and the no-layout-shift
guarantee are asserted by CSS (`--row-min-height`, `--list-min-height`) rather than by a test; a
browser-level accessibility and visual check waits for the E2E and QA stories. With no API in this
tree, `npm run dev -w apps/web` shows the Error State with Retry until Story 1.2 is merged or
`API_PROXY_TARGET` points at a running API. The unmount-mid-load test cannot fail if the sequence
guard's cleanup is removed, because React 19 makes `setState` on an unmounted component a silent
no-op, so it documents the behaviour rather than guarding it. Docker was not needed.

## Story 1.4: Run the whole stack with docker compose up

**Date:** 2026-10-26

**Agent usage.** Claude Code (model Fable 5.1) ran as a BMAD build dispatch agent on branch
`epic-1/story-1-4`, with the story spec as its only brief. It read the spec's `context:` files (the
epic 1 context and the architecture spine), inspected the root configs, the three workspace
`package.json` files, `server.ts`, the web build settings and the nginx base image, then wrote the
two Dockerfiles, `apps/web/nginx.conf` and `docker-compose.yml`, added `concurrently` and the
`dev:api` script, and updated `.env.example`, the README and this log. It ran every verification
command itself against Docker on Colima (`aarch64`, Compose v5.6.1): `docker compose up --build -d
--wait`, the `curl` checks, the persistence check across `docker compose restart`, both `config`
validations, `npm run lint`, `npm test`, the `git diff main` boundary check, and beyond the spec's
list it also started the `dev` profile for real and exercised the proxy with `api` stopped.

**Prompts.** One prompt: implement the story spec, treating it as the sole source of truth, load its
context files first, and report what changed, how it was verified and what is left. No follow-up
prompting was needed.

**MCPs and tools.** No MCP servers were used. The agent worked through the shell: `docker`,
`docker compose`, `curl`, `npm`, `git` and `perl` for in-place edits. Before writing any file it
pulled both base images to confirm they exist as pinned (`nginxinc/nginx-unprivileged:1.30-alpine` is
nginx 1.30.6, runs as uid 101 and ships busybox `wget`; `node:24-alpine` is Node 24.22.1) and
checked `npm view concurrently@10.0.6`.

**What the AI missed, and debugging.** The stack came up healthy on the first `up --build --wait`
and every acceptance criterion passed on the first run, so the debugging was in reading the evidence
rather than fixing failures:

1. The spec's Code Map says no arm64 prebuild of `better-sqlite3` was found, so the `deps` toolchain
   compiles it. That is not what happens: 13.0.3 ships `prebuilds/linuxmusl-arm64.node`, and npm
   11's install-scripts gate did not run `node-gyp rebuild` inside the image either (the build log
   shows the warning and no `build/Release` exists in the runtime image). The `python3 make g++`
   layer stays because AD-13 requires it and it is what makes the build portable to a platform
   without a prebuild, but on this machine it compiles nothing. Only `aarch64` under Colima was
   tested; the `linuxmusl-x64` prebuild path is unverified here, so an x86_64 runner may exercise
   the toolchain.
2. `docker compose logs api | grep -c 'request completed'` counts more lines than the `curl` calls
   made, because the api `HEALTHCHECK` is itself a `GET /api/v1/health` every 5 seconds and each one
   logs a completion line. The invariant (one line per request) holds; the count is requests plus
   health probes.
3. The spec's verification command `docker image ls todo-api todo-web` is not valid (`image ls`
   takes at most one repository); `docker image ls --filter reference='todo-*'` was used instead.
4. The first README wording for running only the hot-reload pair said "stop them with ... up";
   rewritten before the Prettier check.

**Decisions made while implementing.** `add_header` uses `always` on both headers so the nginx 502
page served while `api` is down also carries `nosniff` and the CSP (verified with `docker compose
stop api`); without it nginx drops custom headers on 5xx. The api `runtime` stage copies the six
workspace items the spec lists (root `package.json` and `node_modules`, each workspace's
`package.json` and `dist`) rather than all of `/app`, so sources, tests and tsconfigs never ship;
the `node_modules/@todo/contract` symlink resolves because the relative layout is kept.
`tsconfig.base.json` is copied into the `build` stage because every workspace tsconfig extends it.
The web Dockerfile keeps the `npm prune --omit=dev` step even though its runtime copies only
`dist`, so the `build` recipe reads the same in both files. The compose `api` service repeats the
env block the Dockerfile already sets, so `docker compose config` shows the whole operational
envelope in one place; `api-dev` sets `NODE_ENV=development` and the same `HOST`, `PORT` and
`LOG_LEVEL`. Both `HEALTHCHECK`s use the shell form so the `node -e` quoting reaches `sh` intact.
The dev services run `node:24` (Debian) as the spec settled, and `better-sqlite3` loads its
`linux-arm64` prebuild there too. Measured: `todo-api` 77.8 MB content (319 MB on disk), `todo-web`
26 MB content (90.7 MB on disk); the web build reused every `deps` layer from the api build; the
dev profile's in-container `npm ci` took under ten seconds on this network. The dispatcher's
review then patched five things: `dev:api` and `web-dev` build the contract once before their
watchers start (a fresh clone has no `packages/contract/dist`, and `tsx watch` only watches files
it loaded, so it never recovered from the first failed import); `api-dev` runs
`chown node:node /data` first so a brand-new `todo-data` volume is handed to `node` whichever
service mounts it first; both dev services set `init: true` so `sh -c` as PID 1 no longer swallows
SIGTERM and `docker compose stop` returns at once instead of after the 10 s SIGKILL; nginx gained
`location /assets/ { try_files $uri =404; }` so a missing hashed bundle is a 404 rather than
`index.html` served as a module script; and the README and `.env.example` wording was corrected
(a `package.json` change also invalidates the `deps` layer; a copied `.env` only sets `WEB_PORT`).

**Review rounds.** Round 1 (build review, three layers: blind hunter, edge-case hunter,
verification gap) raised 27 findings (19 rows after grouping duplicates): 7 patched, 7 rejected,
5 deferred as one entry. The patches: the contract is built once before `tsx watch` and Vite start
(a fresh clone has no `dist`, and `tsx watch` never recovers from a failed first import); `api-dev`
chowns `/data` to `node` so a fresh volume is safe whichever service mounts it first; `init: true`
on both dev services so `docker compose stop` reaches the watchers instead of waiting 10 s for a
SIGKILL; `/assets/*` misses return 404 instead of `index.html`; README, `.env.example` and this
log wording. Rejected: re-resolving `api` in nginx (departs from AD-9 and only matters when `api`
is recreated alone), a `PORT`-aware probe (AD-11 fixes the probe), a restart policy (excluded by
intent), `/api` without a slash falling to the page, nested `node_modules` not copied (none exist
and a miss fails `up --wait` loudly), root-owned dev output on Linux hosts (macOS here), and a
stale local `dist` (the image's `index.html` was inspected directly). Deferred: E2E-level checks of
the proxy passthrough, the headers and `/healthz`, restart persistence, the dev chain and the
non-root uids once the Story 1.5 harness exists. The implementer was re-engaged for the patches;
the dispatcher then re-ran the full stack, the restart check, lint and tests green.

**Limitations.** Two operational edges are worth knowing. First, `todo-data` is initialised by
whichever container mounts it first: `api` creates `/data` owned by `node`, but `node:24` has no
`/data`, so before the review patch a `--profile dev` start on a brand-new volume left `/data`
owned by root and the non-root `api` could not create `todos.db`; `api-dev` now chowns `/data` on
start, which was not re-run live here. Second, nginx resolves `api` once at startup; `docker compose restart` and
`stop`/`start` kept the same address and the proxy recovered (verified), but recreating `api` with
a new address would need `web` restarted. The CSP was checked only by inspecting the built
`index.html` (one external module script, one stylesheet, nothing inline); a browser-level check of
the page under `default-src 'self'` waits for the Story 1.5 Chromium run. No `POST` route exists yet,
so the persistence check seeded one row directly in `/data/todos.db` with `node` inside the api
container before `docker compose restart`. On first start `api-dev` restarts once because the
contract's `tsc --watch` rewrites `dist/` and `tsx watch` notices; harmless.

## Story 2.1: Create a Todo through the API

**Date:** 2026-10-26

**Agent usage.** Claude Code (model Fable 5.1) ran as a BMAD build dispatch agent in a git
worktree, with the story spec as its only brief. It read the spec's `context:` files (the epic 2
context and the architecture spine), then the whole of `apps/api`, the contract package and the
docs the spec names, and extended the Story 1.2 layers in place: `ValidationError` in
`service/errors.ts`, `insert` on the `TodoRepository` port with a prepared `insertStmt` in
`SqliteTodoRepository` and a push in `InMemoryTodoRepository`, `TodoService.create`, the POST
route and the `ValidationError` branch in the error handler. It extended the three unit suites and
the todos integration spec, updated the two READMEs and this log, and ran every verification
command itself (`npm run build`, `npm run lint`, `npm test`, `npm run test:int`, the spec's greps
and diff check, and the `tsx` smoke run with `curl`).

**Prompts.** One prompt: implement the story spec, treating it as the sole source of truth, load
its context files first, and report what changed, how it was verified and what is left.

**MCPs and tools.** No MCP servers were used. The agent worked through the shell: `python3`
heredocs for in-place edits, `prettier`, `tsc`, `vitest`, `curl` and `git`. No probe install was
needed; everything the story relies on (Fastify's `instanceof` errors reaching `setErrorHandler`,
better-sqlite3's synchronous `run()`, Vitest's `vi.setSystemTime` and `vi.spyOn(crypto,
'randomUUID')`) was already in the installed stack.

**What the AI missed, and debugging.** Both tests and the build passed on the first run; two
things failed in the verification pass:

1. `npm run lint` failed in the api `typecheck`: the schema-rejection test in `app.test.ts` typed
   its payload table as `unknown[]`, which Fastify's `inject` does not accept as a payload, and
   the compiler then lost the `Response` type on the awaited result. The unit run had passed
   because Vitest strips types. Fixed by typing the table as `Record<string, unknown>[]`. The
   first lint run also hid the failure behind a `tail` filter; the second run was read in full.
2. The first smoke script died before starting the server because zsh's `nomatch` turned
   `rm -f .../todos.db*` into an error when no file matched. Re-run with `rm -rf` on the scratch
   directory.

**Decisions made while implementing.** The rule text is one constant in `todo-service.ts`,
built from `DESCRIPTION_MAX`, so the message and the limit cannot drift. The `ValidationError`
branch sits after the 404 branch and before the generic 4xx mapping; it logs at `debug` like the
other 4xx branches and emits the error's own message, which is the only place a non-fixed string
reaches an error body. `insertStmt` is prepared directly, like `pingStmt`, because `scoped()`
exists to append a read filter and an INSERT has nothing to filter; the owner column will be bound
on that one statement. `InMemoryTodoRepository.insert` pushes a shallow copy so a caller mutating
its Todo after the call cannot change what the double returns. Unit tests use fake timers for
`vi.setSystemTime` and pin both a `.000Z` and a non-zero-millisecond `createdAt`. The integration
POST describe runs in the same file as GET (one spec per endpoint path) and reuses the seeded
rows from the GET describe for the ordering case; each case counts rows through a direct
`openDatabase` connection to prove that rejected bodies insert nothing, and the durability case
reads the raw row to see `completed` stored as `0`. The closed-store 500 case captures the pino
stream to assert one error line. `docs/architecture.md` section 3 already described POST and the
`VALIDATION_ERROR` cases correctly, so it was left unchanged.

**Review rounds.** Round 1 (build review, three parallel layers: blind hunter, edge-case hunter,
verification gap) raised 16 findings, triaged into 15 rows: 11 patched, 5 rejected, 0 deferred.
Patched: the rejection branch of the error handler logged at `debug` but no test observed it, so
the one-line-per-request guarantee was unpinned for rejected POSTs; the POST ordering case
asserted on rows seeded by the GET describe; the integration helper leaked a default repository
in the closed-store case; a JSON array body and a form-encoded body were untested; the `scoped()`
comment no longer matched the insert statement; the length unit (UTF-16 code units) was unstated;
the README hard-coded the 500 limit and the test README had one unreadable table cell; the
too-long unit case did not pin `statusCode`; and this entry lacked test counts. Rejected: a
duplicate-id contract on the in-memory double (ids only come from `crypto.randomUUID()`),
zero-width-only descriptions and lone surrogates (rare, and the fix adds branches the spine does
not ask for), and a wall clock earlier than the seeded rows. After the round: api unit suite 36
tests at 100% lines and branches, integration suite 22 tests, lint clean.

**Limitations.** The spec's "no SQL outside the places the spine assigns them" check reads the
two test files as exceptions: the Story 1.2 seed helper and the new direct reads use raw
better-sqlite3 statements on purpose, so the specs do not depend on the repository under test to
check its own writes. The `ValidationError` branch and the generic 4xx mapping both answer 400,
so a regression that drops the branch would only change the message, which the app and
integration suites pin. Docker was not needed. Before this review round the api unit suite had 35
tests at 100% lines and 100% branches, and the integration suite 20 tests.

## Story 1.5: E2E harness proves the empty and failed-load journeys against the built images

**Date:** 2026-10-26

**Agent usage.** Claude Code (model Fable 5.1) ran as a BMAD build dispatch agent on branch
`epic-1/story-1-5`, with the story spec as its only brief. It read the spec's `context:` files (the
epic 1 context and the architecture spine), the root configs, the web components and copy the specs
assert against, the api error handler and routes, `nginx.conf`, `docker-compose.yml` and the Story
1.4 log entry, then wrote the `e2e` workspace (`package.json`, `tsconfig.json`, `stack.ts`,
`run.ts`, `playwright.config.ts`, `support.ts`, `empty-state.spec.ts`, `load-failure.spec.ts`,
`stack.spec.ts`, `README.md`), replaced the root `test:e2e` stub, and updated the README and this
log. It ran every verification command itself against Docker on Colima (`aarch64`, Compose v5.6.1,
Node 24.18): `npm install`, `npx playwright install chromium`, `npm run lint`, `npm test`, the full
`npm run test:e2e`, the `--grep no-such-test` and `--grep "Empty"` runs, the teardown checks on the
`todo-e2e` and `todo` projects and port 8080, the deliberate `e2e/support.ts` type error under
`lint`, and beyond the spec's list it forced the two failure rows of the matrix: `up --build --wait`
failing on an occupied port 8081, and a missing Chromium (`PLAYWRIGHT_BROWSERS_PATH` pointed at an
empty directory).

**Prompts.** One prompt: implement the story spec, treating it as the sole source of truth, load its
context files first, and report what changed, how it was verified and what is left. No follow-up
prompting was needed.

**MCPs and tools.** No MCP servers were used. The agent worked through the shell: `npm`, `npx
playwright`, `node`, `docker`, `docker compose`, `git`, `python3` for the README and log edits, and
`perl`/`sed` for one-line patches. Playwright MCP was not used to author the specs; the DOM facts
(`<section aria-label="Todo List">`, one `role="status"` always in the DOM, `aria-busy="true"` with
visually hidden `Loading your todos`) came from reading `App.tsx` and the three components, and the
copy literals were copied from `apps/web/src/copy.ts` by hand because `e2e` never imports `apps/*`.

**What the AI missed, and debugging.** The full run passed first time (`7 passed`, Playwright
8.4 s, 55 s wall including the cached image build and both teardowns). Three things needed
correction along the way:

1. `Array.prototype.findLast` in the log-line test failed the `e2e` typecheck: `tsconfig.base.json`
   targets ES2022 and `findLast` is ES2023. Replaced with `filter(...).at(-1)` rather than raising
   the target for one call.
2. The first attempt at the "`up` fails" row occupied 8081 with `python3 -m http.server` bound to
   `127.0.0.1`. Docker still published `0.0.0.0:8081`, `up --wait` reached healthy, and Playwright's
   requests to `localhost:8081` landed on the Python server, so every `beforeEach` purge threw
   `GET /api/v1/todos answered 404: <!DOCTYPE HTML>...`. That accidentally proved the purge's
   "any other non-2xx throws with status and body" rule and that the `finally` teardown still runs
   on spec failures (exit 1, project empty), but not the intended row. Publishing 8081 from another
   container reproduced it properly: `Bind for 0.0.0.0:8081 failed: port is already allocated`,
   then `docker compose up --build --wait exited with 1`, the closing `down -v`, exit 1.
3. The spec's Code Map flagged that Playwright's loader might not resolve an explicit `./stack.ts`
   specifier. It does (1.64.1 transforms the file itself), so every file uses `./stack.ts` and the
   `./stack.js` fallback was not needed.

**Decisions made while implementing.** `compose()` in `stack.ts` runs `spawnSync` with
`encoding: 'utf8'` and defaults `stdio` to `pipe` so the specs get stdout back (`logs`, `exec`),
while `run.ts` passes `stdio: 'inherit'` so the build and `--wait` progress stream to the terminal;
a non-zero status throws with the command and captured stderr. `run.ts` catches the `up` error,
prints its message, keeps exit status 1 and still runs `down -v` in `finally`; a Playwright exit
status (including the `1` for "No tests found") is passed through with `process.exit`. The
load-failure spec asserts the status region with `toContainText` rather than `toHaveText`: the
Retry button is rendered inside the `role="status"` element, so its text is the message plus
`Retry`; the button is then located inside the same region. The log-line test asserts the health
line the matrix asks for and additionally requests a unique `GET /api/v1/nope-<uuid>` and expects
exactly one line for it, since the health URL is also hit by the `HEALTHCHECK` every five seconds
and cannot prove "one line per request" on its own. `empty-state.spec.ts` locates the Empty State
inside `getByRole('region', { name: 'Todo List' })`, so the assertion fails if the copy moves out of
the list region. The e2e `README.md` documents running the specs alone against a hand-started
stack with the same `-p todo-e2e` and `WEB_PORT=8081`, and warns that `stack.spec.ts` restarts the
containers. Measured: `empty-state` 117 ms, `load-failure` 303 ms, the five `stack` tests 11 ms to
171 ms plus 5.8 s for the restart; `--grep "Empty"` runs one test in 550 ms with the same lifecycle.

**Review rounds.** None at the time of writing; the dispatcher's build review appends here.

**Limitations.** The two `--grep` runs and both failure rows each rebuild from the Docker cache,
so a cold cache (first clone, or after a lockfile change) adds the full image build to the 55 s.
`restart` keeps the same container addresses, so nginx's one-time resolution of `api` (noted in
Story 1.4) is not exercised by the persistence test; recreating `api` alone remains untested.
Until Story 2.4 ships `DELETE /api/v1/todos/:id` the purge is a no-op on every row it finds
(the DELETE answers 404), which is why the restart test is the last test in the last file and
creates the only row of the run. Firefox and WebKit are out of scope by the spec; the Chromium
headless shell is what the run uses, and `--headed` needs the full Chromium that the same
`npx playwright install chromium` installs. The `up`-failure row was reproduced with a port
conflict only; a failing `HEALTHCHECK` would surface through the same `--wait` non-zero status.
## Story 2.2: Add a Todo from the input

**Date:** 2026-10-26

**Agent usage.** Claude Code (model Fable 5.1) ran as a BMAD build dispatch agent in a git
worktree on branch `epic-2/story-2-2`, with the story spec as its only brief. It read the spec's
`context:` files (the epic 2 context and the architecture spine), then the whole of `apps/web`,
the contract exports, the root configs and the docs the spec names, and extended the Story 1.3
files in place: `createTodo` in the client, `create`, `creating` and `writeError` in `useTodos`,
the `create` copy table and `addLabel` in `copy.ts`, `messageId` on `ErrorBanner`, the new
`TodoInput` props with focus handling, and the `App` wiring. It extended the four web test suites,
wrote `e2e/support/todos.ts`, `e2e/create.spec.ts` and `e2e/validation.spec.ts` for the Story 1.5
harness, updated the README and this log, and ran every verification command itself
(`npm run build`, `npm run lint`, `npm test`, the spec's greps and the diff check against the
baseline commit).

**Prompts.** One prompt: implement the story spec, treating it as the sole source of truth, load
its context files first, and report what changed, how it was verified and what is left.

**MCPs and tools.** No MCP servers were used. The agent worked through the shell: heredocs for
file writes, a `python3` script for the README paragraph, `prettier`, `eslint`, `tsc -b`,
`vitest` and `git`. No probe install was needed: jsdom's implicit form submission on a submit
button click, `ref.focus()` moving `document.activeElement`, and Vitest's automock of the client
module were already in the installed stack.

**What the AI missed, and debugging.** The 68 web tests passed on the first run at 100% lines
and branches, and `tsc -b` and ESLint were clean. The first `npm run lint` failed only in
Prettier, on one over-long `expect(...).toHaveLength(` line in `App.test.tsx`; fixed with
`prettier --write` and the lint re-run in full.

**Decisions made while implementing.** The client's 2xx check is a small `isTodo` guard (object
with a string `id`) rather than a full schema check, matching the spec and keeping the client
free of TypeBox. `create` clears `writeError` before trimming, so a message is cleared when a
submit starts and not while typing; `load` clears it too so a Retry never leaves a stale create
message behind. The hook keeps `creatingRef` as the synchronous in-flight guard and `creating`
state only for the disabled control, so two `fireEvent.submit` calls in one tick reach the client
once. `TodoInput` focuses the input before awaiting `onSubmit` and again after, because clicking
Add moves focus to the button and disabling it mid-request would drop focus to `body`. The
`create` while `error` case is allowed to call the client (the hook does not know why the caller
let it through) but inserts nothing; `App` prevents it in practice by disabling Add outside
`ready`. The E2E specs hard-code `/api/v1/todos` and the 500 limit with a comment each because
the `e2e` workspace has no dependencies yet; Story 1.5 can swap them for the contract exports.
`docs/architecture.md` already describes this behaviour and was left unchanged.

**Review rounds.** Round 1 (build review, three parallel layers: blind hunter, edge-case hunter,
verification gap) raised 22 findings, triaged into 16 rows: 6 patched, 10 rejected, 0 deferred.
Patched: the E2E purge threw on the 404 that `DELETE` answers until Story 2.4, so every test
after the first would have failed in `beforeEach` (the purge now tolerates 404, the specs wait
for Add to be enabled and assert relative counts with unique descriptions); the pre-await
`focus()` in `TodoInput` was unpinned (deleting it left the suite green), so a deferred
`onSubmit` test now asserts focus during the pending window; the client suite lacked a `500`
envelope case and a `2xx { id: 1 }` case; the E2E server `400` and `502` cases lacked the
`aria-describedby` and focus assertions; two generated E2E titles had the wrong article; and
the E2E copy, limit and path literals were mirrored across three files, now hoisted into
`e2e/support/copy.ts`. The dispatcher also replaced a `#id` selector built from `useId` output
with an `[id="..."]` attribute selector. Rejected: a worker race between spec files (AD-12 binds
the harness to `workers: 1`); a repeated identical local rejection not re-announcing (message
still shown and referenced by `aria-describedby`); keystrokes typed during a pending create being
cleared, and focus pulled back to the input, both inside the 100 ms action bound; `aria-invalid`
or a duplicate insert in states the disabled Add control cannot reach; `createTodo` or
`onSubmit` rejecting (neither can); and a fuller `isTodo` guard for bodies the API's schema
serialisation cannot produce. After the round: web suite 71 tests at 100% lines and branches,
lint clean.

**Limitations.** The two E2E specs are written, Prettier-clean and ESLint-clean but not executed
here: there is no Playwright, no `playwright.config.ts` and no running stack in this tree, so
Story 1.5 is the first run of `e2e/create.spec.ts` and `e2e/validation.spec.ts`. The purge
helper issues `DELETE` per Todo and tolerates a 404 until Story 2.4 adds the route; the specs
wait for Add to be enabled and assert relative list counts, so they do not depend on an empty
store. The `git diff main` boundary check is read against the spec's
baseline commit `82c339d`, because this branch predates the Story 1.4 merge and `main` now holds
the Dockerfiles that the branch does not. Focus assertions run in jsdom, so visible focus and the
danger border are asserted by CSS rather than by a test.
