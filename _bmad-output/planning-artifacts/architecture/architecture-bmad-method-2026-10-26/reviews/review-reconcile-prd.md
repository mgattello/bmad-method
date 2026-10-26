# Review: PRD reconciliation against ARCHITECTURE-SPINE

Spine: `ARCHITECTURE-SPINE.md` (draft, 2026-10-26)
Input: `prds/prd-bmad-method-2026-10-26/prd.md` (final) plus `addendum.md` where the PRD delegates to it.

Method: every FR-1..FR-15, every §5 NFR, §6 delivery constraints, §8 scope, §10 open questions and §11 assumptions were checked for coverage by an AD, a convention, the seed, or an explicit Deferred entry. Findings below are only what did not land, landed ambiguously, or landed in contradiction.

Verdict: the spine covers the API, persistence, layering and test topology well (FR-1 to FR-3, FR-8 to FR-13, FR-15, Reliability, Deployability, Maintainability are solid). The gaps cluster in the web client's read path (loading and load-failure states), in quiet numbers from §5 that fell out of the AD structure, and in open questions the spine answered without saying so. No finding requires a change of paradigm; all are additive edits to existing ADs, conventions or the seed.

## Coverage table

| PRD item | Status | Where |
| --- | --- | --- |
| FR-1 create | Covered, success-path details missing | AD-2, AD-7 (see L-1) |
| FR-2 validate | Covered, client-side cap contradicted | AD-6 (see M-7) |
| FR-3 list newest first | Covered, "200" wording ambiguous | AD-8, Deferred (see H-2) |
| FR-4 empty state | Seed only | `EmptyState` component, map row |
| FR-5 loading state | Silent | map row only (see H-1) |
| FR-6 visual distinction | Partly | Accessibility convention (see L-2) |
| FR-7 responsive | Silent on numbers and styling | map row "CSS" (see M-10, L-3) |
| FR-8 toggle | Covered | AD-2, AD-7 |
| FR-9 delete | Covered | AD-2, AD-7, Deferred |
| FR-10 CRUD API | Covered, edge mappings missing | AD-1, AD-2, AD-3 (see M-8, L-6) |
| FR-11 durable persistence | Covered | AD-5, AD-7 |
| FR-12 multi-user seam | Covered | AD-10 |
| FR-13 health | Covered | AD-11 (see L-9) |
| FR-14 error state | Write path covered, load path silent | AD-3, AD-7 (see H-1, H-4) |
| FR-15 keep input | Covered | AD-7 |
| NFR Simplicity | Implicit | Stack (see L-5) |
| NFR Product completeness | Silent, not in `binds` | (see M-6) |
| NFR Performance | Numbers dropped | AD-7 binds it, no figures (see M-3) |
| NFR Accessibility | Covered, version and focus dropped | Conventions (see L-4) |
| NFR Security | XSS covered, injection not | AD-6 (see M-5) |
| NFR Reliability | Covered | AD-3, AD-5 |
| NFR Maintainability | Covered, README/log location silent | AD-12 (see M-6, L-8) |
| NFR Deployability | Covered, profile default and dev runtime unclear | AD-9, AD-11 (see H-3, M-4) |
| NFR Browser support | Silent, not in `binds` | (see M-6) |
| §6 gates | Covered except docs location and `docker-compose up` | AD-11, AD-12 (see H-3, M-6) |
| §8.2 out of scope | All listed in Deferred | Deferred |
| OQ1 persistence | Answered, not declared | AD-5 (see M-1) |
| OQ2 cap 500 | Hard-coded, not flagged | AD-6 (see M-2) |
| OQ3 toggle back | Answered implicitly | AD-2 (see L-10) |
| OQ4 UI edit | Deferred, declared | Deferred |
| OQ5 Created At | Deferred, declared | Deferred, Dates convention |
| §11 assumptions | 8 of 11 land; Lighthouse 90, WCAG 2.1, Chromium are silent | (see M-3, L-4, M-6) |

## Critical

None.

## High

- **H-1. FR-5 and FR-14 (load path) are silent.** PRD FR-5 requires a designed Loading State that never shows the Empty State message, and FR-14 requires a failed list load to show an Error State with a retry control that re-issues the load; the spine's AD-7 only defines write failure and says the web "loads the list once on mount", which reads as forbidding the retry, and the seed's component list has no loading component. Fix: in AD-7 define the list state as a discriminated union `loading | ready | error` owned by `state/use-todos.ts`, state that `error` exposes a `reload()` that re-issues the load, and add a `LoadingState` (or `TodoList` skeleton) component to the seed.
- **H-2. Deferred "bounded at 200" can be read as a list cap, contradicting FR-3 and §8.2.** PRD FR-3 says the list endpoint returns every Todo with no pagination; §5 only bounds the performance test at 200 items. The spine's Deferred entry says "the list endpoint returns all items (bounded at 200 for NFR-Performance)", which an implementer can read as `LIMIT 200`. Fix: reword to "returns all items; the 1 s render target in NFR-Performance is tested at 200 items, not enforced as a limit", and put the number in a Performance convention row (see M-3).
- **H-3. AD-11 "dev (default)" profile does not start with a bare `docker compose up`, which is the §6 graded gate.** Compose services that carry a `profiles:` key are skipped unless that profile is activated, so a `dev` profile cannot be the default by itself; the §6 criterion is literally "runs successfully via docker-compose up". Fix: AD-11 must say how dev is default (either dev services carry no `profiles` key and only `test` is profiled, or `.env` ships `COMPOSE_PROFILES=dev`), and the README command the grader runs must be named.
- **H-4. Errors convention "Client shows messages, never codes" conflicts with FR-14.** FR-14 requires a message naming the failed action and forbids raw error strings; the server's `message` cannot name the client action, and AD-3 lets schema failures through as `VALIDATION_ERROR` whose default Ajv text ("body/description must NOT have more than 500 characters") is raw. Fix: state that the client maps `code` plus the attempted action to its own human copy, and that the Fastify error handler rewrites schema errors into a plain sentence before sending `message`.

## Medium

- **M-1. OQ1 (persistence, Architect-owned) is answered but not declared.** AD-5 picks SQLite on a named volume, but neither AD-5 nor a Deferred/decision note says it resolves PRD OQ1, and the FR-11 restart semantics the PRD made contingent on OQ1 (survives `api` restart and `docker compose down`; lost only on volume removal) are not written down. Fix: add "Resolves PRD OQ1" to AD-5 with those restart semantics, so the PRD can be closed.
- **M-2. OQ2 (500 cap, product-owner-owned) is hard-coded in AD-6 without saying it is provisional.** PRD §10.2 asks the PO to confirm before FR-2 tests are written. Fix: AD-6 should name the constant (`MAX_DESCRIPTION_LENGTH` in `contract`) as the single place the cap lives and note that the value awaits OQ2.
- **M-3. §5 Performance numbers dropped.** 100 ms action feedback, 1 s initial render at 200 items, and the Lighthouse mobile score of 90 (§11 assumption) appear nowhere in the spine, though AD-7 claims to bind NFR-Performance. Fix: add a Performance row to Consistency Conventions carrying all three numbers, and note in AD-7 that the confirmed-render choice is what meets the 100 ms bound (addendum E).
- **M-4. Dev and test web runtimes differ by more than env vars and profile.** AD-9 says the Vite dev server proxies `/api/` in dev while the web Dockerfile is "build stage -> nginx stage"; AD-11 says dev and test differ only by env vars and profile (PRD §5 Deployability). The spine never says the `dev` web service runs `vite` (which Dockerfile target or command, which port) and so leaves FR-13's web health signal undefined in dev. Fix: AD-11 states the web service per profile (dev: node image running `vite` on 8080 with bind mounts; test: nginx image), both on port 8080, with the `/healthz` equivalent for dev.
- **M-5. §5 Security "no injection into the Persistence Store" has no rule.** AD-5 and AD-4 only say the repository "contains SQL only". Fix: add to AD-5 "prepared statements with bound parameters only; no string-interpolated SQL", which is one sentence and makes the security review checkable.
- **M-6. Product completeness, Browser support, README and AI integration log are silent and missing from `binds`.** PRD §5 Product completeness (page title, no layout shift, no unstyled defaults), §5 Browser support (Chromium audited, must not break Firefox/Safari) and §6 Documentation (README, AI integration log) have no AD, convention, map row or seed entry; frontmatter `binds` lists neither NFR. Fix: add a Browser row (Playwright `chromium` project only; Vite default build target) and a Completeness row (title, skeleton reserves list height) to conventions, add `README.md` and `docs/ai-integration-log.md` to the seed, and extend `binds`.
- **M-7. AD-6 restricts client-side rejection to the empty case; FR-2 requires client rejection of the over-length case too.** PRD FR-2: "A Description longer than 500 characters is rejected with the same mechanism" on both client and server. Fix: in AD-6 allow the client to reject both empty-after-trim and over-cap locally using the shared constant from `contract`, while keeping the server as the only authority.
- **M-8. AD-3's fixed code set does not say what happens to malformed JSON, unknown routes or wrong content type.** FR-10 requires malformed JSON to return 400 and "never a 500 for user input"; Fastify's parser errors and default 404 handler produce their own body shapes and would bypass "every non-2xx body is `{ code, message }`". Fix: AD-3 lists the mapping explicitly (JSON parse and content-type errors to `VALIDATION_ERROR` 400; unknown route to `NOT_FOUND` via `setNotFoundHandler`).
- **M-9. Dev and test coverage of the `prod` path.** Not a PRD gap but a quiet contradiction: Deferred says "Brief grades dev/test only", yet §6 grades "runs via docker-compose up", which with H-3 means the graded path is the one the spine calls `dev` (bind mounts, hot reload). Fix: say which profile the grader runs and make the `test` profile (built images) the one the README's single command starts, or rename.
- **M-10. No styling approach decided.** FR-7 responsive layout and §5 Simplicity ("smallest dependency set") leave five separately built components free to pick plain CSS, CSS modules or a utility framework. Fix: one Conventions row (for example "plain CSS modules per component, no CSS framework, one `tokens.css` for spacing and type scale").

## Low

- **L-1. FR-1 success path not stated.** AD-7 specifies the failure path (input kept, focus kept) but not that success clears the input and keeps focus, nor that submission works by Enter and by a visible submit control. Fix: one sentence in AD-7 or the Accessibility convention.
- **L-2. FR-6 "at least two visual cues, not colour alone".** The Accessibility convention covers the checked state for AT but not the two-cue rule. Fix: append "completed items use strike-through plus reduced contrast plus checked control" to that row.
- **L-3. FR-7 numbers dropped.** 44 x 44 px touch targets, 360 px and 1280 px test widths, 320 to 1920 px no-clip range appear nowhere. Fix: add to the Accessibility or a new Layout convention row so E2E viewport settings inherit them.
- **L-4. WCAG version and visible focus.** §11 assumes WCAG 2.1 AA; §5 requires visible focus. The convention says neither. Fix: name "WCAG 2.1 AA, zero critical" and "visible focus ring, never `outline: none` without a replacement".
- **L-5. `@fastify/sensible` has no requirement behind it.** §5 Simplicity forbids dependencies without a requirement; no AD cites sensible, and its `httpErrors` helpers emit a body shape that violates AD-3 if used. Fix: drop it from the Stack, or cite the AD that needs it and forbid its error helpers.
- **L-6. Malformed `:id` path parameter.** FR-10 says a non-existent ID is 404 and invalid fields are 400; the spine does not say whether a non-UUID `:id` is `VALIDATION_ERROR` or `NOT_FOUND`. Fix: one line in AD-2 (recommend 404, so the client has one not-found path).
- **L-7. Durability pragma.** AD-5 says "WAL journal mode, synchronous writes"; `synchronous=NORMAL` under WAL is not durable before reply across an OS crash, which §5 Reliability asks for. Fix: state `PRAGMA synchronous=FULL`.
- **L-8. Coverage "per app" versus PRD "per package".** AD-12 enforces 70% per app, which satisfies the PRD's intent (frontend and backend each), but leaves `packages/contract` with no threshold. Fix: say contract is exempt (schemas only) or include it.
- **L-9. Non-root user and the `/data` volume; HEALTHCHECK tooling.** AD-11 requires non-root plus a named volume at `/data`, and a `HEALTHCHECK` on `node:24-alpine`, which ships no curl. Fix: note volume ownership (`chown` in Dockerfile) and that the api health check uses `node -e` fetch.
- **L-10. OQ3 (toggle back to Active) answered implicitly.** AD-2's `completed?: boolean` permits both directions but the spine does not say it resolves OQ3. Fix: note it next to AD-2, as done for OQ4 and OQ5 in Deferred.
- **L-11. Trim-versus-cap order.** AD-6 says the route enforces a 500 upper bound and the service trims then checks 1 to 500; a 500-character description with trailing whitespace is rejected at the route though valid after trim. Fix: state that the route bound is on the raw string and is intentionally lax (for example 1000) or that the route does not bound length at all.
- **L-12. Security headers.** §5 Security and the security review deliverable would expect a baseline CSP and `X-Content-Type-Options` from nginx; the spine defers only rate limiting. Fix: one line in AD-9 or an explicit Deferred entry.
