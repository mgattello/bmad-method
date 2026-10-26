# Reconcile: CONTEXT.md vs prd.md / addendum.md

Input: `/CONTEXT.md` (training brief, "Todo App Implementation with BMAD"). Compared against `prd.md` and `addendum.md` in this folder. Tooling and process detail living in `addendum.md` rather than `prd.md` is by design and is not treated as a gap.

## Covered

- Goal of a complete, well-tested, deployable app via spec-driven development: prd.md §1 (second purpose), §2.1 builder's job.
- Why BMAD / persona sequence (PM, Architect, stories, test strategy in stories, QA from day one, containerise, QA activities): addendum A.
- Alternate app allowed, Slack support channel: addendum E.
- Jest/Vitest, package.json test commands, Playwright, Postman MCP, Chrome DevTools MCP, Playwright MCP, Lighthouse/axe-core: addendum B.
- Backend CRUD API with validation and error handling: prd.md FR-2, FR-10. Integration tests per endpoint: prd.md §5 Maintainability.
- E2E scenarios create, complete, delete, empty state, error handling: prd.md §6, addendum B.
- Dockerfiles (multi-stage, non-root, health checks), compose with networking/volumes/env, dev/test via env vars and profiles, logs via `docker-compose logs`: addendum B; prd.md §5 Deployability, FR-13.
- QA activities (coverage 70% meaningful with AI gap analysis, performance with issues documented, accessibility WCAG AA, security review for XSS/injection with remediations): addendum C; prd.md §5.
- Deliverables list and AI integration log (all five log topics): addendum D.
- Success criteria: working app, 70% coverage, 5 E2E tests, compose up, zero critical WCAG, README + AI log: prd.md §6, SM-3. Framework Comparison heading noted: addendum D.

## Gaps

| # | What CONTEXT.md requires | Where in CONTEXT.md | Where it should land |
|---|---|---|---|
| G1 | A **detailed project brief** as a distinct artefact alongside the refined PRD. It is also the first graded BMAD deliverable. Neither document treats it as outstanding work. | Step 1 "Project Brief & PRD Refinement"; Deliverables bullet 1 | addendum A.1 (state the brief is still to be produced); prd.md §6 Process artefacts row |
| G2 | **"Documentation of how BMAD guided the implementation"** is a graded deliverable. Present in addendum D but absent from the prd.md §6 acceptance table, which claims to list what the project is graded against. | Deliverables bullet 6 | prd.md §6 (Documentation or Process artefacts row) |
| G3 | Success criterion **"Phase 1-2 Deliverables: all activities completed with documented learnings"**. Not captured anywhere. Outside this app's scope but part of the pathway grading the PRD cites. | Success Criteria table, row 1 | addendum D (note as pathway prerequisite, owned by the learner, not the project) |
| G4 | Working application must be **"fully functional with all CRUD operations"**. prd.md restates this as "four core actions (create, view, complete, delete)" and limits Update to completion toggle (FR-10), with edit Description out of scope (§8.2). A grader reading "CRUD" literally may expect Description editing. Not surfaced as a risk. | Success Criteria "Working Application" | prd.md §6 (quote the criterion verbatim) and §10 Open Question 5 (tie edit-Description decision to the CRUD criterion) |
| G5 | **Frontend component tests written as components are built.** prd.md §5 names unit, integration (API) and E2E; addendum B names Jest/Vitest for unit tests only. Component-level tests for the UI are not named. | Step 2, Component: Frontend, QA Integration | prd.md §5 Maintainability (test levels) or addendum B |
| G6 | E2E tests must cover **all user journeys defined in stories**, not only the five named scenarios. prd.md §6 and addendum B list only the five. | Step 2, Component: E2E Tests, Implementation Task | addendum B (E2E tests line); optionally prd.md §5 Maintainability |
| G7 | **Project setup**: create a structure for frontend, backend and tests; set up test infrastructure **immediately**, before feature work. Addendum A.5 says "QA integrated from day one" but the setup-first ordering and the three-part structure are not stated. | Step 2, Component: Project Setup | addendum A or B |
| G8 | **AI agents are expected to do the implementation** (generate endpoints, components, state management, Dockerfiles, tests, coverage analysis, security review). The documents capture the AI log but not the expectation that build work itself is AI-driven. | Step 2 intro; Backend, Frontend, Dockerfiles, Step 4 tasks | addendum A (process) |
| G9 | Whichever project is built must be **shared in the next step** of the pathway. | Intro paragraph 4 | addendum E |
| G10 | **Developers** are one of the three converging roles. prd.md §0 lists Architect, story author, QA engineer, DevOps engineer as audience and omits the developer. | Intro paragraph 2 | prd.md §0 |
| G11 | **Both frontend and backend Dockerfiles carry health checks**, so the frontend container needs a health signal too. Addendum B says so; prd.md FR-13 defines a Health Endpoint for the API only, and §5 Deployability says "reports healthy" without naming the frontend. | Step 3, Task: Dockerfiles; Task: Health Checks | prd.md FR-13 (or §5 Deployability) |
| G12 | **Performance findings must be documented.** Addendum C covers it, but prd.md §5 Performance gives targets with no mention of a performance report, while §5 Security does require documented findings. Minor inconsistency inside prd.md. | Step 4, QA Task: Performance Testing | prd.md §5 Performance (one clause) |

## Misstatements

| # | Where | What it says | What CONTEXT.md says |
|---|---|---|---|
| M1 | addendum A.1 | "PM persona refines the PRD and produces a project brief (this PRD is the output of that step)" | Step 1 asks for a refined PRD **and** a detailed project brief; the brief is a separate graded deliverable. The PRD does not satisfy it. |
| M2 | prd.md §6 "Process artefacts" row | "PRD, architecture document, stories with acceptance criteria, QA reports", presented as one of "the training pathway's success criteria" | The Success Criteria table has no such row. The row is lifted from the Deliverables list, which names **project brief** (not PRD), architecture docs, stories with AC, QA reports, and **documentation of how BMAD guided the implementation**. The row swaps brief for PRD and drops the BMAD-guidance doc. |
| M3 | prd.md §6 "Working application" row; FR-10 | "All four core actions (create, view, complete, delete)"; API update limited to Completion Status | "Todo app fully functional with **all CRUD operations**". The narrowing of Update to a completion toggle is an interpretation and is not tagged `[ASSUMPTION]`. |
| M4 | prd.md §5 Accessibility | "WCAG **2.1** AA" | CONTEXT.md says "WCAG AA" and "zero critical WCAG violations" with no version. The version is an untagged inference. |
| M5 | prd.md §5 Maintainability | "70% meaningful code coverage **across frontend and backend**" | CONTEXT.md says "minimum 70% meaningful code coverage" without saying combined or per package. The scoping is an untagged inference; a grader may measure each package. |
| M6 | addendum B, unit tests line | "Implies a Node/TypeScript stack for at least the frontend; **backend stack is open**" | CONTEXT.md names Jest/Vitest for unit tests and package.json test commands without scoping them to the frontend. A non-Node backend is not excluded, but "open" understates the pull toward Node on both sides. Soft inference, worth labelling as such. |
| M7 | prd.md §6 intro | "These are fixed, not negotiable by the team" | CONTEXT.md does not say this. Reasonable editorial framing, but it is the PRD's claim, not the brief's. |
| M8 | prd.md §6 "End-to-end tests" row | "Minimum 5 passing browser E2E tests covering create, complete, delete, Empty State, error handling" | The success criterion is "Minimum 5 passing Playwright tests" alone; the five scenarios come from Step 2 and are a build task, not part of the graded criterion. Merging them is fine but should not be presented as the verbatim criterion. |
