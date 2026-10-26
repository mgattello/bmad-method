---
title: 'Story 2.2: Add a Todo from the input'
type: 'feature'
created: '2026-10-26'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '82c339dfb4d79ef67158936782c0f8241d9f4b55'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-bmad-method-2026-10-26/ARCHITECTURE-SPINE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The web shell from Story 1.3 renders the input but the handler is a no-op, so Dana cannot add a Todo even though `POST /api/v1/todos` (Story 2.1) is live.

**Approach:** Wire the input end to end: `TodoInput` submits on Enter and on the visible Add control, `useTodos` owns `create` (trim, local rule check, one in-flight create, insert the returned Todo at index 0), a new `createTodo` client call parses the envelope, and the single `role="status"` region in `ErrorBanner` shows action-keyed copy for both local validation and server failures while `TodoInput` carries `aria-invalid` and `aria-describedby`. Component and hook tests prove every AC now; the `create` and `validation` Playwright specs are written for Story 1.5's harness.

## Boundaries & Constraints

**Always:** Paths, types and the limit come from `@todo/contract` only (`TODOS_PATH`, `Todo`, `ErrorCode`, `DESCRIPTION_MAX`). The client sends `description.trim()` and blocks locally only for empty-after-trim and over `DESCRIPTION_MAX`, through the same message mechanism as a server `VALIDATION_ERROR` (AD-6). No optimistic update: the item inserted at index 0 is the Todo the API returned (AD-7, AD-8). A pending create disables the submit control and a second submit is ignored, not queued (AD-7). A failed create keeps the typed text and keeps focus in the input; the list stays at its last persisted state. User-facing copy lives in `copy.ts`, keyed by action plus code, and the server `message` is never rendered (AD-3). Exactly one live region, the existing `role="status"` in `ErrorBanner`; `TodoInput` sets `aria-invalid="true"` and `aria-describedby` pointing at the message element only when the code is `VALIDATION_ERROR` (Conventions, Accessibility). Description is rendered as text only. `createTodo` never throws past its boundary and treats non-JSON or unexpected responses as `INTERNAL_ERROR`. Keyboard: Enter in the input and activating Add both submit; focus stays visible. Web coverage stays at or above 70% lines and branches. Decisions: the input error (validation or failed create) is cleared when the next submit starts, not while typing; the submit control is also disabled while the list is `loading` or `error`, so the load message and a create message never compete for the one live region; no HTML `maxlength` on the input, so the over-max rule is reachable and testable.

**Never:** No api or contract changes. No PATCH or DELETE calls (2.3, 2.4). No optimistic insert or rollback, no request queue, no retry control for a failed create (the user resubmits). No `alert` role, no second live region, no `dangerouslySetInnerHTML`. Do not install Playwright, add an `e2e/package.json` or `playwright.config.ts`, or run the E2E specs (Story 1.5 owns the harness). Do not rename or restructure the Story 1.3 files or their exports; extend them. Do not touch existing entries in `docs/ai-integration-log.md`. Do not edit `docs/architecture.md` (its web section already describes this behaviour).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Create | ready, type `  Buy milk  `, Enter or Add | `createTodo('Buy milk')` once; returned Todo inserted at index 0 (Empty State replaced by the list when it was empty); input cleared; focus in the input; status region empty | N/A |
| Pending | create in flight | Add `disabled`; a second submit calls nothing; after the response Add is enabled again | N/A |
| Empty after trim | `""`, `"   "` | no request; status region shows `errorCopy.create.VALIDATION_ERROR`; input `aria-invalid="true"`, `aria-describedby` = message id; text kept | local rule |
| Too long | `DESCRIPTION_MAX + 1` chars after trim | same as empty after trim | local rule |
| Bounds | exactly `DESCRIPTION_MAX` chars after trim, or 1 char | request sent | N/A |
| Server validation | `400 { code: "VALIDATION_ERROR", message }` | same message, same attributes as the local case; the envelope `message` never appears in the DOM; list unchanged | envelope |
| Server failure | `500` envelope, `502` HTML, network error | status region shows `errorCopy.create.INTERNAL_ERROR` (names the add action); no `aria-invalid`; text and focus kept; list unchanged | envelope or `failure()` |
| Not ready | `loading` or `error` list state | Add `disabled`; `create` inserts nothing even if called | N/A |
| Next submit | any message showing, submit again | message cleared when the submit starts, then the new outcome applies | N/A |

</frozen-after-approval>

## Code Map

- `apps/web/src/api/todos-client.ts` -- `ApiResult<T>`, `failure()`, `envelopeCode()`, `listTodos()`. Add `createTodo(description: string): Promise<ApiResult<Todo>>`: `fetch(TODOS_PATH, { method: 'POST', headers: { accept, 'content-type': 'application/json' }, body: JSON.stringify({ description }) })`; `res.ok` and an object body with a string `id` -> `{ ok: true, data }`, any other 2xx body -> `failure()`, non-2xx -> `envelopeCode(body)`; same try/catch shape as `listTodos`.
- `apps/web/src/state/use-todos.ts` -- `TodosState`, `seq` guard, `fetchInto`, `load`. Add `WriteError = { action: 'create'; code: ErrorCode }` (union grows in 2.3/2.4), `creating: boolean` state plus a `creatingRef` guard, `writeError` state, and `create(raw: string): Promise<boolean>`: return `false` if `creatingRef.current`; clear `writeError`; `trimmed = raw.trim()`; if `trimmed.length === 0 || trimmed.length > DESCRIPTION_MAX` set `writeError` `VALIDATION_ERROR` and return `false` without calling the client; otherwise set creating, `await createTodo(trimmed)`, on `ok` `setState((s) => s.status === 'ready' ? { ...s, todos: [result.data, ...s.todos] } : s)`, on failure set `writeError` with the code; clear creating; return `result.ok`. `load()` also clears `writeError`. Return `{ state, load, create, creating, writeError }`.
- `apps/web/src/copy.ts` -- `errorCopy: Record<'load', ...>`. Widen to `Record<'load' | 'create', Record<ErrorCode, string>>` and add `create` copy built from `DESCRIPTION_MAX` (value import): `VALIDATION_ERROR: \`Enter a todo of 1 to ${DESCRIPTION_MAX} characters.\``, `INTERNAL_ERROR: "We couldn't add your todo. Check your connection and try again."`, `NOT_FOUND: "We couldn't add your todo. Try again."`. Keep `retryLabel`; add `addLabel = 'Add'` and use it in `TodoInput`.
- `apps/web/src/components/ErrorBanner.tsx` -- the live region; `<p className={styles.message}>`. Add optional `messageId?: string` rendered as the `id` of that `<p>`. Nothing else changes.
- `apps/web/src/components/TodoInput.tsx` -- shell with `onSubmit?.(value)`. Props become `{ onSubmit: (value: string) => Promise<boolean>; disabled?: boolean; invalid?: boolean; errorId?: string }`. `handleSubmit`: `preventDefault`, `inputRef.current?.focus()`, `const cleared = await onSubmit(value)`, if `cleared` `setValue('')`, then `inputRef.current?.focus()` again (a click on Add moves focus to the button, and disabling it would drop focus to `body`). `<input aria-invalid={invalid || undefined} aria-describedby={invalid ? errorId : undefined}>`; `<button type="submit" disabled={disabled}>`. The input itself is never disabled. Remove the "Shell only" comment.
- `apps/web/src/components/TodoInput.module.css` -- add `.button:disabled { opacity: 0.6; cursor: default; }` and `.input[aria-invalid='true'] { border-color: var(--color-danger); }` (tokens only).
- `apps/web/src/App.tsx` -- composes everything. `const { state, load, create, creating, writeError } = useTodos()`; `const messageId = useId()`; `message = state.status === 'error' ? errorCopy.load[state.code] : writeError ? errorCopy[writeError.action][writeError.code] : null`; `<TodoInput onSubmit={create} disabled={creating || state.status !== 'ready'} invalid={writeError?.code === 'VALIDATION_ERROR'} errorId={messageId} />`; `<ErrorBanner messageId={messageId} ... />`. Keep the list rendering as is.
- `apps/web/src/api/todos-client.test.ts` -- `stubFetch`, `jsonResponse` helpers; add a `describe('createTodo')`.
- `apps/web/src/state/use-todos.test.ts` -- `deferred()`, `vi.mock('../api/todos-client.js')`; add `createTodo` to the mocked calls and a `describe('useTodos create')`.
- `apps/web/src/components/TodoInput.test.tsx` -- `submitForm()` helper; rewrite for the new props (existing tests assumed a void `onSubmit`).
- `apps/web/src/App.test.tsx` -- `vi.mock('./api/todos-client.js')`, `deferred()`; add a `describe('App create')` with `createTodo` mocked. `main.test.tsx` factory mock must also export `createTodo` (unused but keeps the module shape).
- `e2e/create.spec.ts`, `e2e/validation.spec.ts`, `e2e/support/todos.ts` -- new; written only (no runner here): `import { test, expect } from '@playwright/test'`; `purgeTodos(request)` uses the literal path `/api/v1/todos` with a one-line comment, because `e2e` has no workspace yet to resolve `@todo/contract`; `beforeEach` purges (list, then `DELETE` each, tolerating an empty list); `getByRole('status')` for messages; `page.route('**/api/v1/todos', ...)` with `method() === 'POST'` for the failure case in `validation` (fulfil `502` HTML) and a `400 VALIDATION_ERROR` envelope case; `getByRole('textbox', { name: 'New todo' })`, `getByRole('button', { name: 'Add' })`, `getByRole('list', { name: 'Todos' })`, `getByRole('listitem').first()`.
- `README.md` -- "## Web" paragraph: say the input adds a Todo through the API, that validation and failure messages come from `copy.ts`, and that `e2e/create.spec.ts` and `e2e/validation.spec.ts` run under the Story 1.5 harness.
- `docs/ai-integration-log.md` -- append `## Story 2.2: Add a Todo from the input` after the Story 2.1 entry with the same headings (Date, Agent usage, Prompts, MCPs and tools, What the AI missed and debugging, Decisions made while implementing, Review rounds, Limitations); self-contained, no edits above it.
- `eslint.config.js` -- `react-hooks` v7 compiler rules apply to `apps/web/**`; keep `create` a stable `useCallback` and do not call `setState` synchronously inside effects. `apps/web/tsconfig.app.json` has `noUnusedLocals`/`noUnusedParameters`; `tsc -b` type-checks the tests too.
- Spine AD-3, AD-6, AD-7, AD-8, AD-12 and the Accessibility convention; epic context UX section. Already distilled above.

## Tasks & Acceptance

**Execution:**
- [x] `apps/web/src/api/todos-client.ts` -- add `createTodo` as in the Code Map -- the only place the web talks to POST (AD-3, AD-9).
- [x] `apps/web/src/copy.ts` -- widen `errorCopy`, add `create` copy from `DESCRIPTION_MAX`, add `addLabel` -- one home for copy, message cannot drift from the limit (AD-3, AD-6).
- [x] `apps/web/src/state/use-todos.ts` -- `create`, `creating`, `writeError`, `load` clears `writeError` -- the list state machine owns the write (AD-7).
- [x] `apps/web/src/components/ErrorBanner.tsx` -- `messageId` on the message `<p>` -- the target for `aria-describedby` (Accessibility convention).
- [x] `apps/web/src/components/TodoInput.tsx` + `TodoInput.module.css` -- new props, focus handling, disabled and invalid styling -- Enter and Add both submit, focus kept, pending disabled.
- [x] `apps/web/src/App.tsx` -- wire hook, message selection, `messageId` -- single live region shows load, validation and create messages.
- [x] `apps/web/src/api/todos-client.test.ts` -- `createTodo`: POSTs `TODOS_PATH` with method, both headers and the JSON body; `201` object -> ok; `400` envelope -> `VALIDATION_ERROR` and the message is discarded; `404` envelope -> `NOT_FOUND`; `502` HTML, network error, `2xx` non-object (`[]`, `null`, `'x'`) -> `INTERNAL_ERROR` -- client level.
- [x] `apps/web/src/state/use-todos.test.ts` -- `create`: sends the trimmed value and inserts the returned Todo at index 0, resolves `true`, `creating` toggles; second call while pending is ignored (client called once, resolves `false`); `''`, `'   '` and `DESCRIPTION_MAX + 1` set `writeError` `VALIDATION_ERROR` with no client call; exactly `DESCRIPTION_MAX` is sent; server `VALIDATION_ERROR` and `INTERNAL_ERROR` set `writeError` and leave the list unchanged; next `create` and `load` clear `writeError`; `create` while `error` state calls the client but inserts nothing -- hook level per the matrix.
- [x] `apps/web/src/components/TodoInput.test.tsx` -- form submit (Enter) and clicking Add both call `onSubmit` with the raw value; resolved `true` clears the value and the input has focus; resolved `false` keeps the value and focus; `disabled` disables Add but not the input; `invalid` with `errorId` sets `aria-invalid="true"` and `aria-describedby`; neither attribute otherwise -- component level.
- [x] `apps/web/src/App.test.tsx` -- with `createTodo` mocked: submit from the Empty State inserts at index 0 and replaces the Empty State, input empty and focused, status empty; two todos then a create puts the new one first; pending disables Add and a second submit is ignored; client validation shows the copy in `getByRole('status')`, `aria-describedby` resolves to the element with that text, `createTodo` not called; server `VALIDATION_ERROR` shows the same copy and attributes, server `message` absent from `document.body`; `INTERNAL_ERROR` keeps text and focus, list unchanged, no `aria-invalid`; Add disabled while loading and in the load Error State; still exactly one `role="status"` -- app level per the matrix.
- [x] `apps/web/src/main.test.tsx` -- add `createTodo` to the factory mock -- keeps the module shape.
- [x] `e2e/support/todos.ts`, `e2e/create.spec.ts`, `e2e/validation.spec.ts` -- as in the Code Map: `create` covers Enter and the Add control, newest first, input cleared and focused, and persistence across reload; `validation` covers empty, whitespace, over-max, the server `400`, and the `502` failure keeping the text -- written for Story 1.5's harness, not run here (AD-12).
- [x] `README.md`, `docs/ai-integration-log.md` -- Web paragraph and the Story 2.2 log entry (record that the two E2E specs are executed by Story 1.5) -- graded deliverables.

**Acceptance Criteria:**
- Given a clean worktree, when `npm run build && npm run lint` run, then web compiles and ESLint, Prettier and every `typecheck` pass (the two E2E specs are Prettier-clean).
- Given `npm test`, when the web suite runs, then all tests pass and coverage is at or above 70% lines and branches for `apps/web`.
- Given the diff, when reviewed, then nothing under `apps/api` or `packages/contract` changed, no literal `/api/v1` appears under `apps/web/src`, and no `message` field from an envelope is rendered anywhere.
- Given keyboard-only use in the component tests, when Enter is pressed in the input or Add is activated, then both submit and focus ends in the input.

## Implementation Notes

- Implemented as in the Code Map; web suite 71 tests at 100% lines and branches after review round 1. The two E2E specs are written and lint-clean, not run. The `apps/api` and `packages/contract` diff check was read against the baseline commit `82c339d` because the branch predates the Story 1.4 merge on `main`.

## Spec Change Log

## Review Triage Log

Round 1 (blind hunter BH, edge-case hunter EC, verification gap VG). 22 findings, 16 rows after grouping by root cause: 6 patched, 10 rejected, 0 deferred.

| # | Finding | Verdict | Evidence | Route |
|---|---------|---------|----------|-------|
| 1 | BH1 + EC8 + EC9 + VG2 (purge) `purgeTodos` throws on a non-2xx `DELETE`, but the API has no DELETE route until Story 2.4, so from the second test on `beforeEach` throws and the Empty State wait fails | medium | True: `apps/api/src/routes/todos.ts` registers GET and POST only and the not-found handler answers 404; `create.spec.ts` test 1 persists a Todo. Fix: tolerate 404 on DELETE, wait for Add to be enabled as the ready signal, and assert relative counts, `.first()` and unique descriptions instead of an empty store. | patch |
| 2 | BH2 the two spec files race on one store under Playwright's parallel workers | false | AD-12 and Story 1.5's own AC bind the harness to `workers: 1`; the specs do not need to configure it. | rejected |
| 3 | BH3 + VG (other) copy strings, `DESCRIPTION_MAX` and the path are mirrored by hand across the E2E files | low | True; one hoist into `e2e/support/copy.ts` gives Story 1.5 a single swap point. | patch |
| 4 | BH4 a repeated identical local rejection batches `null` then the same error in one tick, so the live region does not re-announce | low | True in React's batching, but the message is still displayed and still referenced by `aria-describedby` on the focused input; the fix would rely on microtask ordering with no observable test. | rejected |
| 5 | BH5 + EC3 + VG (other) text typed during a pending create is wiped by `setValue('')` on success | low | True; the window is the 100 ms action bound under Normal conditions, and the fix adds a guard on the submitted value. | rejected |
| 6 | BH6 + EC6 a `VALIDATION_ERROR` set while the list is in the load Error State would mark the input invalid and describe it by the load message | false | Add is disabled outside `ready` (implicit submission is blocked by a disabled default button) and `load()` clears `writeError`, so no path reaches that state. | rejected |
| 7 | BH7 generated E2E titles read "an whitespace-only" and "an over the limit" | low | True; article moves into the label tuple. | patch |
| 8 | BH8 E2E server `400` case does not assert `aria-describedby` or focus; `502` case does not assert `aria-describedby` absent | low | True; the matrix says "same attributes as the local case" and the local loop already has the assertions. | patch |
| 9 | BH9 client suite lacks a `500 INTERNAL_ERROR` envelope case and a `2xx { id: 1 }` case, the only input that hits the `typeof id` false branch | low | True; v8 does not count the `&&` chain, so 100% hides it. Two rows added. | patch |
| 10 | EC1 `createTodo` rejecting leaves `creatingRef` stuck true | false | `createTodo` wraps `fetch` and `res.json()` in try/catch and never rejects past its boundary (pinned by the network-failure test). | rejected |
| 11 | EC2 `onSubmit` rejecting leaves focus and value untouched | false | `create` awaits only `createTodo`, which never rejects; `setState` does not throw. | rejected |
| 12 | EC4 focus is pulled back to the input if the user moved elsewhere during the pending request | low | True, but only inside the 100 ms window and the spec requires focus to end in the input; the fix adds an `activeElement` guard. | rejected |
| 13 | EC5 `load()` finishing while the same create is pending inserts the id twice | false | `load()` runs on mount and from Retry, which only renders in `error`, where Add is disabled; a create pending from `ready` cannot overlap a load. | rejected |
| 14 | EC7 `isTodo` checks only `id`, so a malformed 2xx object is inserted | low | The API serialises every 201 through `TodoSchema`, so the body cannot lack fields; a fuller guard protects undemonstrated state. | rejected |
| 15 | VG1 the pre-await `focus()` in `TodoInput.handleSubmit` is unpinned: deleting it leaves 68/68 green | medium | Pre-verified by the layer; without it a click on Add drops focus to `body` for the whole pending window in a real browser. Add the deferred-`onSubmit` focus test. | patch |
| 16 | VG2 (run) the E2E specs are neither compiled nor executed here | n/a | Out of scope by intent: the user assigned the harness, config and first run to Story 1.5, recorded in Implementation Notes and the AI log. | rejected |

## Design Notes

- Local validation lives in the hook's `create`, not in `TodoInput`, so the component stays a dumb form and the validation and server rejection share one `writeError` path and one copy table (AD-6 "same message mechanism"). `TodoInput` only learns the outcome through the resolved boolean.
- `onSubmit` returns `Promise<boolean>` (true means the Todo was created and the field may clear) rather than the `ApiResult`, so the component never sees codes or copy.
- `creatingRef` guards the in-flight check synchronously; `creating` state only drives `disabled`. A second `fireEvent.submit` in the same tick must not reach the client.
- Golden App wiring:

```tsx
const { state, load, create, creating, writeError } = useTodos();
const messageId = useId();
const message =
  state.status === 'error'
    ? errorCopy.load[state.code]
    : writeError
      ? errorCopy[writeError.action][writeError.code]
      : null;
<TodoInput onSubmit={create} disabled={creating || state.status !== 'ready'}
  invalid={writeError?.code === 'VALIDATION_ERROR'} errorId={messageId} />
<ErrorBanner messageId={messageId} message={message} action={failed ? { label: retryLabel, onClick: load } : undefined} />
```

## Verification

**Commands:**
- `npm run build` -- expected: contract, api and web compile.
- `npm run lint` -- expected: ESLint, Prettier and every workspace typecheck pass.
- `npm test` -- expected: all suites pass; web coverage at or above 70% lines and branches (baseline 29 tests, 100/97).
- `git diff --stat main -- apps/api packages/contract` -- expected: empty.
- `grep -rn "/api/v1" apps/web/src` -- expected: no matches.

**Manual checks (if no CLI):**
- Smoke: `DB_PATH=<tmp>/todos.db PORT=3000 npx tsx src/server.ts` in `apps/api` and `npm run dev -w apps/web`; type a todo, press Enter: it appears first, the field clears and keeps focus; submit an empty field: the message shows under the input and is announced.
