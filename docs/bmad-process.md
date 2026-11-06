# How BMAD guided the build

The project followed BMAD's spec-driven path: each stage produced a document, and the next stage
was built from that document rather than from the conversation that made it.

## Artefacts and what each one decided

| Stage        | Artefact                                                                                                                                                                            | What it fixed                                                                                                                                                                                                                                                                                                             |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Requirements | [PRD](../_bmad-output/planning-artifacts/prds/prd-bmad-method-2026-10-26/prd.md) and its [addendum](../_bmad-output/planning-artifacts/prds/prd-bmad-method-2026-10-26/addendum.md) | The user journeys (UJ-1 to UJ-3), the functional and non-functional requirements, and the success measures. Open questions, such as the 500-character description limit, were written down instead of guessed.                                                                                                            |
| Architecture | [Architecture spine](../_bmad-output/planning-artifacts/architecture/architecture-bmad-method-2026-10-26/ARCHITECTURE-SPINE.md)                                                     | Numbered decisions (AD-1 to AD-13) that every story cites: one contract package, API envelope and error codes, SQLite durability, validation in the service, one list state with no optimistic updates, one `role="status"` region, container and E2E rules. Readable companion: [docs/architecture.md](architecture.md). |
| Planning     | [Epics and stories](../_bmad-output/planning-artifacts/epics.md)                                                                                                                    | Three epics (a running app, capture and clear Todos, prove it) and 16 stories, each with Given/When/Then criteria and the test levels it owes.                                                                                                                                                                            |
| Tracking     | [Sprint status](../_bmad-output/implementation-artifacts/sprint-status.yaml)                                                                                                        | One status per story from `backlog` to `done`.                                                                                                                                                                                                                                                                            |
| Build        | Per-story specs in `_bmad-output/implementation-artifacts/`                                                                                                                         | A frozen intent, an I/O matrix, a code map and tasks for each story, so an implementer could start from the spec alone.                                                                                                                                                                                                   |

## How the specs steered the code

- **Decisions were cited, not re-argued.** A story spec says "AD-7: at most one in-flight write per
  Todo" and the code and tests follow it; the pending guard in `useTodos` and the disabled
  controls come straight from that line.
- **The I/O matrix became the test list.** Each row of a spec's matrix is a test (for example the
  PATCH rows became the unit, integration and component cases for Story 2.3).
- **Boundaries stopped scope creep.** "Never" lists such as "no optimistic update, no retry control
  for a failed toggle" kept stories small, and deferred items went to
  [deferred-work.md](../_bmad-output/implementation-artifacts/deferred-work.md) instead of being
  built.
- **Reviews fed back into the spec.** Stories 1.x and 2.2 ran blind, edge-case and verification
  reviews; their findings, with a verdict for each, are in the spec's triage log and the
  [AI integration log](ai-integration-log.md).
- **Stories 2.3 to 3.5 were built unattended** at the owner's request, without the review step, and
  the log says so for each story.

## Where BMAD did not carry the work

- The planning documents did not foresee that Story 2.2's E2E helpers would collide with Story
  1.5's; they were merged by hand.
- A keyboard defect (focus lost on a disabled control) was found by an E2E test written for the
  acceptance criteria, not by any document.
- QA tooling choices (axe, Lighthouse CLI) were left to the QA stories by design.

## Framework comparison

The course material lists a "Framework Comparison" heading with no content in `CONTEXT.md`.
Whether a written comparison is expected is **unresolved**; it needs confirming with course staff.
This repository does not claim one.

## Deliverables not held in this repository

The project brief is a separate deliverable recorded as pending; it is not claimed here. This
repository holds the PRD and addendum, architecture, epics, the application, tests, containers and
the QA reports.
