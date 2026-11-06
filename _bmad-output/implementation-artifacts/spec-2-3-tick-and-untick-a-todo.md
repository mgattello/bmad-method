---
title: 'Story 2.3: Tick and untick a Todo'
type: 'feature'
created: '2026-10-26'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '982b0312c7846c2c770dca4c42d3919487acb3a1'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-bmad-method-2026-10-26/ARCHITECTURE-SPINE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The list renders a checkbox per Todo but `TodoItem.onToggle` is unwired and the API has no update route, so Dana cannot mark a Todo done or back to open, and nothing she ticks would survive a refresh.

**Approach:** Add `PATCH /api/v1/todos/:id` end to end: the route validates shape with `UpdateTodoBodySchema`, `TodoService.update` owns not-found and the description rules, the repository gains `findById` and `update`. In the web, `updateTodo` joins the client, `useTodos` gains `toggle` and `pendingIds`, `TodoItem` disables its checkbox and delete button while a write is pending, and the item is replaced from the returned Todo (no optimistic update). Unit, integration and component tests prove every AC now; `e2e/complete.spec.ts` is written for Story 1.5's harness.

## Boundaries & Constraints

**Always:** Paths, schemas, types and the limit come from `@todo/contract` only (`TODOS_PATH`, `todoPath`, `UpdateTodoBodySchema`, `TodoSchema`, `Todo`, `UpdateTodoBody`, `ErrorCode`, `DESCRIPTION_MAX`). The route schema checks type and shape only (`minProperties: 1`, `additionalProperties: false` already set in the contract); `TodoService` owns not-found, trim and 1 to `DESCRIPTION_MAX`, and stores the trimmed value (AD-4, AD-6). A malformed or unknown `:id` is `404 NOT_FOUND`; the route handler builds no error body, the existing error handler maps a thrown `NotFoundError` (`statusCode = 404`) and `ValidationError` to the envelope (AD-3). With both fields present both apply; `id` and `createdAt` never change (AD-2). The reply follows the committed SQLite statement (AD-5). The web has no optimistic update: the item is replaced in place, by id, with the Todo the API returned; the list is never re-sorted (AD-7, AD-8). At most one in-flight write per Todo id: while pending, that item's checkbox and delete button are `disabled` and a further toggle on that id is ignored, not queued; other items stay enabled (AD-7). A failed toggle leaves the list at its last persisted state and shows `errorCopy.toggle[code]` in the single `role="status"` region, naming the update action; `NOT_FOUND` removes the item locally and shows the message (AD-7). The server `message` is never rendered; copy lives in `copy.ts`. Completed rendering keeps the existing two non-colour cues (strike-through on the label, checked control) plus muted colour; the checkbox carries `checked` so assistive technology sees the state (FR-6, Accessibility convention). `updateTodo` never throws past its boundary and treats non-JSON or unexpected responses as `INTERNAL_ERROR`. Coverage stays at or above 70% lines and branches for `apps/api` and `apps/web`. Decisions: when the id is unknown and the description is also invalid, not-found wins (the service looks the Todo up before applying rules); `toggle` sends `{ completed: !todo.completed }` from the rendered Todo (the last persisted state) and never a description; `updateTodo(id, patch)` takes a full `UpdateTodoBody` so Story 2.4 and a later description edit reuse it; a toggle `VALIDATION_ERROR` (unreachable from this client) still has copy and never marks the input invalid, so `App` keys `invalid` on `action === 'create'`; a pending toggle does not disable Add and a pending create does not disable any item.

**Never:** No contract changes. No `DELETE` route or client call (2.4). No UI description editing, no optimistic flip or rollback, no request queue, no retry control for a failed toggle (the user clicks again), no refetch after a write, no `alert` role, no second live region, no `dangerouslySetInnerHTML`. Do not install Playwright, add `e2e/playwright.config.ts` or run the E2E specs (Story 1.5 owns the harness). Do not rename or restructure the Story 1.3, 2.1 or 2.2 files or their exports; extend them. Do not touch existing entries in `docs/ai-integration-log.md` or `docs/architecture.md` section 3 (it already documents PATCH; verify, do not rewrite).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Tick (API) | `PATCH /api/v1/todos/:id` `{ completed: true }` on an open Todo | `200` Todo with `completed: true`, same `id`, `description`, `createdAt`; a second `buildApp` on the same file lists it ticked | N/A |
| Untick (API) | `{ completed: false }` on a Completed Todo | `200` Todo with `completed: false`, durable | N/A |
| Description (API) | `{ description: '  New text  ' }` | `200` Todo with `description: 'New text'`, `completed` unchanged | N/A |
| Both (API) | `{ description: ' x ', completed: true }` | `200` with both applied | N/A |
| Description rule | `''`, `'   '`, `DESCRIPTION_MAX + 1` after trim | `400 { code: VALIDATION_ERROR, message: <rule text> }`, row unchanged | `ValidationError` |
| Shape | `{}`, `{ owner: 'me' }`, `{ completed: 'yes' }`, `{ description: 1 }`, malformed JSON, non-JSON content type | `400 { code: VALIDATION_ERROR, message: 'Invalid request' }`, row unchanged | schema / generic 4xx |
| Unknown or malformed id | `/todos/<uuid not stored>`, `/todos/not-a-uuid`, `/todos/%20` with a valid body | `404 { code: NOT_FOUND, message }`, nothing written | `NotFoundError` |
| Unknown id and bad description | unknown id, `{ description: '' }` | `404 NOT_FOUND` | not-found first |
| Trailing slash | `PATCH /todos/` | `404 NOT_FOUND` (not-found handler) | existing |
| Closed store | repository closed | `500 INTERNAL_ERROR`, one error log line | existing handler |
| Tick (web) | click the checkbox of an open Todo | `updateTodo(id, { completed: true })` once; checkbox stays unchecked and both controls `disabled` until the response; on `ok` the item is replaced from the response (checked, strike-through class), controls enabled, status region empty | N/A |
| Untick (web) | click the checkbox of a Completed Todo | `updateTodo(id, { completed: false })`; same flow | N/A |
| Pending | second click on the same checkbox while pending | no second request; after the response one request total | N/A |
| Two Todos | toggles on two different ids | two requests, both pending, each resolves independently | N/A |
| Failure | `INTERNAL_ERROR` (500 envelope, 502 HTML, network) | checkbox keeps its last persisted state, controls re-enabled, status region shows `errorCopy.toggle.INTERNAL_ERROR`; input has no `aria-invalid` | envelope or `failure()` |
| Not found | `404 NOT_FOUND` envelope | item removed from the list (Empty State if it was the last), status region shows `errorCopy.toggle.NOT_FOUND` | envelope |
| Next write | any message showing, next toggle or create starts | message cleared when the write starts, then the new outcome applies | N/A |
| Refresh | tick or untick, reload | Completion Status unchanged after reload | N/A |

</frozen-after-approval>

## Code Map

- `packages/contract/src/todo.ts`, `routes.ts` -- `UpdateTodoBodySchema` (`Type.Partial` of description and completed, `additionalProperties: false`, `minProperties: 1`), `UpdateTodoBody`, `todoPath(id)` (encodes the id). Read-only.
- `apps/api/src/service/errors.ts` -- `ValidationError { statusCode = 400 }`. Add `export class NotFoundError extends Error { statusCode = 404; override name = 'NotFoundError' }` (class fields; `erasableSyntaxOnly`). `app.ts` `statusOf` already maps `statusCode === 404` to the `NOT_FOUND` envelope with the fixed `'Not found'` message and a `debug` log; no handler change.
- `apps/api/src/repository/todo-repository.ts` -- port `{ list, insert, ping, close }`. Add `findById(id: string): Todo | undefined` (one-line comment: a copy or undefined; throws when the store is unreachable) and `update(todo: Todo): void` (stores description and completed for `todo.id` as given; throws when unreachable).
- `apps/api/src/repository/sqlite-todo-repository.ts` -- prepare `findStmt = scoped('SELECT id, description, completed, created_at FROM todos') + ' WHERE id = ?'` (the read seam of AD-10; the owner filter becomes an `AND` when it arrives) and `updateStmt = 'UPDATE todos SET description = ?, completed = ? WHERE id = ?'` with `completed` bound `0 | 1`. `findById` maps through `toTodo`. Table unchanged.
- `apps/api/src/repository/in-memory-todo-repository.ts` -- `findById` returns a copy; `update` replaces the element with the same id in place (keeps insertion order so the tie-break is unchanged).
- `apps/api/src/service/todo-service.ts` -- add `update(id: string, patch: UpdateTodoBody): Todo`: `const existing = this.repository.findById(id)`; if none throw `new NotFoundError('Todo not found')`; if `patch.description !== undefined` trim and apply the same rule as `create` (hoist the check into a private `validDescription(raw): string` used by both); `const updated: Todo = { ...existing, description: <trimmed or existing>, completed: patch.completed ?? existing.completed }`; `this.repository.update(updated)`; return it. `id` and `createdAt` are spread from `existing`.
- `apps/api/src/routes/todos.ts` -- add `app.patch(\`${TODOS_PATH}/:id\`, { schema: { params: Type.Object({ id: Type.String() }), body: UpdateTodoBodySchema, response: { 200: TodoSchema } } }, async (request) => service.update(request.params.id, request.body))`. `import Type from 'typebox'` (direct dependency of the api, already used in `app.test.ts`). Follows the existing full-path style of `GET` and `POST`.
- `apps/api/src/service/todo-service.test.ts` -- `stub()` helper builds a `TodoRepository` literal; it and the `unordered`, `ok`, `broken` literals must gain `findById` and `update` or they stop type-checking. Add `describe('TodoService.update')`.
- `apps/api/src/app.test.ts` -- inline `TodoRepository` literals (`broken` and friends) gain the two methods. Add a `describe('PATCH todos')` using `app(new InMemoryTodoRepository(seed))`: 200 shape and `content-type`, service rejection carries the rule text, schema rejection carries `'Invalid request'`, unknown id is the `NOT_FOUND` envelope, `broken` gives 500 with one error log line via `withLogCapture`.
- `apps/api/src/repository/sqlite-todo-repository.test.ts` -- temp-file suite; add `findById` (hit, miss, boolean mapping) and `update` (row rewritten, `completed` stored as 0/1, other rows untouched, `update` after `close()` throws).
- `apps/api/test/todos.int.test.ts` -- `seed()`, `open()`, `count()` helpers and the closed-store log pattern; add `describe(\`PATCH ${TODOS_PATH}/:id\`)` here (one spec file per endpoint path), creating its subject through `POST` and reading the row back with `openDatabase` for durability.
- `apps/web/src/api/todos-client.ts` -- `ApiResult`, `failure()`, `envelopeCode()`, `isTodo()`. Add `updateTodo(id: string, patch: UpdateTodoBody): Promise<ApiResult<Todo>>`: `fetch(todoPath(id), { method: 'PATCH', headers: { accept, 'content-type': 'application/json' }, body: JSON.stringify(patch) })`, same `res.ok` / `isTodo` / `envelopeCode` / try-catch shape as `createTodo`.
- `apps/web/src/state/use-todos.ts` -- `WriteError.action` becomes `'create' | 'toggle'`. Add `pendingIds: ReadonlySet<string>` state plus a `pendingRef = useRef(new Set<string>())` synchronous guard, and `toggle(todo: Todo): Promise<void>` as a stable `useCallback`: return if `pendingRef.current.has(todo.id)`; `setWriteError(null)`; add the id to the ref and to state (new `Set` each time); `const result = await updateTodo(todo.id, { completed: !todo.completed })`; on `ok` `setState((s) => s.status === 'ready' ? { ...s, todos: s.todos.map((t) => (t.id === result.data.id ? result.data : t)) } : s)`; on `NOT_FOUND` remove the id from `s.todos` and set `writeError { action: 'toggle', code }`; on any other failure set `writeError` only; finally delete the id from the ref and state. Return `{ state, load, create, creating, toggle, pendingIds, writeError }`.
- `apps/web/src/copy.ts` -- widen `errorCopy` to `Record<'load' | 'create' | 'toggle', ...>` and add `toggle: { INTERNAL_ERROR: "We couldn't update your todo. Check your connection and try again.", NOT_FOUND: "That todo no longer exists, so it was removed from your list.", VALIDATION_ERROR: "We couldn't update your todo because the request was rejected. Try again." }`.
- `apps/web/src/components/TodoItem.tsx` -- props gain `pending?: boolean`; `disabled={pending}` on the checkbox and the delete button; keep `checked={todo.completed}`, the `useId` label pairing and the `completed` class. Update the comment (toggle is wired now; delete in 2.4).
- `apps/web/src/components/TodoItem.module.css` -- add `.checkbox:disabled, .delete:disabled { opacity: 0.6; cursor: default; }` (tokens only; the completed cues already exist).
- `apps/web/src/components/TodoList.tsx` -- props gain `pendingIds?: ReadonlySet<string>`, `onToggle?: (todo: Todo) => void`, `onDelete?`; render `<TodoItem key todo pending={pendingIds?.has(todo.id)} onToggle onDelete />`. Still never sorts.
- `apps/web/src/App.tsx` -- destructure `toggle` and `pendingIds`; `<TodoList todos={state.todos} pendingIds={pendingIds} onToggle={toggle} />`; `invalid={writeError?.action === 'create' && writeError.code === 'VALIDATION_ERROR'}`. Message selection is already keyed by `writeError.action`.
- `apps/web/src/api/todos-client.test.ts` -- `stubFetch`, `jsonResponse`; add `describe('updateTodo')`.
- `apps/web/src/state/use-todos.test.ts` -- `deferred()`, `renderReady()`, `vi.mock('../api/todos-client.js')`; add `updateTodo` to the mocked resets and a `describe('useTodos toggle')`.
- `apps/web/src/components/TodoItem.test.tsx` -- add `pending` and `checked` cases.
- `apps/web/src/App.test.tsx` -- `deferred()`, `itemStyles` import (asserts the `completed` class); add `describe('App toggle')` with `updateTodo` mocked. `main.test.tsx` factory mock gains `updateTodo`.
- `e2e/complete.spec.ts` -- new, written only: `import { expect, test } from '@playwright/test'`; `purgeTodos` from `./support/todos`, `TODOS_PATH` from `./support/copy`; `beforeEach` purges, `goto('/')`, waits for Add enabled; seed through `request.post(TODOS_PATH, { data: { description } })` with a unique description, reload, then `getByRole('checkbox', { name: description })`; tests: tick (checked, label `toHaveCSS('text-decoration-line', 'line-through')`, status empty), untick, tick then reload stays checked, untick then reload stays unchecked.
- `README.md` -- "Run the API locally": add a `curl -X PATCH localhost:3000/api/v1/todos/<id> -H 'content-type: application/json' -d '{"completed":true}'` example after the POST one (200 with the updated Todo; `{}` or an unknown field is `400 VALIDATION_ERROR`; an unknown id is `404 NOT_FOUND`); Commands `test:int` row says "todos GET, POST and PATCH"; "## Web" paragraph: the checkbox toggles through PATCH, the item re-renders from the response, pending disables the item's controls, failure copy and NOT_FOUND removal, `e2e/complete.spec.ts` runs under the Story 1.5 harness.
- `apps/api/test/README.md` -- add a `todos.int.test.ts (PATCH)` row listing the cases.
- `docs/ai-integration-log.md` -- append `## Story 2.3: Tick and untick a Todo` after the Story 2.2 entry with the same headings (Date, Agent usage, Prompts, MCPs and tools, What the AI missed and debugging, Decisions made while implementing, Review rounds, Limitations); self-contained, no edits above it; record that `e2e/complete.spec.ts` is run by Story 1.5.
- `eslint.config.js` -- `react-hooks` v7 compiler rules on `apps/web/**`: refs are mutated only inside callbacks, no synchronous `setState` in effects. `apps/web/tsconfig.app.json` has `noUnusedLocals`; `tsc -b` type-checks tests. Prettier runs on `e2e/*.spec.ts`.

## Tasks & Acceptance

**Execution:**
- [x] `apps/api/src/service/errors.ts` -- `NotFoundError` with `statusCode = 404` -- the service's only not-found signal (AD-3, AD-4).
- [x] `apps/api/src/repository/todo-repository.ts` -- add `findById` and `update` with one-line comments -- the port (AD-4, AD-10).
- [x] `apps/api/src/repository/sqlite-todo-repository.ts` -- `findStmt` through `scoped()`, `updateStmt`, `findById`, `update` -- SQL stays in one file, prepared statements only (AD-5).
- [x] `apps/api/src/repository/in-memory-todo-repository.ts` -- `findById` (copy) and in-place `update` -- unit-test double.
- [x] `apps/api/src/service/todo-service.ts` -- `update(id, patch)` as in the Code Map, sharing the description rule with `create` -- AD-2, AD-6.
- [x] `apps/api/src/routes/todos.ts` -- PATCH route with params, body and 200 schemas -- AD-2; the handler builds no error body (AD-3).
- [x] `apps/api/src/service/todo-service.test.ts` -- `update`: ticks and unticks with `id`, `description`, `createdAt` unchanged and the repository holding the new row; trims a description and stores the trimmed value; both fields together; `DESCRIPTION_MAX` accepted, `DESCRIPTION_MAX + 1`, `''`, `'   '` throw `ValidationError` (`statusCode 400`, rule text) and `update` is not called; unknown id throws `NotFoundError` (`statusCode 404`) and `update` is not called, also when the description is invalid; repository `update` failure propagates; `InMemoryTodoRepository.findById` returns a copy and `update` keeps list order -- unit level.
- [x] `apps/api/src/repository/sqlite-todo-repository.test.ts` -- `findById` hit, miss and boolean mapping; `update` rewrites one row (raw read sees `completed` 0/1, `created_at` unchanged, other rows untouched); `update` after `close()` throws -- repository level.
- [x] `apps/api/src/app.test.ts` -- PATCH through `buildApp`: 200 shape and `content-type`; rule rejection 400 with rule text; schema rejection 400 `'Invalid request'` for `{}`, `{ owner }`, `{ completed: 'yes' }`; unknown id 404 `{ code: NOT_FOUND, message: 'Not found' }`; `broken` repository 500 with exactly one error log line; stubs gain the two methods -- app level.
- [x] `apps/api/test/todos.int.test.ts` -- PATCH describe on the temp SQLite file covering every API row of the I/O Matrix: tick then untick durable for a second `buildApp` and a direct `openDatabase` read; description only; both; each 400 case (rule and shape, malformed JSON, non-JSON content type) leaves the row unchanged and never leaks library text; unknown id, `not-a-uuid`, `%20` and trailing slash are 404; `id` and `createdAt` unchanged; closed store 500 -- integration home (AD-12).
- [x] `apps/web/src/api/todos-client.ts` -- `updateTodo` as in the Code Map -- the only place the web talks to PATCH (AD-3, AD-9).
- [x] `apps/web/src/copy.ts` -- `toggle` copy -- one home for copy (AD-3).
- [x] `apps/web/src/state/use-todos.ts` -- `toggle`, `pendingIds`, `WriteError.action` union -- the list state machine owns the write (AD-7).
- [x] `apps/web/src/components/TodoItem.tsx` + `TodoItem.module.css` -- `pending` disables both controls -- one in-flight write per Todo (AD-7).
- [x] `apps/web/src/components/TodoList.tsx`, `apps/web/src/App.tsx` -- pass `pendingIds` and `toggle` through; `invalid` keyed on the create action -- wiring.
- [x] `apps/web/src/api/todos-client.test.ts` -- `updateTodo`: PATCHes `todoPath(id)` with method, both headers and the JSON body, an id with `/` is encoded; `200` object -> ok; `404` -> `NOT_FOUND` and the message is discarded; `400` -> `VALIDATION_ERROR`; `500` envelope, `502` HTML, network error, `2xx` non-object and `{ id: 1 }` -> `INTERNAL_ERROR` -- client level.
- [x] `apps/web/src/state/use-todos.test.ts` -- `toggle`: sends `{ completed: true }` for an open Todo and `{ completed: false }` for a Completed one, replaces the item in place from the response with order and other items unchanged, `pendingIds` holds the id while pending and is empty after; second toggle on the same id while pending is ignored (client once); toggles on two ids both run (client twice, both ids pending); `INTERNAL_ERROR` sets `writeError { action: 'toggle' }` and leaves the list unchanged; `NOT_FOUND` removes the item and sets `writeError`; a toggle clears a previous create or toggle `writeError`, and a create clears a toggle one -- hook level per the matrix.
- [x] `apps/web/src/components/TodoItem.test.tsx` -- `pending` disables the checkbox and the delete button and neither handler fires on click; without `pending` both are enabled; `checked` follows `todo.completed` and the `completed` class is applied only when true -- component level.
- [x] `apps/web/src/App.test.tsx` -- with `updateTodo` mocked: clicking the checkbox of an open Todo calls `updateTodo(id, { completed: true })`, the checkbox stays unchecked and both of that item's controls are disabled while the other item's stay enabled, a second click sends nothing; after resolve the item is checked with the `completed` class, controls enabled, status empty; untick path; `INTERNAL_ERROR` keeps the checked state, re-enables controls and shows `errorCopy.toggle.INTERNAL_ERROR` in `getByRole('status')` with no `aria-invalid` on the input; `NOT_FOUND` removes the item and shows the copy, and removing the only item shows the Empty State; still exactly one `role="status"`; a server `message` never appears in `document.body` -- app level per the matrix.
- [x] `apps/web/src/main.test.tsx` -- add `updateTodo` to the factory mock -- keeps the module shape.
- [x] `e2e/complete.spec.ts` -- as in the Code Map: tick, untick, and both survive a reload -- written for Story 1.5's harness, not run here (AD-12).
- [x] `README.md`, `apps/api/test/README.md`, `docs/ai-integration-log.md` -- PATCH curl example and `test:int` row, Web paragraph, test README row, Story 2.3 log entry -- graded deliverables.

**Acceptance Criteria:**
- Given a clean worktree, when `npm run build && npm run lint` run, then contract, api and web compile and ESLint, Prettier and every `typecheck` pass (the E2E spec is Prettier-clean).
- Given `npm test`, when the suites run, then all pass and coverage is at or above 70% lines and branches for `apps/api` and `apps/web`.
- Given `npm run test:int`, when the specs run, then all pass with the PATCH cases in `todos.int.test.ts`.
- Given the diff, when reviewed, then nothing under `packages/contract` changed, no literal `/api/v1` appears under `apps/web/src` or `apps/api/src`, no SQL exists outside `sqlite-todo-repository.ts` and the test seeds, and no `message` field from an envelope is rendered anywhere.
- Given keyboard-only use in the component tests, when the checkbox is focused and toggled with the keyboard (Space on the checkbox), then the toggle is sent and focus stays visible on the control.

## Implementation Notes

## Spec Change Log

## Review Triage Log

## Design Notes

- `NotFoundError` mirrors `ValidationError`: a `statusCode` field the existing `statusOf` already understands, so the error handler needs no new branch and the envelope message stays the fixed `'Not found'`.
- Not-found is checked before the description rule: a PATCH on a Todo that does not exist is `404` whatever the body says, which keeps the API answer independent of the body once the shape is valid.
- `findById` goes through `scoped()` like `list`, so an owner filter remains a one-place change (AD-10); `updateStmt` binds the id, and the owner becomes a second bound column later.
- `pendingIds` is a `Set` held in state so `TodoList` can hand `pending` to each item with one prop; `pendingRef` is the synchronous guard, exactly like `creatingRef` in 2.2, so two clicks in one tick reach the client once.
- Replace-by-id from the response keeps AD-8: the API's order is never recomputed and a Todo that the server rewrote lands where the list already had it.
- Golden hook example:

```ts
const toggle = useCallback(async (todo: Todo) => {
  if (pendingRef.current.has(todo.id)) return;
  setWriteError(null);
  pendingRef.current.add(todo.id);
  setPendingIds(new Set(pendingRef.current));
  const result = await updateTodo(todo.id, { completed: !todo.completed });
  if (result.ok) {
    setState((s) => s.status === 'ready'
      ? { ...s, todos: s.todos.map((t) => (t.id === result.data.id ? result.data : t)) } : s);
  } else {
    if (result.code === ErrorCode.NOT_FOUND)
      setState((s) => s.status === 'ready'
        ? { ...s, todos: s.todos.filter((t) => t.id !== todo.id) } : s);
    setWriteError({ action: 'toggle', code: result.code });
  }
  pendingRef.current.delete(todo.id);
  setPendingIds(new Set(pendingRef.current));
}, []);
```

## Verification

**Commands:**
- `npm run build` -- expected: contract, api and web compile.
- `npm run lint` -- expected: ESLint, Prettier and every workspace typecheck pass.
- `npm test` -- expected: all suites pass; api and web coverage at or above 70% lines and branches (baseline api 100/95, web 100/100).
- `npm run test:int` -- expected: all integration specs pass including the PATCH describe.
- `git diff --stat 982b031 -- packages/contract` -- expected: empty.
- `grep -rn "/api/v1" apps/web/src apps/api/src` -- expected: no matches.

**Manual checks (if no CLI):**
- Smoke: `DB_PATH=<tmp>/todos.db PORT=3000 npx tsx src/server.ts` in `apps/api` and `npm run dev -w apps/web`; tick a todo: the checkbox stays unchanged for a moment, then flips with the strike-through; refresh: it stays ticked; stop the API and tick again: the checkbox does not move and the status region shows the update message.
