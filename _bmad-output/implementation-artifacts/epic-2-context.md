# Epic 2 Context: Capture, complete and clear Todos

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Turn the read-only shell from Epic 1 into the working product: the user types a task and it lands at the top of the list, ticks and unticks it from its checkbox, and deletes it with one action. Every write goes through the API, is validated on both sides, persists across refresh and restart, and fails without losing the user's work. The epic also completes the API (create, update, delete), publishes its contract, and makes the app keyboard, screen-reader and phone usable. Epic 3 then audits and documents what this epic builds.

## Stories

- Story 2.1: Create a Todo through the API
- Story 2.2: Add a Todo from the input
- Story 2.3: Tick and untick a Todo
- Story 2.4: Delete a Todo and publish the API contract
- Story 2.5: Keyboard, screen reader and small-screen fit

## Requirements & Constraints

- Create: submitting a Description (Enter or a visible submit control) adds exactly one Active Todo with API-assigned id and Created At; it appears at the top within 100 ms under Normal conditions; on success the input clears and keeps focus.
- Validation on client and server: empty or whitespace-only after trimming, or over 500 characters, is rejected with no Todo created; the input shows a visible, screen-reader-announced message; the API returns 400 with the error envelope regardless of what the client does. Malformed JSON, wrong types and unknown fields are 400; the API never returns 500 for user input.
- Toggle works in both directions. Delete works on any Todo with no confirmation and no undo. Each is reflected within 100 ms and survives refresh.
- A failed create, toggle or delete leaves the list at its last persisted state and shows a non-blocking, human-readable message naming the action; the user can repeat it. A failed create keeps the submitted text and focus in the input. Never show raw errors, stack traces or status codes.
- At most one in-flight write per Todo; a further action on the same Todo waits for the pending one. Last write wins across tabs; no live sync.
- Completed Todos use at least two visual cues (strike-through, reduced contrast, checked control), never colour alone, and expose checked state to assistive technology.
- Full keyboard operation of create, toggle and delete with visible focus.
- Responsive: at 360 px and 1280 px all controls reachable without horizontal scroll and touch targets at least 44 x 44 px; no clipping or overlap from 320 px to 1920 px; readable on a phone without zoom.
- Description is untrusted text: rendered as text only, validated server-side on every write, prepared statements only.
- The complete API contract (paths, verbs, bodies, status and error codes) is documented in the repo and matched by one integration spec per endpoint.
- Empty State reappears when the last Todo is deleted.
- Coverage stays at 70% lines and branches per app; every story appends to `docs/ai-integration-log.md`.

## Technical Decisions

- REST additions: `POST /api/v1/todos` `{ description }` returns 201 Todo; `PATCH /api/v1/todos/:id` `{ description?, completed? }` returns 200 Todo with `minProperties: 1`, both fields applied together when present; `DELETE /api/v1/todos/:id` returns 204 empty. Schemas already live in the contract package. A malformed or unknown id is NOT_FOUND. No other endpoints.
- Validation split: the route schema enforces type and shape only (string, no unknown fields); `TodoService` owns trim, 1 to `DESCRIPTION_MAX` length and not-found, and stores the trimmed value. The client sends `description.trim()` and blocks locally only for empty-after-trim and over-max, using the same constant and the same message mechanism as a server VALIDATION_ERROR.
- Identity and time: `id` from `crypto.randomUUID()` in the service, never client-generated; `createdAt` ISO 8601 UTC with millisecond precision, set server-side. Reply only after the SQLite statement commits.
- Server is truth, no optimistic updates: each successful write replaces, inserts (at index 0) or removes the item using the Todo the API returns; the client never recomputes server-owned fields and never re-sorts.
- In-flight guard by disabling, not queuing: a pending write disables that Todo's checkbox and delete button; a pending create disables the submit control.
- Write failures: list stays at last persisted state; message keyed by action plus error code, copy authored in the web, server `message` never shown. NOT_FOUND on PATCH or DELETE removes the item locally and shows the message. Non-JSON or unexpected responses (502, network failure) are treated as INTERNAL_ERROR.
- Error envelope unchanged: the existing error and not-found handlers produce every `{ code, message }`; new routes never build error bodies.
- Tests per level: unit (service against the in-memory repository), integration (one spec per endpoint on a temp SQLite file), component (client mocked), E2E against the built images with `page.route` to simulate failures. Expected E2E specs: `create`, `validation`, `complete`, `delete`, `error-handling`.
- Do not build: optimistic rollback, request queues, UI Description editing, confirmation dialogs, undo, clear completed, pagination, filtering, sorting.

## UX & Interaction Patterns

- `TodoInput` owns create: Enter and the visible submit control both submit; on validation failure it sets `aria-invalid` and `aria-describedby` pointing at the message.
- The single `role="status"` live region in `ErrorBanner` announces both API failures and the validation message; E2E locates messages with `getByRole("status")`.
- `TodoItem` is a list item with a labelled checkbox (Completion Status) and a labelled delete button; completed styling via CSS modules and tokens; the single breakpoint lives in `tokens.css`.
- Sensible tab order through input, submit, then each item's checkbox and delete; visible focus everywhere; mobile-first layout verified at a 360 px viewport with no horizontal overflow.

## Cross-Story Dependencies

- 2.1 (POST) is the API half of 2.2 (input); 2.2 needs 2.1 running or mocked.
- 2.3 and 2.4 each add one route (PATCH, DELETE) plus its web write path, building on the Epic 1 client and state hook and the pending-write guard first introduced in 2.2.
- 2.4 publishes the contract document, so it needs 2.1 and 2.3 complete; its delete route makes the Epic 1 E2E purge exercise a real endpoint.
- 2.5 cuts across 2.2 to 2.4 (keyboard, roles, viewports, error-handling E2E) and should land last.
- Epic 3 reuses this epic's E2E specs and audits the states it adds (populated, Completed, validation error).
