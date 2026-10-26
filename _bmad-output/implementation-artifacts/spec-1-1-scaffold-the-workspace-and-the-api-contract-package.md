---
title: 'Story 1.1: Scaffold the workspace and the API contract package'
type: 'feature'
created: '2026-10-26'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '51d7489c62cfefd452a4f3364c4e716369e22226'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-bmad-method-2026-10-26/ARCHITECTURE-SPINE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The repository holds only a README. Every later story needs one shared API contract, a workspace layout, and lint and test commands that already enforce the 70% coverage gate, so nothing is invented per app.

**Approach:** Hand-scaffold the npm workspaces monorepo from the architecture spine's Structural Seed: `packages/contract` fully implemented and tested, `apps/api` and `apps/web` as minimal compiling workspaces with Vitest wired, root fan-out scripts, lint and format config, `.env.example`, `.dockerignore`, README skeleton, `docs/architecture.md` and `docs/ai-integration-log.md`.

## Boundaries & Constraints

**Always:** ESM `"type": "module"` everywhere; `tsconfig.base.json` with `strict`, `erasableSyntaxOnly`, `verbatimModuleSyntax`; no TypeScript `enum`, no parameter properties; contract depends on nothing in the repo, apps depend on contract only; contract builds first in every script; versions match the spine's Stack table (if a pinned version is absent from the registry, use the newest release of the same major and record it in `docs/ai-integration-log.md`); one root `package-lock.json`; one root ESLint flat config and one root Prettier config; Vitest coverage via `@vitest/coverage-v8` gated at 70% lines and branches per app with `LOG_LEVEL=silent`.

**Never:** No Fastify routes, SQLite, React components or Dockerfiles (Stories 1.2 to 1.4). No literal `/api/v1` paths or `Todo` types outside `packages/contract`. No CSS framework, no state library, no router. No CI pipeline files. Do not commit `dist/` or `node_modules/`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Valid Todo | `{ id: "6f1c…", description: "x", completed: false, createdAt: "2026-10-26T11:42:07.512Z" }` | `TodoSchema` accepts; `id` and `createdAt` are plain `Type.String()` with no `format` keyword (server assigns both; avoids a second definition of valid under Ajv) | N/A |
| Unknown field | Todo with extra `owner` | `TodoSchema` rejects (`additionalProperties: false`) | N/A |
| Create body | `{ description: "x" }` | `CreateTodoBodySchema` accepts; non-string or extra field rejects | N/A |
| Empty PATCH | `{}` | `UpdateTodoBodySchema` rejects (`minProperties: 1`) | N/A |
| PATCH both | `{ description: "y", completed: true }` | accepts | N/A |
| Error body | `{ code: "NOT_FOUND", message: "m" }` | `ErrorBodySchema` accepts; code outside `ErrorCode` rejects | N/A |
| Paths | `todoPath("abc")` | `/api/v1/todos/abc`; `TODOS_PATH` is `/api/v1/todos`; `HEALTH_PATH` is `/api/v1/health`; no trailing slash | N/A |

</frozen-after-approval>

## Code Map

- `README.md` -- only existing file; replace with the skeleton.
- `_bmad-output/planning-artifacts/architecture/architecture-bmad-method-2026-10-26/ARCHITECTURE-SPINE.md` -- AD-1 (contract exports), AD-2 (schemas), AD-3 (error codes), AD-12 (test homes), Stack table (versions), Structural Seed (tree).
- `_bmad-output/planning-artifacts/architecture/architecture-bmad-method-2026-10-26/architecture.md` -- copy to `docs/architecture.md` (fix the `spine:` link).
- `_bmad-output/implementation-artifacts/epic-1-context.md` -- distilled constraints; load instead of PRD.
- Local toolchain: Node 24.18.0, npm 11.16.0, no Docker (irrelevant here).

## Tasks & Acceptance

**Execution:**
- [x] `package.json` -- root: `private`, `workspaces: ["packages/*", "apps/*", "e2e"]`, scripts `build` (`npm run build -w packages/contract && npm run build -w apps/api && npm run build -w apps/web`), `test` (contract, api, web with coverage), `test:int` (api `*.int.test.ts`, placeholder passing config), `test:e2e` (placeholder: prints "configured in Story 1.5" and exits 0), `lint` (`eslint . && prettier --check .`), `format`; devDeps: typescript, eslint stack, prettier, vitest, @vitest/coverage-v8, @types/node; `engines.node >=24` -- fan-out owner.
- [x] `tsconfig.base.json` -- strict, erasableSyntaxOnly, verbatimModuleSyntax, `target ES2022`, `skipLibCheck` -- shared compiler base.
- [x] `eslint.config.js`, `.prettierrc`, `.prettierignore` -- ESLint 10 flat config with typescript-eslint and react-hooks; both ignore `dist`, `node_modules`, `coverage`, `_bmad*`, `.claude`; `.prettierignore` also lists `package-lock.json`, `CONTEXT.md`, `PRD.md`, `docs/architecture.md` (pre-existing or verbatim-copied prose, not ours to reformat) -- single lint source.
- [x] `.gitignore`, `.dockerignore`, `.env.example`, `.nvmrc` -- ignore `node_modules`, `dist`, `coverage`, `.env`; dockerignore per AD-13; env example lists `HOST`, `PORT`, `DB_PATH`, `LOG_LEVEL`, `NODE_ENV`, `API_PROXY_TARGET`, `WEB_PORT` with defaults; nvmrc `24`.
- [x] `packages/contract/package.json`, `tsconfig.json` -- name `@todo/contract`, `dependencies: { "typebox": "1.4.3" }` (unscoped package; import as `import Type from 'typebox'` and `import Value from 'typebox/value'`), `exports`/`types` -> `dist/index.js`/`dist/index.d.ts`, tsconfig extends base with `module: nodenext`, `types: ["node"]`, `declaration: true`, `rootDir: src`, `outDir: dist`, scripts `build` (tsc), `dev` (tsc --watch), `test` -- the only API definition.
- [x] `packages/contract/src/todo.ts` -- `Todo` type, `TodoSchema`, `TodoListSchema`, `CreateTodoBodySchema`, `UpdateTodoBodySchema` (`minProperties: 1`, `additionalProperties: false`), `DESCRIPTION_MAX = 500` -- AD-2, AD-6.
- [x] `packages/contract/src/errors.ts` -- `ErrorCode` as const + union, `ErrorBodySchema`, `HealthBodySchema` -- AD-3.
- [x] `packages/contract/src/routes.ts` -- `API_PREFIX`, `TODOS_PATH`, `todoPath(id)`, `HEALTH_PATH` -- AD-1.
- [x] `packages/contract/src/index.ts` -- re-exports.
- [x] `packages/contract/src/contract.test.ts` -- Vitest + TypeBox `Value.Check` covering every I/O Matrix row -- proves the contract.
- [x] `packages/contract/vitest.config.ts` -- plain node environment.
- [x] `apps/api/package.json`, `tsconfig.json`, `vitest.config.ts`, `vitest.int.config.ts`, `src/server.ts`, `src/server.test.ts` -- name `@todo/api`, depends on `@todo/contract`, `module: nodenext`, build via tsc; `vitest.config.ts` has `include: ['src/**/*.test.ts']`, `test.env: { LOG_LEVEL: 'silent' }`, coverage thresholds 70/70; `vitest.int.config.ts` has `include: ['test/**/*.int.test.ts']` and script `test:int` runs it with `--passWithNoTests` until 1.2 adds specs; `src/server.ts` is the placeholder entry 1.2 replaces, with one smoke test importing `TODOS_PATH` -- compiling placeholder for 1.2.
- [x] `apps/web/package.json`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `vite.config.ts`, `vitest.config.ts`, `index.html`, `src/main.tsx`, `src/main.test.tsx` -- name `@todo/web`; deps `react`, `react-dom` 19.3.1 and devDeps `@types/react`, `@types/react-dom` 19.3.0 now (Testing Library peers), `@testing-library/react`, `@testing-library/dom`, `jsdom`, `vite`, `@vitejs/plugin-react`; three-file create-vite `react-ts` tsconfig layout where `tsconfig.json` holds references and `tsconfig.app.json`/`tsconfig.node.json` extend `tsconfig.base.json` with `moduleResolution: bundler`, `jsx: react-jsx`, `lib: ["ES2022", "DOM", "DOM.Iterable"]`, `types: ["vite/client"]`; scripts `build: "tsc -b && vite build"`, `dev: "vite"`; `vite.config.ts` sets `server.host: true` and proxies `/api` to `process.env.API_PROXY_TARGET` default `http://localhost:3000`; `vitest.config.ts` has `environment: 'jsdom'`, `include: ['src/**/*.test.{ts,tsx}']`, `test.env: { LOG_LEVEL: 'silent' }`, coverage thresholds 70/70; `src/main.tsx` renders a placeholder `<h1>` and `src/main.test.tsx` smoke-tests it importing `TODOS_PATH` -- compiling placeholder for 1.3.
- [x] `e2e/package.json`, `e2e/README.md` -- workspace stub naming Story 1.5 as owner; no Playwright yet.
- [x] `docs/architecture.md` -- copy of the readable architecture document with the frontmatter `spine:` link rewritten to `../_bmad-output/planning-artifacts/architecture/architecture-bmad-method-2026-10-26/ARCHITECTURE-SPINE.md` so it resolves from `docs/`.
- [x] `docs/ai-integration-log.md` -- header plus a Story 1.1 entry (agent usage, prompts, MCPs, what AI missed, debugging, limitations) -- graded, append-only.
- [x] `README.md` -- project name, prerequisites, layout tree, commands, link to `docs/architecture.md`; sections for Docker and E2E marked "added in Story 1.4 / 1.5".

**Acceptance Criteria:**
- Given a clean checkout, when `npm ci && npm run build` runs, then contract builds to `dist/` before api and web and both apps compile against `@todo/contract` with no local `Todo` type or literal path.
- Given the workspace, when `npm run lint` runs, then ESLint and Prettier pass with zero findings.
- Given the workspace, when `npm test` runs, then contract, api and web suites pass and coverage reports per app meet 70% lines and branches.
- Given `package.json` files, when compared to the spine's Stack table, then every pinned version matches or the deviation is logged in `docs/ai-integration-log.md`.
- Given the repo root, then `tsconfig.base.json`, `.env.example`, `.dockerignore`, `.nvmrc`, `README.md`, `docs/architecture.md` and `docs/ai-integration-log.md` exist with the content above.

### Review Findings

Code review of branch `epic-1/story-1-1` vs `main` (2026-10-26), four layers: blind-hunter, edge-case-hunter, verification-gap, acceptance-auditor. 21 findings, 13 entries after grouping.

- [x] [Review][Patch] Pin the five remaining contract type exports (`TodoList`, `CreateTodoBody`, `UpdateTodoBody`, `ErrorBody`, `HealthBody`) with typed fixtures in the contract test so `typecheck` fails if one is removed [packages/contract/src/contract.test.ts:17] (verification-gap, medium)
- [x] [Review][Patch] AI log Decisions paragraph is stale: says `lint` does not build the contract and that every package has `tsconfig.test.json`; web has none and `lint` now builds the contract [docs/ai-integration-log.md:56] (blind-hunter+acceptance-auditor, medium)
- [x] [Review][Patch] AI log omits the review round (18 findings, 11 patched) that produced most of this story's "what the AI missed" [docs/ai-integration-log.md] (blind-hunter, medium)
- [x] [Review][Patch] `.dockerignore` misses `.env.*` (with `!.env.example`), `*.log`, `.DS_Store`, `.claude`, `CONTEXT.md`, `PRD.md`; local env files would enter the build context in Story 1.4 [.dockerignore:8] (edge-case-hunter+blind-hunter, medium)
- [x] [Review][Patch] ESLint `globalIgnores` lacks `test-results/` and `playwright-report/`; first local E2E run after 1.5 breaks `npm run lint` [eslint.config.js:7] (edge-case-hunter+blind-hunter, low)
- [x] [Review][Patch] Web Vitest has no `setupFiles` calling `afterEach(cleanup)`; Testing Library auto-cleanup never registers, so 1.3 component tests will leak trees [apps/web/vitest.config.ts] (edge-case-hunter+blind-hunter, low)
- [x] [Review][Patch] `apps/api/tsconfig.test.json` includes only `src/**/*.test.ts`; 1.2 integration specs under `test/` would never be type-checked [apps/api/tsconfig.test.json] (edge-case-hunter, low)
- [x] [Review][Patch] Contract tests do not pin AD-6: no assertion that `description` is plain `{ type: 'string' }` on Create/Update schemas, that Update rejects a non-string `description`, or that ErrorBody rejects a non-string `message` [packages/contract/src/contract.test.ts] (blind-hunter, low)
- [x] [Review][Patch] Root `lint` builds the contract third, not first; frozen constraint says contract builds first in every script [package.json lint script] (acceptance-auditor, low)
- [x] [Review][Patch] README: `lint` row omits contract build and typecheck; layout tree omits `.nvmrc`, `.dockerignore`, `.gitignore`, `.prettierignore`, `apps/api/test/`; "every root script builds the contract" overstates `test:e2e` [README.md] (blind-hunter+acceptance-auditor, low)
- [x] [Review][Patch] README requires npm 11 but `engines` lists only node; add `"npm": ">=11"` [package.json engines] (blind-hunter, low)
- [x] [Review][Patch] `.env.example` labels `NODE_ENV=production` as a default though it is a compose value; `docs/qa/README.md` omits `walkthrough.md` that epics.md places there [.env.example:7, docs/qa/README.md] (blind-hunter, low)
- [x] [Review][Patch] `apps/web/tsconfig.app.json` is a subset of the create-vite `react-ts` settings the spine names (missing `moduleDetection`, `allowImportingTsExtensions`, `useDefineForClassFields`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `noUncheckedSideEffectImports`) [apps/web/tsconfig.app.json] (acceptance-auditor, low)

**Rejected**
- `todoPath('')` yields a trailing slash (edge-case-hunter): low; ids are server-assigned, no caller passes an empty id, guard adds a branch.
- `API_PROXY_TARGET` without a scheme breaks the proxy at runtime (edge-case-hunter): low; dev-only misconfiguration that fails loudly per request; `new URL` guard adds complexity.
- `engines` advisory, add `.npmrc engine-strict` (edge-case-hunter): low; unlikely in practice, adds config.
- `App` exported from `main.tsx` and renders a contract path (acceptance-auditor): low; deliberate placeholder kept in review round 1, Story 1.3 replaces the shell.
- Spec Implementation Notes overstate "removing a contract type export fails lint" (verification-gap other): fix is an edit to the spec under review; the code gap itself is entry 1.

## Implementation Notes

- Implemented by a dispatch subagent from the spec alone; verified by the dispatcher against the diff from baseline `51d7489` and a fresh run of `npm run build`, `npm run lint`, `npm test`, `npm run test:int`, `npm run test:e2e` and the `todoPath` import check. All green; coverage 100% lines and branches in contract, api and web.
- Root `test` and `test:int` scripts build the contract first so a clean checkout can run them; `lint` does not (ESLint is non-type-aware).
- Test files are excluded from each `tsc` build (not emitted to `dist/`), so Vitest transpiles them without type-checking. Recorded as a limitation in `docs/ai-integration-log.md`.
- `apps/web/tsconfig.node.json` adds `types: ["node"]` next to `vite/client` because `vite.config.ts` reads `process.env`.
- Coverage thresholds also apply to `packages/contract`, beyond the two apps the spec named.
- `todoPath` URL-encodes its id so a malformed id cannot alter the path shape.
- No api `dev` script yet; it needs `tsx`, which Story 1.2 introduces.
- Docker is not installed on this machine; not needed for this story.
- Code review (round 2, branch vs main): 21 findings, 13 patched (five remaining type exports pinned, AI log corrected and review rounds recorded, ignore-file drift, Testing Library cleanup, api test typecheck include, lint order, README, engines.npm, env labels, create-vite tsconfig flags), 5 rejected, 0 deferred. Full verification rerun green; removing any of the six contract type exports now fails `npm run lint`.
- Review round 1: 18 findings triaged, 11 patched by the implementer (test type-checking via `tsconfig.test.json` + `typecheck` in root `lint`, README env guidance, Vite proxy key and fallback, `#root` guard, ignore files, docs stubs and notes, test rename), 6 rejected, 1 deferred. Full verification rerun green; removing a contract type export now fails `npm run lint`.

## Spec Change Log

## Review Triage Log

| # | Layer | Location | Claim | Verdict | Evidence | Route |
|---|---|---|---|---|---|---|
| 1 | verification-gap | `packages/contract/src/index.ts` type re-exports | No type-check covers the exported types; deleting `type Todo` leaves build, test, lint green | medium | Pre-verified by the layer (demonstrated). Contract and api exclude `*.test.ts` from tsc; Vitest does not type-check. Story 1.2/1.3 would find a regression late. | patch |
| 2 | blind, verification-gap, edge-case | `docs/ai-integration-log.md`, spec notes vs `apps/web/tsconfig.app.json` | Log says tests are not type-checked; web does type-check its test | low | `tsconfig.app.json` includes `src` with no exclude; confirmed. Same root cause as 1. | patch (with 1) |
| 3 | blind, verification-gap, edge-case | `README.md`, `.env.example`, `apps/web/vite.config.ts` | README says copy `.env`; Vite config reads `process.env` and never loads `.env` | medium | Vite only exposes `VITE_` keys via `import.meta.env`; config file reads `process.env`; nothing loads a root `.env`. Developer following README gets a silent wrong proxy. AD-9 fixes the `process.env` read, so the doc is what is wrong. | patch |
| 4 | edge-case | `apps/web/vite.config.ts:11` | `??` keeps an empty-string target; http-proxy throws per request | low | Verified: `'' ?? x` is `''`. Direct fix `\|\|`. | patch |
| 5 | edge-case | `apps/web/vite.config.ts:10` | `/api` prefix also proxies `/apiary.png` | low | Vite proxy keys prefix-match; AD-9 says `/api/`. Direct fix `^/api/`. | patch |
| 6 | blind | `README.md` layout tree | Lists `docs/qa/` which does not exist | low | Confirmed absent on disk. Direct fix: stub README. | patch |
| 7 | blind | `docs/architecture.md` §9 | "same folder" references and `/PRD.md` paths read from the planning folder's viewpoint | low | Confirmed; the copy only fixed the `spine:` link. One-line note at top is a direct correction. | patch |
| 8 | blind, edge-case | `apps/web/src/main.tsx:23` | `as HTMLElement` cast crashes inside React when `#root` is missing; import has side effects | low | `index.html` always has `#root`, but any importer of `App` triggers the mount. Null guard is a direct correction. Splitting `App.tsx` is Story 1.3 work. | patch (guard only) |
| 9 | blind | `.gitignore`, `.dockerignore` | Missing `.env.*`, `*.log`, Playwright outputs, `*.tsbuildinfo` | low | Confirmed absent; direct additions. | patch |
| 10 | blind | `apps/api/src/server.test.ts` | Test name oversells; it proves import resolution only | low | True; `ROUTES.todos` is assigned `TODOS_PATH`. Rename is a direct correction. | patch |
| 11 | edge-case | `apps/web/package.json`, `README.md` | `npm run dev -w apps/web` alone on a fresh checkout fails: contract `dist/` missing | low | README invites running workspace scripts alone; contract `exports` point at `dist/`. README note is a direct correction. | patch |
| 12 | blind | `eslint.config.js` | No lint rule enforces "no `/api/v1` literal outside contract" | low | True but not a defect in the diff; the fix adds config. Rejected: low, fix adds complexity. | reject |
| 13 | blind | `package-lock.json` | Absent from the diff | false | Excluded from the review diff deliberately as generated; present on disk and in the working tree. | reject |
| 14 | blind | `packages/contract/src/errors.ts` | `HealthBodySchema` in the wrong module | low | Cosmetic; the spec task placed it in `errors.ts`. Fix would edit this build's spec. | reject |
| 15 | blind | three `vitest.config.ts` files | Duplicated coverage config; contract lacks `LOG_LEVEL` | low | Harmless; contract has no logging; consolidating adds a root config. Rejected: low, fix adds complexity. | reject |
| 16 | blind | `packages/contract/tsconfig.json` | `types: ["node"]` on a runtime-agnostic package | false | Spine TypeScript convention mandates `types: ["node"]` for contract and api. | reject |
| 17 | edge-case | `packages/contract/src/routes.ts:8` | `todoPath('')` yields a trailing slash | low | Ids are server-assigned; no caller passes an empty id. Unreachable in shown code; guard adds a branch. | reject |
| 18 | verification-gap | `apps/api/package.json:10` | `--passWithNoTests` will hide a mis-globbed spec after Story 1.2 | low | True once 1.2 adds specs; not this story's defect. Reminder for 1.2. | defer |

## Verification

**Commands:**
- `npm ci` -- expected: installs without peer warnings that fail; one root lockfile written.
- `npm run build` -- expected: `packages/contract/dist/index.js` and `.d.ts` exist; api and web build succeed.
- `npm run lint` -- expected: exit 0.
- `npm test` -- expected: all suites green; coverage summary per app at or above 70% lines and branches.
- `node -e "import('@todo/contract').then(c=>console.log(c.todoPath('x')))"` from `apps/api` -- expected: `/api/v1/todos/x`.
