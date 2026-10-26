# Review: Technology Currency (ARCHITECTURE-SPINE.md)

- Reviewed: `_bmad-output/planning-artifacts/architecture/architecture-bmad-method-2026-10-26/ARCHITECTURE-SPINE.md`
- Date: 2026-10-26
- Lens: every committed version and library claim checked against the live npm registry, nodejs.org, Docker Hub, GitHub releases, the current `create-vite` 9.3.1 tarball, and the Node 24 docs. Nothing below is asserted from memory.

## Verdict

**Needs revision before build.** Thirteen of sixteen pinned items are current and mutually compatible. Two pins are wrong for each other (`@fastify/type-provider-typebox` 6.3.0 does not peer with `@sinclair/typebox` 0.34, it peers with the renamed `typebox` 1.x), one pin is a stale image line (nginx 1.29 has had no build since April 2026 and is neither stable nor mainline), and TypeScript 5.9.3 is two majors behind both npm `latest` (7.0.2) and the Vite starter's own default (6.0.3). The rest are confirmed.

## Pinned items vs registry (checked 2026-10-26)

| Item | Pinned | Registry / source today | Verdict |
| --- | --- | --- | --- |
| Node.js | 24.22.1 (LTS Krypton) | nodejs.org index: v24.22.1, lts "Krypton", released 2026-10-20. v26.12.1 is Current, not LTS. | OK, current LTS line |
| TypeScript | 5.9.3 | `latest` 7.0.2 (native Go compiler, per-platform `@typescript/typescript-*` optional deps, 2.5 MB). Last JS-based line: 6.0.3. 5.9.3 published 2025-09-30. create-vite react-ts template pins `~6.0.3`. | Out of date, diverges from starter |
| Fastify | 5.12.7 | `latest` 5.12.7; `next` 6.0.0-alpha.5. LTS table: 5.x supports Node 20/22/24/26, EOL TBD. | OK |
| @sinclair/typebox | 0.34.52 | `latest` 0.34.52 on the scoped name, but the project moved to unscoped `typebox` 1.4.3 (modified 2026-10-22). Scoped line last modified 2026-07-16. | Legacy line; mismatched with provider pin |
| @fastify/type-provider-typebox | 6.3.0 | `latest` 6.3.0 (2026-10-12). peerDependencies: `typebox ^1.1.14`, `ajv-formats ^3.0.1`. README install: `npm i typebox`. 5.2.0 is the last version peering `@sinclair/typebox >=0.26 <=0.34`. | Mismatch with typebox pin |
| @fastify/sensible | 6.0.7 | `latest` 6.0.7; README compat `>=6.x` with Fastify `^5.x`. No peerDependencies. | OK |
| better-sqlite3 | 13.0.3 | `latest` 13.0.3 (2026-08-05). engines `node >=22`. N-API build; tarball ships `prebuilds/linuxmusl-x64.node` and `linuxmusl-arm64.node` (works on node:24-alpine with no compiler). Dependency: `node-addon-api ^8`. | OK |
| pino | 10.4.0 | `latest` 10.4.0. Fastify 5.12.7 depends on `pino ^9.14.0 \|\| ^10.1.0`, so 10.4.0 satisfies and dedupes. | OK (direct install optional) |
| React / react-dom | 19.3.1 | `latest` 19.3.1 both; react-dom peers `react ^19.3.1`. Starter pins `^19.3.1`. | OK |
| Vite | 8.3.5 | `latest` 8.3.5; engines `^20.19.0 \|\| >=22.12.0`. create-vite 9.3.1 ships `template-react-ts` (pins vite `^8.3.4`, `@vitejs/plugin-react ^6.1.2`, TS `~6.0.3`, oxlint). | OK |
| Vitest / @vitest/coverage-v8 | 5.0.5 | `latest` 5.0.5 both; vitest peers `vite ^6.4.0 \|\| ^7.0.0 \|\| ^8.0.0`; engines `^22.12.0 \|\| ^24.0.0 \|\| >=26.0.0`; coverage-v8 peers `vitest 5.0.5` exactly. jsdom/happy-dom are optional peers but one is required for DOM tests. | OK |
| @testing-library/react | 16.3.3 | `latest` 16.3.3; peers react/react-dom `^18 \|\| ^19`, `@testing-library/dom ^10.0.0` (required, not optional). | OK, missing companion pin |
| @playwright/test | 1.64.1 | `latest` 1.64.1; engines `node >=20`. | OK |
| nginx image | 1.29-alpine | Tag exists (resolves to 1.29.8-alpine3.23) but last pushed 2026-04-17. `stable-alpine` = `1.30-alpine` (1.30.6, pushed 2026-10-22); `mainline-alpine` = `1.31-alpine` (1.31.8). | Stale line, superseded |
| node image | 24-alpine | Tag pushed 2026-10-22; digest identical to `lts-alpine` and `24.22.1-alpine`. | OK |
| Docker Compose | v2 | Current. Profiles semantics checked against docs.docker.com (see M-2). | OK, with one semantic correction |

Not pinned but required by the pins above (gap): `typebox`, `ajv-formats`, `@testing-library/dom`, `jsdom` or `happy-dom`, `@vitejs/plugin-react`, `@types/react`, `@types/react-dom`, `@types/node`. Current versions: typebox 1.4.3, ajv-formats 3.0.1, @testing-library/dom 10.4.2, jsdom 30.1.3, happy-dom 21.0.4, @vitejs/plugin-react 6.1.2, @types/react 19.3.0, @types/react-dom 19.3.0, @types/node 26.6.5 (starter pins `^24.19.2`).

## Library-default claims in the spine

| Claim | Checked | Result |
| --- | --- | --- |
| `fastify.inject` for integration tests (AD-12) | fastify 5.12.7 depends on `light-my-request ^6.0.0` | Correct |
| `crypto.randomUUID()` (Conventions) | Node 24 built-in, stable | Correct |
| WAL journal mode (AD-5) | better-sqlite3 docs | Not a default; must be set explicitly with `db.pragma('journal_mode = WAL')`. The spine phrases it as a rule, which is fine, but the story must not assume it is on by default |
| `HEALTHCHECK` in both Dockerfiles (AD-11) | nginx:alpine and node:alpine have busybox `wget`, no `curl` | Syntax fine; use `wget -qO- ... \|\| exit 1`, not `curl` |
| nginx container runs as non-root (AD-11) | `nginx:1.30-alpine` runs as root by default; `nginxinc/nginx-unprivileged:1.30-alpine` exists (pushed 2026-10-19) and listens on 8080 | Claim achievable, but not with the stock image as written |
| Compose "dev (default)" profile (AD-11) | docs.docker.com: "Services without a profiles attribute are always enabled"; there is no default profile | Wording is wrong, see M-2 |
| "error code enum" in contract (AD-1, AD-3) | Starter tsconfig sets `erasableSyntaxOnly: true`; Node 24 type stripping (Stability 2) also rejects `enum` | A TS `enum` will fail under the starter's live defaults, see M-3 |
| pino listed as a separate stack item (AD-11) | fastify bundles pino | Only needed as a direct dependency if the app imports `pino` itself; otherwise `logger: true` suffices |

## Findings

### Critical

**C-1. `@fastify/type-provider-typebox` 6.3.0 does not peer with `@sinclair/typebox` 0.34.52.**
Registry metadata for 6.3.0: `peerDependencies: { typebox: "^1.1.14", "ajv-formats": "^3.0.1" }`. The README now says `npm i typebox # Required as peer dependency` and imports `Type` from `'typebox'`. The last provider version that accepts the scoped 0.34 package is 5.2.0 (`@sinclair/typebox >=0.26 <=0.34`). As pinned, `npm install` will either error on peer resolution or install two unrelated TypeBox packages, and the type provider's `Static` inference will not line up with schemas built from `@sinclair/typebox`.
Fix (preferred, forward-compatible): replace the `@sinclair/typebox 0.34.52` row with `typebox 1.4.3` and add `ajv-formats 3.0.1`; `packages/contract` imports from `'typebox'`. Note TypeBox 1.x is an API-breaking major (default `Type` import, `Type.Static`), so the contract package must be written against 1.x from the start.
Fix (conservative): keep `@sinclair/typebox 0.34.52` and pin `@fastify/type-provider-typebox 5.2.0` (2025-07-14). This freezes the contract package on a line the author has already left behind; not recommended for greenfield.

### High

**H-1. TypeScript 5.9.3 is two majors behind and does not match the starter the web app leans on.**
npm `latest` is 7.0.2 (2026-07-08, the native Go compiler shipped as per-platform binaries); 6.0.3 is the final JS-based line. The current `create-vite@9.3.1` `template-react-ts` pins `"typescript": "~6.0.3"` with `@vitejs/plugin-react ^6.1.2`. 5.9.3 was published 2025-09-30 and the spine does not say why it was chosen over the starter default.
Fix: pin `typescript 6.0.3` (matches the starter, no native-binary dependency, converts 7.0 breakages into warnings first). Optionally note 7.0.2 as the upgrade target once the project has compiled clean under 6. Also add `@vitejs/plugin-react 6.1.2`, `@types/react 19.3.0`, `@types/react-dom 19.3.0`, `@types/node 24.x` to the Stack table; they are required by the Vite 8 React setup and are currently unpinned.

**H-2. `nginx:1.29-alpine` is a dead line.**
Docker Hub: `1.29-alpine` last pushed 2026-04-17 (1.29.8 on alpine 3.23). `stable-alpine` now resolves to `1.30-alpine` (1.30.6, alpine 3.24, pushed 2026-10-22) and `mainline-alpine` to `1.31-alpine` (1.31.8). Under nginx's odd/even scheme 1.29 was the mainline that became 1.30 stable; it receives no further patches, so the web image would ship six months of unpatched nginx and alpine.
Fix: pin `nginx:1.30-alpine` (stable). If AD-11's non-root requirement is to be met with a stock image rather than a hand-rolled config, pin `nginxinc/nginx-unprivileged:1.30-alpine` instead (exists, pushed 2026-10-19, already listens on 8080 which matches the Ports convention).

### Medium

**M-1. `@testing-library/react` 16.3.3 and Vitest need companion packages the Stack omits.**
`@testing-library/dom ^10.0.0` is a required (non-optional) peer of @testing-library/react 16.3.3; Vitest DOM tests need `jsdom` or `happy-dom` (both optional peers of vitest 5.0.5, neither installed by default).
Fix: add `@testing-library/dom 10.4.2` and `jsdom 30.1.3` (or `happy-dom 21.0.4`) to the Stack table and set `test.environment` in `apps/web` Vite config.

**M-2. "Compose profiles: `dev` (default, ...)" is not how Compose profiles work.**
Compose docs (checked 2026-10-26): "Services without a profiles attribute are always enabled"; there is no notion of a default profile, and a service tagged `profiles: [dev]` only starts with `--profile dev` or `COMPOSE_PROFILES=dev`. As written a reader will tag the dev services with `profiles: [dev]` and `docker compose up` will start nothing.
Fix: reword AD-11 to "dev services carry no `profiles` key (always enabled); the `test` profile adds the built-image services and a fresh volume", or ship `COMPOSE_PROFILES=dev` in `.env.example` and document that override.

**M-3. "error code enum" in `packages/contract` conflicts with the starter's live TypeScript defaults.**
`create-vite` 9.3.1's `tsconfig.app.json` sets `erasableSyntaxOnly: true`, which rejects TS `enum`; Node 24's built-in type stripping (Stability 2 in the v24 docs) also cannot run files containing `enum`. The contract package is consumed by both the Vite app and the API.
Fix: define `ErrorCode` as `{ VALIDATION_ERROR: 'VALIDATION_ERROR', ... } as const` plus a union type, or as a `Type.Union([Type.Literal(...)])` TypeBox schema; say "error code union" rather than "enum" in AD-1/AD-3 and `src/errors.ts`.

**M-4. Non-root claim for the web container is not satisfied by the stock nginx image.**
`nginx:*-alpine` starts as root and drops privileges only for worker processes; `HEALTHCHECK` and the AD-11 "run as a non-root user" rule need either `USER nginx` with a rewritten `nginx.conf` (pid path, temp paths, port 8080) or the `nginxinc/nginx-unprivileged` image.
Fix: see H-2; name the unprivileged image explicitly in the Stack table or add the config requirements to AD-11.

### Low

**L-1. WAL is not a better-sqlite3 default.** AD-5 reads as if WAL comes with the connection. Add "set via `db.pragma('journal_mode = WAL')` at open" so the story does not skip it. Also, the `/data` volume must be writable by the non-root API user (WAL creates `-wal` and `-shm` siblings next to the db file); mention `chown` in the Dockerfile or a `user:` in compose.

**L-2. `HEALTHCHECK` commands must use `wget`.** Neither `node:24-alpine` nor `nginx:1.30-alpine` ships `curl`. Specify `HEALTHCHECK CMD wget -qO- http://127.0.0.1:3000/api/v1/health || exit 1` (api) and `wget -qO- http://127.0.0.1:8080/healthz || exit 1` (web), or `node -e "fetch(...)"` for the API.

**L-3. pino as a direct dependency is optional.** Fastify 5.12.7 depends on `pino ^9.14.0 || ^10.1.0`; `logger: true` gives JSON lines with `method`, `url`, `statusCode`, `responseTime` without importing pino. Keep the 10.4.0 pin only if the app imports `pino` (for example for `pino.destination` or tests); otherwise drop the row to avoid an unused direct dependency.

**L-4. better-sqlite3 13 on Node 24 alpine: confirmed, no action.** v13 moved to N-API and ships `prebuilds/linuxmusl-x64.node` and `linuxmusl-arm64.node` inside the npm tarball (GitHub releases for 13.x carry no assets by design), so the multi-stage build does not need python3/make/g++. Worth stating in the Dockerfile story so nobody adds a build toolchain reflexively. For awareness only: Node 24 also ships `node:sqlite` at Stability 1.2 (release candidate), a zero-native-dependency alternative behind the `TodoRepository` port; not recommended for v1 given its stability tag, but it is the obvious future swap.

**L-5. Dev runner for `apps/api` is unspecified.** Node 24 runs `.ts` directly (type stripping, Stability 2), so `node --watch src/server.ts` works without `tsx` provided the code stays erasable-syntax-only (which M-3 already requires). If the team prefers `tsx`, current is 4.23.15; pin it.

**L-6. Starter lint tool differs from the spine's `lint` script expectations.** `template-react-ts` now ships `oxlint ^1.88.0` as `lint`, not ESLint. The spine only names a root `lint` script, so this is not a conflict, but the story that scaffolds `apps/web` should either keep oxlint or consciously swap it; do not assume ESLint.

## Confirmed without findings

Node 24.22.1 = current Krypton LTS release (2026-10-20); `node:24-alpine` digest equals `lts-alpine`. Fastify 5.12.7, @fastify/sensible 6.0.7, better-sqlite3 13.0.3, pino 10.4.0, React 19.3.1, Vite 8.3.5, Vitest 5.0.5, @vitest/coverage-v8 5.0.5, @testing-library/react 16.3.3, @playwright/test 1.64.1 are all registry `latest`, none deprecated, none prereleases, engines all satisfied by Node 24. Vitest 5 peers Vite 8; coverage-v8 is version-locked to Vitest 5.0.5 as pinned. `create-vite` 9.3.1 still ships `template-react-ts`. `fastify.inject` and `crypto.randomUUID()` are valid for the pinned versions.
