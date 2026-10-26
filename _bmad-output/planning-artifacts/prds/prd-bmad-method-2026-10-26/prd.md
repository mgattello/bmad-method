---
title: Todo App
status: final
created: 2026-10-26
updated: 2026-10-26
---

# PRD: Todo App

## 0. Document Purpose

This PRD defines the first version of a single-user, full-stack Todo App, the capstone exercise of the BMAD training pathway. Audience: Architect, story author, Developer, QA engineer, DevOps engineer. It refines the course-supplied prose PRD at `/PRD.md` and the training brief at `/CONTEXT.md`. Conventions: vocabulary is anchored in the Glossary (§3); FRs are globally numbered under features (§4); unconfirmed inferences carry inline `[ASSUMPTION]` tags indexed in §11; requirements that come from the training brief rather than the product are marked *(brief)*. Tooling, QA activities and training-deliverable mechanics live in `addendum.md`.

## 1. Vision

The Todo App lets one person capture tasks and clear them, with nothing in the way. A user opens it and sees their list. They type a task and it is there. They tick it off and it visibly recedes. They delete it and it is gone. Every one of those actions is reflected at once, survives a refresh, and works the same on a phone as on a laptop. The experience must be clear, reliable and intuitive: no onboarding, no explanation, no hidden controls.

The product deliberately resists feature growth. No accounts, no sharing, no priorities, no due dates. The bet is that a tiny, reliable, obviously usable core is a better foundation than a broad one, both for the user and for the team that will extend it later. The architecture must leave the door open to users and authentication without requiring a rewrite.

The app also serves a second purpose: it is the vehicle for a spec-driven development exercise. Its scope is small enough to finish, but it must still exercise a real frontend, a real API, persistent storage, automated tests at four levels and a containerised deployment. The quality bar is therefore higher than the feature count suggests. Despite its minimal scope, v1 must feel like a complete, polished product, not a demo or a scaffold.

## 2. Target User

### 2.1 Jobs To Be Done
- **Functional:** get a task out of my head and into a list I will see again, in under five seconds.
- **Functional:** see at a glance what is still open versus already done.
- **Emotional:** feel the small relief of ticking something off and watching the list shrink.
- **Contextual:** do all of this on whatever device is nearest, with no setup and no sign-in.

### 2.2 Non-Users (v1)
The v1 Todo List belongs to the deployment, not to a person. `[ASSUMPTION: no per-user identity, so a single shared Persistence Store behind one deployment.]` Who the product is not for follows from §7.

### 2.3 Key User Journeys

- **UJ-1. Dana captures tomorrow's errands on her phone.**
  Dana, a freelance illustrator, finishes a client call and has four follow-ups in her head. She opens the Todo App in her phone browser. No sign-in, no welcome screen. The Todo List appears within a second, showing yesterday's two Active Todos. She taps the input, types "Send invoice to Kerr", submits. The new Todo appears at the top of the Todo List at once. She repeats for the other three and puts the phone away. **Edge case:** she submits an empty line by accident. Nothing is added and the input tells her a Description is required.

- **UJ-2. Dana clears the list the next morning on her laptop.**
  Dana opens the same deployment in her laptop browser. The same six Todos are there, newest first. She ticks "Send invoice to Kerr". It is struck through and visibly dimmed at once. She realises she ticked the wrong Todo, unticks it, and ticks the right one. She then deletes a Todo that is no longer relevant. It disappears from the Todo List. She refreshes the page to be sure. The Todo List reloads with the same state.

- **UJ-3. The API is down and Dana does not lose her text.**
  Dana types "Order canvas 60x80" and submits while the API is unreachable. The app shows an Error State saying the Todo could not be saved and leaves her text in the input so she can retry. Once the API is back, she submits again and it is saved.

## 3. Glossary

- **Todo** — a single task the user wants to do. Has exactly one Description, one Completion Status and one Created At. Identified by a stable, unique ID assigned by the API.
- **Description** — the short free-text content of a Todo. Required, non-empty after trimming, at most 500 characters. `[ASSUMPTION: 500-character cap.]`
- **Completion Status** — whether a Todo is **Active** (not yet done) or **Completed** (done). Exactly one of the two at any time. "Tick" and "untick" in UJs are the user-facing words for changing it.
- **Created At** — the timestamp the API assigned when the Todo was created. Immutable.
- **Todo List** — the full set of Todos in the Persistence Store, as shown to the user.
- **Persistence Store** — the server-side storage the API reads and writes Todos to. Survives process restarts.
- **API** — the HTTP interface the frontend uses to create, read, update and delete Todos.
- **Empty State** — what the Todo List shows when it contains zero Todos.
- **Loading State** — what the Todo List shows while the initial read from the API is in flight.
- **Error State** — what the app shows when an API call fails.
- **Health Endpoint** — an API route reporting whether the service and its Persistence Store are usable.
- **Normal conditions** — a local or containerised deployment with the API responding. The baseline for every timing bound in this PRD.

## 4. Features

Scope boundary for everything below: §7 Non-Goals and §8 MVP Scope.

### 4.1 Todo Capture
**Description:** The user adds a Todo by typing a Description into a single always-visible input and submitting. The Todo appears at the top of the Todo List at once.

**Functional Requirements:**

#### FR-1: Create a Todo
The user can create a Todo by submitting a Description. Realizes UJ-1.

**Consequences (testable):**
- Submitting a valid Description adds exactly one Todo with Completion Status Active and a Created At set by the API.
- The new Todo is visible at the top of the Todo List within 100 ms of submission under Normal conditions. Whether the UI renders before or after API confirmation is an architecture choice; see `addendum.md` E.
- On success the input is cleared and keeps focus.
- Submission works by pressing Enter and by activating a visible submit control.

#### FR-2: Validate the Description
The system rejects an invalid Description on both client and server. Realizes UJ-1 edge case.

**Consequences (testable):**
- A Description that is empty or whitespace-only after trimming is rejected; no Todo is created; the input shows a visible, screen-reader-announced message.
- A Description longer than 500 characters is rejected with the same mechanism. `[ASSUMPTION: 500-character cap; see Open Question 2.]`
- The API returns HTTP 400 with the FR-10 error body for the same inputs, independent of the client.

### 4.2 Todo List View
**Description:** Opening the app shows the Todo List with no onboarding, sign-in or explanation. Active and Completed Todos are visually distinct at a glance. The list works on phone and desktop viewports.

**Functional Requirements:**

#### FR-3: Show the Todo List on load
The user sees all Todos on load, newest Created At first. Realizes UJ-1, UJ-2.

**Consequences (testable):**
- On load the app requests the Todo List from the API and renders every Todo returned. The list endpoint returns every Todo (no pagination).
- No onboarding screen, tour, modal, tooltip sequence or instructional copy appears on load. The only guidance text in the app is the Empty State message.
- Ordering is by Created At descending. `[ASSUMPTION: newest first, no user-controlled sort or filter in v1.]`
- Each Todo shows its Description and its Completion Status. Created At is stored and returned by the API but not displayed. `[ASSUMPTION: Created At not shown in v1 UI; see Open Question 5.]`

#### FR-4: Empty State
When there are zero Todos the user sees an Empty State, not a blank area.

**Consequences (testable):**
- With zero Todos the Todo List region shows a short, human-written message inviting the user to add the first Todo.
- The Empty State disappears as soon as one Todo exists and reappears when the last one is deleted.

#### FR-5: Loading State
While the initial read is in flight the user sees a Loading State.

**Consequences (testable):**
- A designed Loading State (skeleton or spinner inside the Todo List region) is shown until the first API response, success or failure, arrives.
- The Loading State never shows the Empty State message, so a slow load is not mistaken for "no tasks".

#### FR-6: Completed Todos are visually distinct
A Completed Todo is distinguishable from an Active one without reading its text. Realizes UJ-2.

**Consequences (testable):**
- Completed Todos use at least two visual cues (for example strike-through, reduced contrast and a checked control) so the distinction does not rely on colour alone.
- The Completion Status is exposed to assistive technology (checked state on the control).

#### FR-7: Responsive layout
The Todo List and input are usable on phone and desktop viewports.

**Consequences (testable):**
- At 360 px wide and at 1280 px wide, all controls are reachable without horizontal scrolling and touch targets are at least 44 x 44 px.
- Between 320 px and 1920 px wide no content is clipped or overlaps at any width, and text is readable on a phone without zooming.

### 4.3 Todo Completion
**Description:** The user marks a Todo as Completed or back to Active with one action on the Todo itself. The change shows at once and is persisted.

**Functional Requirements:**

#### FR-8: Toggle Completion Status
The user can switch a Todo between Active and Completed. Realizes UJ-2.

**Consequences (testable):**
- Activating the completion control flips the Completion Status and the visual state within 100 ms under Normal conditions.
- The change is persisted through the API; after a page refresh the Completion Status is unchanged.
- Toggling from Completed back to Active is allowed. `[ASSUMPTION: un-complete allowed; the source PRD only names completion. See Open Question 3.]`
- If the API call fails, the Todo shows its last persisted Completion Status and an Error State is shown.

### 4.4 Todo Deletion
**Description:** The user removes a Todo permanently with one action. Delete is immediate: no confirmation dialog and no undo in v1 (rationale in §8.2).

**Functional Requirements:**

#### FR-9: Delete a Todo
The user can delete a Todo regardless of its Completion Status. Realizes UJ-2.

**Consequences (testable):**
- Activating the delete control removes the Todo from the Todo List within 100 ms under Normal conditions.
- The deletion is persisted through the API; after a refresh the Todo is absent.
- If the API call fails, the Todo remains in its previous position and an Error State is shown.
- No confirmation step and no undo.

### 4.5 Persistence and API
**Description:** A small, well-defined HTTP API persists Todos so they survive refreshes, new sessions and service restarts. The API is the only path to the Persistence Store.

**Functional Requirements:**

#### FR-10: CRUD API for Todos
The frontend can list, create, update and delete Todos through the API.

**Consequences (testable):**
- Endpoints exist to list all Todos, create a Todo, update a Todo (Completion Status and Description) and delete a Todo by ID. `[ASSUMPTION: API-level Description update keeps the brief's "all CRUD operations" literal; see Open Question 4.]`
- Every Todo returned carries ID, Description, Completion Status and Created At.
- Error responses are JSON with a stable `code` and a human-readable `message`. A non-existent ID returns HTTP 404; malformed JSON or invalid fields return HTTP 400. The API never returns a 500 for user input.
- The API contract (paths, verbs, payloads, error codes) is documented in the repository and kept in sync with the integration tests. Exact shape is an architecture decision.

#### FR-11: Durable persistence
Todos survive page refreshes, new browser sessions and API restarts. Realizes UJ-2.

**Consequences (testable):**
- After creating, toggling and deleting Todos, restarting the API process and reloading the page shows the same Todo List. Restart semantics depend on the persistence choice in Open Question 1.
- The frontend issues at most one in-flight write per Todo; a further action on the same Todo waits for the pending write to settle. Scope: one client, sequential UI actions. `[ASSUMPTION: single in-flight write per Todo as the consistency mechanism.]`
- Last write wins across tabs or devices on the same deployment. A stale tab shows the latest Todo List after refresh. No live sync in v1.

#### FR-12: Extensible toward multi-user *(architecture constraint)*
The data model and API shape do not prevent adding user ownership and authentication later.

**Consequences:**
- The Todo record and API are designed so that a per-user owner can be added without changing existing endpoint semantics for the single-user case. Verified by architecture review, not by an automated test; the story author should not derive a runnable acceptance criterion from this FR.
- No business logic assumes exactly one list exists.

#### FR-13: Health Endpoint *(brief)*
Operators can check service health.

**Consequences (testable):**
- The Health Endpoint returns HTTP 200 when the API can reach the Persistence Store and a non-200 status otherwise.
- Both the frontend and backend containers expose a health signal that the container orchestrator uses to report container health.

### 4.6 Feedback and Error Handling
**Description:** Every action gives immediate visual feedback, and every failure is shown without dropping the user's work.

**Functional Requirements:**

#### FR-14: Error State on failure
When an API call fails the user sees what failed and can recover. Realizes UJ-3.

**Consequences (testable):**
- A failed list load shows an Error State with a retry control in place of the Todo List; activating the control re-issues the load.
- A failed create, toggle or delete shows an Error State as a non-blocking, human-readable message naming the failed action; the Todo List shows its last persisted state; the user can repeat the action.
- Error messages are announced to assistive technology.
- No raw error strings, stack traces or HTTP status codes are shown to the user.

#### FR-15: Never lose typed input
A failed create leaves the Description in the input. Realizes UJ-3.

**Consequences (testable):**
- After a failed create, the input contains the submitted Description unchanged and retains focus.

## 5. Cross-Cutting NFRs

Entries marked *(brief)* originate in the training brief rather than the product and are graded; see §6.

- **Simplicity.** One screen, one input, every action one tap or click from the Todo List. Smallest dependency set that meets the FRs; no framework, service or abstraction without a requirement behind it. Prefer boring, well-known technology.
- **Product completeness.** No placeholder copy, no unstyled browser defaults, page title set, consistent spacing and typography, no layout shift on load. Empty, Loading and Error States are designed states with human-readable copy.
- **Performance.** Initial Todo List render completes within 1 s under Normal conditions with up to 200 Todos. User actions are reflected in the UI within 100 ms under Normal conditions. Lighthouse performance score of at least 90 on the mobile preset. `[ASSUMPTION: 90 as the mobile score bar.]` Performance findings are documented in a performance report *(brief)*.
- **Accessibility** *(brief)*. Zero critical WCAG AA violations as measured by an automated audit. `[ASSUMPTION: WCAG 2.1 as the version; the brief names no version.]` Full keyboard operation of create, toggle and delete. Visible focus. Completion Status and errors exposed to screen readers.
- **Security** *(brief)*. All Description content is treated as untrusted: rendered as text, never as HTML. Server-side validation on every write. No stored or reflected XSS, no injection into the Persistence Store. Findings from a security review are documented with remediations.
- **Reliability.** Persistence Store writes are durable before the API reports success. The API never crashes on malformed input.
- **Maintainability** *(brief)*.
  - Minimum 70% meaningful code coverage, measured per package so frontend and backend each meet it. `[ASSUMPTION: per-package measurement; the brief does not say combined or per package.]`
  - Tests at four levels: unit, frontend component, integration (every API endpoint) and end-to-end. E2E covers every user journey defined in the stories, including at minimum create, complete, delete, Empty State and error handling.
  - A new developer can run the full app and all tests from the README alone, and the README explains the codebase layout.
  - The architecture document records only the decisions actually made.
- **Deployability** *(brief)*.
  - The full stack starts with one compose command and both containers report healthy.
  - Logs from every container are readable through the orchestrator; the API logs method, path, status and duration per request.
  - Dev and test configurations differ only by environment variables and compose profiles.
- **Browser support.** E2E and accessibility audits run on current Chromium. The app must not break in current Firefox or Safari. `[ASSUMPTION: Chromium as the audited engine.]`

## 6. Delivery Constraints

This v1 is graded against the training pathway's success criteria, quoted from the brief. They are set by the pathway, not by the team, and count as acceptance for the project as a whole.

| Criterion (brief wording) | Target |
|---|---|
| Working Application | "Todo app fully functional with all CRUD operations" |
| Test Coverage | "Minimum 70% meaningful code coverage" |
| E2E Tests | "Minimum 5 passing Playwright tests" |
| Docker Deployment | "Application runs successfully via docker-compose up" |
| Accessibility | "Zero critical WCAG violations" |
| Documentation | "README with setup instructions, AI integration log" |
| Phase 1-2 Deliverables | "All activities completed with documented learnings" (pathway prerequisite, owned by the learner) |

Graded deliverables beyond the table: architecture docs, stories with acceptance criteria, QA reports (coverage, accessibility, security review) and documentation of how BMAD guided the implementation. Two pathway artefacts sit outside this PRD's scope: the project brief (separate, still to be produced) and a framework comparison whose expectations the brief does not spell out. Detail and tooling in `addendum.md` B to D.

## 7. Non-Goals (Explicit)

- Not a multi-user product. No accounts, sign-in, sessions or per-person lists. Not for teams or households sharing one list.
- Not a collaboration tool. No sharing, assignment or comments.
- Not a planner. No due dates, reminders, notifications, recurring tasks, priorities, tags or projects.
- Not a note-taking app. Description is a short line, not rich text or attachments.
- Not an offline-first app. If the API is unreachable, the app shows an Error State; it does not queue writes.
- Not a native mobile app. Responsive web only.

## 8. MVP Scope

### 8.1 In Scope
- Create, list, toggle and delete Todos (FR-1 to FR-9).
- Empty, Loading and Error States (FR-4, FR-5, FR-14, FR-15).
- Responsive web UI for phone and desktop (FR-7).
- HTTP API with full CRUD, durable Persistence Store and Health Endpoint (FR-10 to FR-13).
- Unit, component, integration and E2E test suites; containerised deployment; accessibility and security review (§5, §6).

### 8.2 Out of Scope for MVP
- Editing a Todo's Description in the UI (the API supports it, FR-10; see Open Question 4). `[ASSUMPTION: UI edit not among the four core actions in the source PRD.]`
- Filtering or sorting the Todo List (all / active / completed). Deferred to v2.
- Undo after delete, or a delete confirmation. Deferred: both add UI and application state that the source PRD's minimalism argues against, and the cost of an accidental delete of a one-line Todo is low. Revisit only if accidental deletes are observed.
- "Clear completed", bulk delete, archive. Deferred to v2.
- Pagination. The list endpoint returns every Todo; §5 bounds performance at 200.
- Displaying Created At. See Open Question 5.
- Everything in §7.

## 9. Success Metrics

**Primary**
- **SM-1: Unguided completion and clarity.** A person who has not seen the app performs create, toggle Completion Status both ways, and delete without instruction, and does not ask what any control does. Target: at least one recorded unguided walkthrough in the QA report with zero prompts needed, plus an E2E suite written to drive the app the way an unguided user would. Validates FR-1, FR-3, FR-8, FR-9.
- **SM-2: Zero data loss across sessions.** After any sequence of actions, refresh and API restart show the identical Todo List. Target: 100% of E2E and integration runs. Validates FR-11.
- **SM-3: Quality gates pass.** All graded gates in the §6 table (coverage, E2E count, WCAG, container health) green in CI on the final commit. Validates §5, §6.

**Secondary**
- **SM-4: Perceived immediacy.** Every user action is reflected in the UI within 100 ms under Normal conditions. Measured in E2E against the local stack; timing assertions use a generous upper bound to avoid flakiness and are backed by one manual check. Validates FR-1, FR-8, FR-9.
- **SM-5: Graceful failure.** With the API stopped, every action produces an Error State and the typed Description is not lost. Target: covered by at least one E2E test. Validates FR-14, FR-15.

**Counter-metrics (do not optimize)**
- **SM-C1: Feature count.** Adding capabilities beyond §8.1 is a regression against the thesis in §1, not progress. Counterbalances SM-1.
- **SM-C2: Line coverage for its own sake.** Coverage earned by asserting nothing does not count toward SM-3. Reviewers judge "meaningful" by whether tests would fail on a real regression. Counterbalances SM-3.

## 10. Open Questions

1. **Persistence technology.** File-backed, SQLite or a separate database container? Affects compose topology and FR-11 restart semantics. Owner: Architect. Decide in architecture.
2. **Description cap.** 500 characters is a placeholder. Confirm or change before FR-2 tests are written. Owner: product owner.
3. **Toggle back to Active.** Confirm that toggling Completed back to Active is wanted (FR-8). Owner: product owner.
4. **Edit Description.** The brief grades "all CRUD operations". This PRD keeps CRUD literal at the API (FR-10) and leaves UI editing out of v1 (§8.2). Confirm this reading satisfies the grader, or pull UI edit into v1. Owner: product owner, with course staff if unsure.
5. **Show Created At.** The source PRD lists creation time as part of a Todo. Confirm it stays hidden in v1 or show it as a relative time. No other metadata is planned. Owner: product owner.

## 11. Assumptions Index

- §2.2 — single shared Persistence Store behind one deployment; no per-user identity.
- §3, FR-2 — Description capped at 500 characters.
- FR-3 — Todo List ordered newest Created At first; no sort or filter controls.
- FR-3 — Created At stored and returned but not displayed in v1.
- FR-8 — toggling Completed back to Active is allowed.
- FR-10, §8.2 — API accepts Description updates; UI editing out of v1.
- FR-11 — single in-flight write per Todo as the consistency mechanism.
- §5 Performance — Lighthouse mobile performance score of 90 as the bar.
- §5 Accessibility — WCAG 2.1 as the audited version.
- §5 Maintainability — coverage measured per package.
- §5 Browser support — Chromium as the audited engine.
