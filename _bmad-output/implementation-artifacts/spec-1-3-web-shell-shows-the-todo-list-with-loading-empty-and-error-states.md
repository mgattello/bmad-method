---
title: 'Story 1.3: Web shell shows the Todo List with Loading, Empty and Error States'
type: 'feature'
created: '2026-10-26'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '755baec7ba3448aece0ce1e30b2565dd8aedbed2'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-bmad-method-2026-10-26/ARCHITECTURE-SPINE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `apps/web` is a placeholder `<h1>` that prints a contract path. Dana cannot open the app and see her Todos, a Loading State, an Empty State, or an Error State with retry, and nothing announces failures to assistive technology.

**Approach:** Replace the placeholder with the React shell from the architecture: `api/todos-client.ts` (fetch wrapper over contract paths, envelope parsing, never throws), `state/use-todos.ts` (one `loading | ready | error` state with `load()` on mount and retry), the component set `TodoInput`, `TodoList`, `TodoItem`, `EmptyState`, `LoadingState`, `ErrorBanner` under `App`, CSS modules plus one `tokens.css`, and component tests with the client mocked. Story 1.2 (the API) is built in parallel and is not in this tree; everything here is testable without it.

**Decisions (settled from the epic context, not open):**
- `TodoInput` is rendered now (UX-DR1) as a labelled text input and an "Add" submit button; it takes an optional `onSubmit(description)` prop. In this story `App` passes none, so submitting only prevents the default. Story 2.2 wires it.
- `TodoItem` renders the full UX-DR2 shape: a checkbox `checked={todo.completed}` with an accessible label (the description), the description as text content only, and a delete button labelled "Delete {description}". `onToggle` and `onDelete` props are optional and unwired here (Stories 2.3, 2.4). Completed items already get strike-through plus reduced contrast (UX-DR5) since the component is born here.
- Loading State is a skeleton: three placeholder rows the same height as a `TodoItem`, inside the list region, with visually hidden text "Loading your todos", `aria-busy="true"`, and no `role="status"`.
- `ErrorBanner` is the only `role="status"` element and is always in the DOM (empty when there is no message) so changes are announced. It takes `message: string | null` and an optional `action: { label, onClick }`. For a failed load `App` passes the load copy and `{ label: 'Retry', onClick: load }`, and the list region renders nothing: the banner is the Error State that replaces the list. Story 2 reuses the banner without an action for write failures.
- User-facing copy lives in `src/copy.ts`, keyed by action then `ErrorCode` (`errorCopy.load.INTERNAL_ERROR` etc., one entry per code per action), plus `emptyStateCopy`, `loadingCopy`, `retryLabel`. The server `message` is never rendered.

## Boundaries & Constraints

**Always:** Only `@todo/contract` for the `Todo` type, `ErrorCode` and paths; `todos-client.ts` builds the URL from `TODOS_PATH`. `todos-client.ts` returns a result object and never throws or rejects past its boundary. One state object in `use-todos.ts`: `{ status: 'loading' } | { status: 'ready'; todos: Todo[] } | { status: 'error'; code: ErrorCode }`; a stale response (an older `load()` resolving after a newer one started) is ignored. Render in received order; never sort. Description rendered as text content only. Plain CSS modules per component plus one `src/tokens.css` (custom properties on `:root` and the minimal base rules: `box-sizing`, body margin, font, colour, background); mobile-first; the list region reserves height so the skeleton, list, empty and error states do not shift layout; touch targets at least 44 x 44 px; visible focus. Existing config stays: `vite.config.ts` proxy (`^/api/` from `API_PROXY_TARGET`, `server.host: true`), `vitest.config.ts` (jsdom, `test-setup.ts` cleanup, 70/70 thresholds), `index.html` `<title>Todo</title>`. Lint and format clean with the root configs; no new dependencies. Append a Story 1.3 entry to `docs/ai-integration-log.md` (agent usage, prompts, tools, what the AI missed and how it was debugged, decisions, limitations, review round).

**Never:** No api code, no changes under `apps/api`, `packages/contract`, `e2e`, no Dockerfile or nginx config (1.2, 1.4). No create, toggle or delete requests (Epic 2). No CSS framework, state library, router, data-fetching library, schema validator in the web. No `dangerouslySetInnerHTML`, no markdown. No second live region; no `role="alert"`. No onboarding, tour, modal, tooltip or instructional copy beyond the Empty State message. No `VITE_` env vars. No literal `/api/v1` outside the contract. Do not display `createdAt`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Client happy path | `fetch(TODOS_PATH)` -> 200, JSON array of Todos | `{ ok: true, data: Todo[] }` in received order | N/A |
| Client envelope | 500 `{ code: 'INTERNAL_ERROR', message: 'db down' }` | `{ ok: false, code: 'INTERNAL_ERROR' }`; `message` discarded | N/A |
| Client envelope, other code | 404 `{ code: 'NOT_FOUND', message }` | `{ ok: false, code: 'NOT_FOUND' }` | N/A |
| Client non-JSON non-2xx | 502 with HTML body (nginx) | `{ ok: false, code: 'INTERNAL_ERROR' }` | `res.json()` failure caught |
| Client non-2xx, unknown code | 500 `{ code: 'WEIRD' }` or `{}` | `{ ok: false, code: 'INTERNAL_ERROR' }` | N/A |
| Client network failure | `fetch` rejects (`TypeError`) | `{ ok: false, code: 'INTERNAL_ERROR' }`; nothing thrown | rejection caught |
| Client 2xx non-array | 200 `{}` or invalid JSON | `{ ok: false, code: 'INTERNAL_ERROR' }` | parse failure caught |
| Mount | `App` renders, client pending | skeleton in list region, visually hidden "Loading your todos"; no Empty State copy; banner empty | N/A |
| Empty | client resolves `[]` | `EmptyState` copy inviting the first Todo; no skeleton | N/A |
| Populated | client resolves `[b, a]` (newest first) | `<ul>` with two `<li>` in that order; each has a checkbox reflecting `completed` and the description as text (`<b>x</b>` shows literally) | N/A |
| Load failure | client resolves `{ ok: false, code }` | list region empty; `role="status"` contains `errorCopy.load[code]` and a "Retry" button; no server message anywhere | N/A |
| Retry | "Retry" activated | `load()` re-issued: skeleton shown, banner cleared, then ready or error again | N/A |
| Stale response | `load()` A pending, `load()` B starts, A resolves after B | A's result ignored; state reflects B | N/A |
| Unmount mid-load | component unmounts while pending | no state update, no warning | N/A |

</frozen-after-approval>

## Code Map

- `apps/web/src/main.tsx` -- placeholder `App` plus `mount(container)` with `#root` guard; replace: import `./tokens.css` and `./App.js`, keep `mount` and the guard, drop the `App` export.
- `apps/web/src/main.test.tsx` -- mounts `main.tsx` inside `act(() => import(...))`; rewrite to assert the `<h1>` and the `#root`-missing case only (`App` is tested separately).
- `apps/web/src/test-setup.ts` -- `afterEach(cleanup)` already registered; reuse, do not duplicate.
- `apps/web/vitest.config.ts` -- jsdom, `include: ['src/**/*.test.{ts,tsx}']`, coverage `include: ['src/**/*.{ts,tsx}']` 70/70; do not change.
- `apps/web/vite.config.ts` -- proxy already per AD-9; do not change.
- `apps/web/tsconfig.app.json` -- `types: ["vite/client"]` gives `*.module.css` typings; `noUnusedLocals`/`noUnusedParameters` are on; `tsc -b` type-checks tests via `include: ["src"]`.
- `apps/web/index.html` -- `<title>Todo</title>` set; `#root`; keep.
- `apps/web/package.json` -- update `description` only.
- `packages/contract/src/index.ts` -- exports to use: `type Todo`, `type TodoList`, `ErrorCode` (const + union), `TODOS_PATH`. Import from `@todo/contract` (built to `dist/`; `npm run build -w packages/contract` first).
- `eslint.config.js` -- `react-hooks` flat recommended applies to `apps/web/**`; v7 includes compiler rules such as `set-state-in-effect`: keep `load` a stable `useCallback` and let the mount effect call it; if the rule fires, restructure rather than disable.
- `.prettierrc` -- single quotes, width 100.
- `docs/ai-integration-log.md` -- append-only; add `## Story 1.3: ...` after the 1.1 entry (1.2's entry will be merged before it later; keep this entry self-contained).
- `README.md` -- layout tree line `apps/web/` and the Commands table mention 1.3 placeholders; update.
- Spine AD-3 (envelope and client rules), AD-7 (state machine), AD-9 (proxy), Consistency Conventions (Accessibility, Styling rows); epic context UX section. Already distilled above.

## Tasks & Acceptance

**Execution:**
- [x] `apps/web/src/copy.ts` -- `errorCopy: Record<'load', Record<ErrorCode, string>>` with human-written sentences naming the action (e.g. load + INTERNAL_ERROR: "We couldn't load your todos. Check your connection and try again."), `emptyStateCopy` ("No todos yet. Add your first one above." or similar), `loadingCopy` ("Loading your todos"), `retryLabel` ("Retry") -- single home for copy; tests and E2E import it.
- [x] `apps/web/src/api/todos-client.ts` -- `export type ApiResult<T> = { ok: true; data: T } | { ok: false; code: ErrorCode }`; `export async function listTodos(): Promise<ApiResult<Todo[]>>` using global `fetch(TODOS_PATH, { headers: { accept: 'application/json' } })`; parse per the matrix; a non-2xx body whose `code` is one of `Object.values(ErrorCode)` yields that code, everything else `INTERNAL_ERROR`; wrap the whole body in try/catch -- AD-3.
- [x] `apps/web/src/api/todos-client.test.ts` -- `vi.stubGlobal('fetch', vi.fn())` per case; cover every Client row of the matrix and assert the URL passed equals `TODOS_PATH` -- proves the boundary.
- [x] `apps/web/src/state/use-todos.ts` -- `export type TodosState = ...` (union above); `export function useTodos(): { state: TodosState; load: () => Promise<void> }`; initial `loading`; `load` sets `loading`, awaits `listTodos()`, applies the result only if it is the latest call (counter in a ref) and the hook is still mounted; `useEffect` runs `load()` once on mount -- AD-7.
- [x] `apps/web/src/state/use-todos.test.ts` -- `vi.mock('../api/todos-client.js')`; `renderHook`; cover ready, error, retry, stale response (two deferred promises resolved out of order), unmount mid-load -- proves the state machine.
- [x] `apps/web/src/tokens.css` -- `:root` custom properties (spacing scale, colours with sufficient contrast, type scale, `--row-min-height: 44px`, `--list-min-height`), base rules only -- UX-DR4.
- [x] `apps/web/src/components/TodoInput.tsx` + `TodoInput.module.css` -- `<form>` with `<label>` ("New todo"), text input, submit button "Add"; `onSubmit?: (description: string) => void`; `preventDefault`, call handler if present -- UX-DR1 shell.
- [x] `apps/web/src/components/TodoItem.tsx` + `TodoItem.module.css` -- `<li>` with `<input type="checkbox" checked={todo.completed} onChange={...}>` labelled by the description (`<label>` wrapping or `htmlFor`), description as text, delete button `aria-label={`Delete ${todo.description}`}`; optional `onToggle`/`onDelete`; completed cues -- UX-DR2, UX-DR5.
- [x] `apps/web/src/components/TodoList.tsx` + `TodoList.module.css` -- `<ul aria-label="Todos">` mapping `todos` to `TodoItem` keyed by `id`, received order -- FR3.
- [x] `apps/web/src/components/EmptyState.tsx` + `EmptyState.module.css` -- `<p>` with `emptyStateCopy` -- FR4.
- [x] `apps/web/src/components/LoadingState.tsx` + `LoadingState.module.css` -- `<div aria-busy="true">` with three skeleton rows (`aria-hidden`) at `--row-min-height` and a visually hidden `<span>` with `loadingCopy` -- FR5.
- [x] `apps/web/src/components/ErrorBanner.tsx` + `ErrorBanner.module.css` -- `<div role="status">` always rendered; when `message` is set renders `<p>` and, if `action`, a `<button type="button">` -- UX-DR3, FR14.
- [x] `apps/web/src/App.tsx` + `App.module.css` -- `<main>` with `<h1>Todo</h1>`, `TodoInput`, `ErrorBanner`, `<section aria-label="Todo List">` reserving min height and rendering `LoadingState` | `EmptyState` | `TodoList` | nothing (error) by `state.status` -- composition root.
- [x] `apps/web/src/App.test.tsx` -- `vi.mock('./api/todos-client.js')`; cover the Mount, Empty, Populated, Load failure, Retry rows: assert the skeleton text is present and Empty copy absent while pending; `getAllByRole('listitem')` order and checkbox `checked`; literal `<b>x</b>` text; `getByRole('status')` text equals `errorCopy.load.INTERNAL_ERROR` and does not contain the server message; `getByRole('button', { name: retryLabel })` click calls `listTodos` a second time and the Empty State then shows; no `role="alert"` and exactly one `role="status"`.
- [x] `apps/web/src/main.tsx`, `apps/web/src/main.test.tsx` -- rewire as in the Code Map.
- [x] `apps/web/package.json` -- description: "Todo web client (React, Vite): list, loading, empty and error states".
- [x] `README.md` -- `apps/web/` tree line and any "arrive in Story 1.3" wording; add a short "Web" note: `npm run dev -w apps/web` serves on 5173 and proxies `/api/` to `API_PROXY_TARGET`; the list shows the Error State until an API is reachable.
- [x] `docs/ai-integration-log.md` -- append the Story 1.3 entry (same headings as 1.1: Agent usage, Prompts, MCPs and tools, What the AI missed and debugging, Decisions made while implementing, Review rounds, Limitations).

**Acceptance Criteria:**
- Given a clean checkout, when `npm run build` runs, then contract, api and web build and `apps/web/dist` contains the shell.
- Given the workspace, when `npm run lint` runs, then ESLint, Prettier and every `typecheck` pass with zero findings.
- Given the workspace, when `npm test` runs, then the web suite covers the Loading, Empty, populated and load-error-with-retry render paths with the client mocked and coverage is at least 70% lines and branches for the web app (contract and api unchanged).
- Given the rendered shell, when the DOM is inspected, then exactly one element has `role="status"`, it is rendered by `ErrorBanner`, and no element has `role="alert"`.
- Given `apps/web/src`, when grepped, then `/api/v1` and `dangerouslySetInnerHTML` do not appear and no file declares its own `Todo` type.
- Given `apps/web/src`, when the dependency list is compared to `main`, then `apps/web/package.json` dependencies and devDependencies are unchanged.

## Implementation Notes

- Implemented by a dispatch subagent from the spec alone; verified by the dispatcher against the diff from baseline `755baec` with fresh runs of `npm run build`, `npm run lint`, `npm test`, the spec's greps and `git diff main -- apps/api packages/contract e2e` (empty). Final: web 6 test files, 29 tests, 100% lines and 97.29% branches; contract and api unchanged.
- Epic context cache was treated as valid: planning docs and `epic-1-context.md` were last touched in the same commit (`51d7489`); the worktree checkout mtimes differ only by milliseconds.
- `react-hooks/set-state-in-effect` fired on the first hook version; split into `fetchInto(id)` and `load()` so the mount effect never sets state synchronously. No rule disabled.
- Retry button lives inside the `role="status"` banner; the status region "carries" the message (Story 1.5 wording) rather than equalling it.
- Review round 1: 22 findings (18 rows), 9 patched, 9 rejected, 0 deferred. Patches: empty banner kept in flow instead of `display: none`; skeleton rows match the item's outer box via `--row-outer-height`; checkbox at 1.5rem with the 44px row as target; new `TodoInput` and `TodoItem` tests; completed-class and server-message assertions made meaningful; unused token removed; AI log updated. The implementer was re-engaged for the patches and applied them; full verification rerun green.

## Spec Change Log

## Review Triage Log

Round 1, three layers (blind-hunter, edge-case-hunter, verification-gap), 22 findings, 18 rows after grouping duplicates.

| # | Layer | Location | Claim | Verdict | Evidence | Route |
|---|---|---|---|---|---|---|
| 1 | blind, edge-case, verification-gap | `components/ErrorBanner.tsx:11`, `ErrorBanner.module.css:1` | Empty banner uses `display: none`, removing the live region from the accessibility tree; first error enters with the region, announcement unreliable | medium | Confirmed: `display: none` excludes the node from the a11y tree; the spec keeps the banner mounted precisely so the region exists before the message. jsdom cannot see it. | patch |
| 2 | edge-case | `LoadingState.module.css:8`, `TodoItem.module.css:1` | Skeleton row 44px, rendered item 54px (44px checkbox + 8px padding + 2px border), layout shift on load | medium | Confirmed by the box model: `.item` min-height is border-box but its 44px child plus padding and border yields 54px outer; skeleton row has no padding or border. | patch |
| 3 | blind | `TodoItem.module.css:13` | Native checkbox sized 44x44 renders oversized next to 16px text | low | Chromium and Firefox scale native checkboxes to explicit width/height; users see it on every item. Direct CSS correction. | patch |
| 4 | verification-gap, blind | `components/TodoInput.tsx:13` | Submit path (`preventDefault`, optional `onSubmit`, controlled input) has no test; removing `preventDefault` reloads the page on Enter and all tests pass | medium | Pre-verified by the layer (demonstrated). Coverage shows lines 14-15 and 30 uncovered. | patch |
| 5 | blind | `components/TodoItem.tsx:23-32` | `onToggle`/`onDelete` optional props untested | low | True; lines uncovered. Unwired this story, but Story 2 relies on the signature. Direct test addition. | patch (with 4) |
| 6 | verification-gap | `components/TodoItem.tsx:14` | Completed-item class is never asserted; inverting the ternary passes all tests | low | Pre-verified (demonstrated, CSS module names stable under jsdom). UX-DR5 regression would go unnoticed. | patch |
| 7 | blind | `App.test.tsx` load-failure case | `not.toContain(serverMessage)` is vacuous: the mock carries no message | low | Confirmed; the mocked result is `{ ok: false, code }`. One-line fix: give the mock an extra `message` field. | patch |
| 8 | blind | `tokens.css:21` | `--text-lg` defined and unused | low | Confirmed by grep. Fix is a deletion. | patch |
| 9 | blind | `docs/ai-integration-log.md` 1.3 entry | Does not record the `display: none` decision, the vacuous tests, or the review round | low | Confirmed; "Review rounds" says none yet. Graded deliverable. | patch |
| 10 | blind | `App.module.css`, `ErrorBanner` | Banner appearing on failure pushes the list region down (shift on error path) | low | Real but ordinary: an error banner above the list is content, not placeholder reflow; the spec's no-shift rule targets the loading-to-ready transition. Reserving banner height permanently or moving it into the region adds structure. Rejected: low, fix adds complexity. | reject |
| 11 | blind, verification-gap | `state/use-todos.test.ts:109` | Unmount test cannot fail: `result.current` frozen, React 19 emits no warning | low | Confirmed by the layer (cleanup removed, suite passes). React 19 makes unmounted `setState` a no-op, so no observable guard exists to assert; the test still observes the matrix outcome. Rejected: low, no stronger assertion exists without complexity. | reject |
| 12 | blind, edge-case | `api/todos-client.ts:26` | 2xx array of non-Todo objects accepted; renders undefined rows | low | True but requires a proxy serving a foreign JSON array at `TODOS_PATH`; the API contract guarantees `Todo[]`. Spec excludes a web validator. Rejected: low, unlikely, adds branches. | reject |
| 13 | blind | `App.tsx:12,19-20` | `status === 'error'` narrowed twice | false | No named harm; both reads are in one render of the same state. | reject |
| 14 | blind | diff scope | Spec and `sprint-status.yaml` not in the patch | false | `_bmad-output` was excluded from the review diff on purpose; step 5 commits them. | reject |
| 15 | blind | `README.md` Web section | No pointer to web unit tests | false | README documents `npm test` and `-w` workspace usage already; `npm test -w apps/web` follows. | reject |
| 16 | edge-case | `api/todos-client.ts:24` | No timeout: a hanging API shows the skeleton forever | low | Reachable only if the server or proxy hangs rather than failing; browsers time out eventually. Spec sets no timeout value (would be intent). Rejected: low, unlikely, adds a guard. | reject |
| 17 | edge-case | `components/TodoInput.tsx:14` | Untrimmed or over-length value reaches `onSubmit` | false | No handler exists this story; trimming and validation are Story 2.2 by intent (AD-6). | reject |
| 18 | edge-case | `components/ErrorBanner.tsx:14-18` | Retry inside `role="status"` so textContent is message plus "Retry"; spec task said "equals" | low | Spec decision placed the button in the banner; Story 1.5 says the status "carries" the message. Fix would edit this spec or move the control out of the region. | reject |

## Design Notes

Result type over exceptions keeps the "never throws past its boundary" rule mechanical:

```ts
export async function listTodos(): Promise<ApiResult<Todo[]>> {
  try {
    const res = await fetch(TODOS_PATH, { headers: { accept: 'application/json' } });
    const body: unknown = await res.json().catch(() => undefined);
    if (res.ok) return Array.isArray(body) ? { ok: true, data: body as Todo[] } : failure();
    return { ok: false, code: envelopeCode(body) };
  } catch {
    return failure();
  }
}
```

Stale-response guard in the hook: `const seq = useRef(0); const id = ++seq.current; ... if (id === seq.current) setState(...)`. Under React StrictMode the mount effect runs twice in dev; the guard makes the first result harmless. Trust the guard, not an `isMounted` boolean alone.

## Verification

**Commands:**
- `npm run build` -- expected: exit 0; `apps/web/dist/index.html` exists.
- `npm run lint` -- expected: exit 0.
- `npm test` -- expected: all suites green; web coverage summary at or above 70% lines and branches.
- `grep -rn "api/v1\|dangerouslySetInnerHTML\|role=\"alert\"" apps/web/src` -- expected: no matches.
- `git diff main -- apps/api packages/contract e2e` -- expected: empty.
