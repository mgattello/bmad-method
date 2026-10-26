---
type: review
lens: rubric
target: ../ARCHITECTURE-SPINE.md
reviewed: '2026-10-26'
verdict: PASS WITH FIXES
---

# Rubric Review: Architecture Spine (Todo App)

Gate verdict: **PASS WITH FIXES**. The spine fixes the right contract surfaces (API shape, error envelope, layering, persistence, client state, ordering, single origin, test homes) and no checklist item fails outright. The fixes are internal contradictions and a handful of integration seams that separately built units would resolve differently.

## Checklist verdicts

| # | Item | Verdict |
|---|---|---|
| 1 | Fixes the real divergence points, misses none | PASS WITH FIXES |
| 2 | Every Rule enforceable and prevents its stated divergence | PASS WITH FIXES |
| 3 | Nothing under Deferred could let two units diverge | PASS WITH FIXES |
| 4 | Named tech current, versions pinned | PASS |
| 5 | Covers the PRD's capabilities (FR-1..15, NFRs) | PASS WITH FIXES |
| 6 | Every owned dimension decided, deferred, or open | PASS WITH FIXES |
| 7 | Seed minimal; invariants not buried in seed | PASS |
| 8 | No placeholders, no rationale prose, valid mermaid | PASS WITH FIXES |

### 1. Divergence points for the level below

The epics this spine must hold together are roughly: contract + repo setup, API, web, deployment, tests. The cross-unit surfaces are mostly fixed. Three seams are left open where two agents would plausibly pick differently: how `packages/contract` is consumed by the two apps (built `dist` vs source), how the dev compose profile serves the web app (nginx image vs Vite dev server, and what answers the HEALTHCHECK), and how E2E specs reset persisted state. Findings H-2, M-1, M-2, M-4.

### 2. Enforceability and "Prevents"

All twelve Rules are yes/no checkable. Two pairs contradict each other (AD-2 health 503 body vs AD-3 "every non-2xx body is `{ code, message }`"; AD-4 "service owns the ordering guarantee" vs AD-8 ordering on `GET`), and AD-6's route-level `maxLength` undercuts its own trim-then-validate rule at the boundary. Findings H-1, L-1, L-2.

### 3. Deferred

Mostly clean. One Deferred bullet smuggles in an ambiguous invariant ("bounded at 200"), one leaves an error code undefined (413 from the Fastify default body limit), and the accessibility-audit bullet leaves it open whether an automated axe run becomes a fifth test level outside the AD-12 table. Findings M-3, L-3, L-4.

### 4. Tech currency

Every entry is pinned to a patch version; nothing named is end-of-life. Node 24 is the active LTS line, Fastify 5, React 19, Vite 8, Vitest 5 and Playwright 1.6x are all current-generation. Versions could not be verified against the registry from this review, so treat the pins as plausible rather than confirmed. The table omits the linter/formatter the `lint` script implies (see M-4).

### 5. PRD capability coverage

FR-1 through FR-15 each have a map row. Gaps: FR-14's failed-list-load Error State with retry control is not governed by any AD (AD-7 only covers writes, and "loads the list once on mount" reads as forbidding a reload). The map has no rows for NFR-Performance (1 s initial render at 200 items, Lighthouse 90), NFR-Reliability, NFR-Accessibility (aria-live, keyboard path are in Conventions but unmapped) or Browser support (Firefox/Safari must not break). Findings M-2, L-5, L-6.

### 6. Dimensions

Deployment/environments (dev, test; prod deferred), config (AD-11), logging (AD-11), health (AD-11), schema lifecycle (AD-5, migrations deferred) and input security (AD-6) are decided. Silent: backup/restore or reset of the data volume; metrics/tracing; transport security headers on nginx (CSP, nosniff); dependency/audit policy; SQL parameterisation as an explicit rule. Each should be one line under Deferred or one clause in an AD. Findings L-7, L-8, L-9.

### 7. Seed

Stack, tree, diagrams are scaffold-sized. The `buildApp()` / `server.ts` split only appears as a tree comment yet AD-12's `fastify.inject` integration level depends on it; promote one sentence to AD-4 or AD-12. Finding L-10.

### 8. Placeholders, rationale, mermaid

No template comments. AD-1 carries a `[ADOPTED]` status tag that no other AD has; either tag all or drop it. Deferred bullets carry short rationale fragments ("Not before.", "Single-user deployment.", "Brief grades dev/test only.") that belong in the memlog. The Structural Seed `graph LR` uses literal `\n` in node labels, which Mermaid renders as the two characters, and an unquoted edge label containing `->`. Findings L-11, L-12, L-13.

## Findings

### Critical

None.

### High

- **H-1 (AD-2, AD-3): health 503 body contradicts the error envelope rule.** AD-2 returns `503 { status: "degraded" }`; AD-3 says every non-2xx body is `{ code, message }`. The contract author, error-handler author and integration-test author will each pick one. Fix: make the health route exempt in AD-3 ("every non-2xx body from `/todos` routes"), or add `UNAVAILABLE` (503) to the code enum and return the envelope.
- **H-2 (AD-9, AD-11, Conventions Ports): the dev profile cannot satisfy its own rules.** Dev is "bind-mounted sources, hot reload", so the web container runs the Vite dev server, not the nginx stage; yet AD-9 says nginx serves and proxies, AD-11's web HEALTHCHECK is nginx `/healthz`, and Ports says web is `8080` (Vite defaults to 5173). The DevOps and web agents will resolve this differently and `docker compose up` will not report both containers healthy in dev. Fix: state that the dev profile targets a `dev` stage running `vite --host 0.0.0.0 --port 8080` with the same `/api/` proxy, that `/healthz` is served by a Vite middleware or the HEALTHCHECK uses `/` in dev, and that `node_modules` is excluded from the bind mount (anonymous volume) because of native modules. Then re-read "dev and test differ only by env vars and profile" and either keep it true or scope it.

### Medium

- **M-1 (Design Paradigm, Conventions Package manager): contract package consumption is unspecified.** The package name, `"type": "module"`, and whether `apps/api` (Node) and `apps/web` (Vite) import a built `dist` with `exports` or raw TS source are not fixed; neither is build order in the root `build` script or how the API runs TS in dev (`tsx`, `node --watch` with native type stripping, or `tsc` then `node`). Fix: one Conventions row: package `@todo/contract`, ESM, `exports` points to `dist/`, root `build` runs contract first; api dev runs `tsx watch src/server.ts`, prod runs `node dist/server.js`.
- **M-2 (AD-7, Capability map FR-14, FR-5): initial-load failure and retry are ungoverned.** FR-14 requires an Error State with a retry control in place of the list on load failure; AD-7 only covers write failures and says the list "loads once on mount". FR-5 Loading State is mapped to AD-7, which does not mention it. Fix: add to AD-7: the list state is one of `loading | error | loaded`; load failure replaces the list with an error plus retry that re-issues the same load; Loading never shows Empty.
- **M-3 (Deferred, Pagination): "returns all items (bounded at 200)" is ambiguous.** It can be read as a server-side cap, which would make the API truncate and the web assume completeness. Fix: "returns every item; NFR-Performance is measured at 200 items; no server cap."
- **M-4 (AD-12, Deferred, Conventions): E2E state isolation is undecided.** The `test` profile promises a "fresh DB volume" but not per run, per spec or per test; there is no reset endpoint ("no other endpoints in v1") and Playwright runs specs in parallel by default, so the empty-state spec and the create spec will race unless someone decides. Fix: add to AD-12: `workers: 1`, `fullyParallel: false`, each spec's `beforeEach` lists and deletes all todos through the API; `test` profile uses a volume removed by `docker compose down -v` in the `test:e2e` script.
- **M-5 (Conventions, Stack): lint/format tooling is unnamed.** The root `lint` script exists but no linter, formatter or shared `tsconfig` base is fixed; three workspaces built separately will each choose. Fix: pin ESLint (flat config) + Prettier or Biome in Stack, one root config, one `tsconfig.base.json` with `strict: true` extended by every workspace.

### Low

- **L-1 (AD-4 vs AD-8): where ordering is implemented is stated twice, differently.** AD-4 gives `TodoService` the "ordering guarantee", AD-8 makes it a `GET` property. Fix: "repository `list()` returns rows in AD-8 order via SQL `ORDER BY`; the service does not re-sort."
- **L-2 (AD-6): route `maxLength: 500` on the raw string contradicts "trim, then require 1 to 500".** A 503-char input with trailing spaces is valid by the service rule and rejected by the route. Fix: drop the route maxLength or restate the rule as "raw length <= 500, then trim, then non-empty". Also decide the result for a non-UUID `:id` (400 or 404).
- **L-3 (AD-3, Deferred): Fastify default body limit yields a 413 that has no code in the enum.** Fix: "any other 4xx raised by Fastify maps to `VALIDATION_ERROR` with its status preserved" or add `PAYLOAD_TOO_LARGE`.
- **L-4 (Deferred, Lighthouse/axe): an automated axe run would be a fifth test level with no home.** Fix: "if automated, accessibility audits are Playwright specs in `e2e/` and count toward the five".
- **L-5 (Capability map): no rows for NFR-Performance, NFR-Reliability, NFR-Accessibility.** Fix: add rows pointing at AD-7/Conventions (performance), AD-3/AD-5 (reliability), Conventions Accessibility.
- **L-6 (Conventions): browser support absent.** PRD requires no breakage in current Firefox and Safari, audits on Chromium. Fix: one Conventions row; Playwright `projects: [chromium]` with Firefox/WebKit as a manual check.
- **L-7 (AD-5): SQL parameterisation is implicit.** NFR-Security names injection into the store. Fix: add "all SQL is prepared statements with bound parameters; no string interpolation" and pin `PRAGMA synchronous` (`FULL` for "durable before reply" under WAL).
- **L-8 (Deferred): data lifecycle and observability beyond logs are silent.** Fix: add Deferred lines for volume backup/restore and for metrics/tracing.
- **L-9 (AD-9 or Deferred): nginx security headers are neither decided nor deferred.** Fix: one clause in AD-9 (`X-Content-Type-Options: nosniff`, a minimal CSP) or a Deferred line.
- **L-10 (Structural Seed, AD-12): `buildApp()` separation is a seed comment but an AD-12 dependency.** Fix: add to AD-4: "`buildApp({ repository })` returns an un-listened Fastify instance; `server.ts` is the only caller of `listen`".
- **L-11 (AD-1): `[ADOPTED]` tag appears on one AD only.** Fix: remove it or apply a status to all.
- **L-12 (Deferred): rationale fragments ("Not before.", "Single-user deployment.", "Brief grades dev/test only.") belong in the memlog.** Fix: strip to the decision.
- **L-13 (Structural Seed mermaid): literal `\n` in node labels and an unquoted edge label with `->`.** Fix: use `<br/>` for line breaks and quote the edge label text (`-->|"proxy /api/ to api:3000"|`).
- **L-14 (AD-10): "method signatures take an explicit `TodoRepository`" is ambiguous (per-call parameter vs constructor injection).** Fix: "constructed with a `TodoRepository`; no module-level instance".
- **L-15 (AD-12): coverage "per app" leaves `packages/contract` unmeasured.** PRD says per package. Fix: state contract is excluded (schemas only) or included.
