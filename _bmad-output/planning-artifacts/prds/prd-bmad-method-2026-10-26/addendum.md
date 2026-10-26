# Addendum: Todo App PRD

Supporting material that belongs downstream of the PRD (architecture, test strategy, delivery) or did not earn a place in the PRD's main narrative. Sourced from `/CONTEXT.md` (training brief) and `/PRD.md` (the course's prose PRD). Learner support channel: `#aine-training-support` on Slack.

## A. Pathway process (Architect, Developer, story author)

The brief prescribes the BMAD sequence for this project:

1. PM persona refines the PRD and produces a detailed project brief.
2. Architect persona defines technical architecture, API contracts and component structure.
3. Stories broken down with acceptance criteria.
4. Test strategy defined per story: unit, integration and E2E scenarios inside the story definitions.
5. Project setup first: create the frontend, backend and test directory structure and wire up test infrastructure immediately, before any feature work.
6. Build with QA integrated from day one, then containerise, then run QA activities.
7. Share whatever is built; that is the next step of the pathway.

Status: step 1 is half done (this PRD); the project brief is a separate graded deliverable, not yet produced.

The brief expects AI agents to do the implementation work themselves (endpoints, validation, components, state management, Dockerfiles, tests, coverage analysis, security review), with humans directing and reviewing. The AI integration log (section D) records how that went.

## B. Test and QA tooling (Architect, Developer, QA)

| Activity | Tool | Required outcome | When |
|---|---|---|---|
| Unit and component tests | Jest or Vitest, commands in `package.json` | Component tests written as components are built | During build |
| E2E tests | Playwright, Playwright MCP for browser automation | Every user journey in the stories; at minimum create, complete, delete, empty state, error handling. Graded: minimum 5 passing tests | During build |
| API contract validation | Postman MCP or similar | Each endpoint validated as it is built | During backend build |
| Coverage analysis | AI-assisted gap analysis | Minimum 70% meaningful coverage | After build |
| Performance | Chrome DevTools MCP | Issues documented in a performance report | After build |
| Accessibility | Lighthouse or axe-core, automatable through Playwright | WCAG AA, zero critical violations | After build |
| Security review | AI-assisted review for XSS, injection and similar | Findings and remediations documented | After build |

Inference, not stated in the brief: Jest/Vitest and `package.json` pull toward a Node/TypeScript stack on both sides; a non-Node backend is not excluded.

## C. Containers (DevOps)

- Dockerfiles for frontend and backend: multi-stage builds, non-root users, health checks on both.
- `docker-compose.yml` orchestrating app and database (if one is used), with networking, volumes and environment configuration.
- Dev and test environments through environment variables and compose profiles.
- Logs accessible via `docker-compose logs`.

## D. Graded deliverables (all roles)

- Phase 1-2 deliverables: all pathway activities completed with documented learnings (prerequisite owned by the learner, outside this project).
- BMAD artefacts: project brief, architecture docs, stories with acceptance criteria.
- Working Todo application (frontend plus backend, or CLI; this PRD commits to frontend plus backend).
- Unit, integration and E2E suites.
- Dockerfiles and `docker-compose.yml`; app runs with `docker-compose up`.
- QA reports: coverage, accessibility, security review.
- Documentation of how BMAD guided the implementation.
- README with setup instructions.
- AI integration log, maintained throughout, covering:
  - agent usage and prompts that worked
  - MCP servers used and how they helped
  - AI-generated tests and what they missed
  - AI-assisted debugging cases
  - limitations met and where human expertise was critical
- Framework comparison (heading present in the brief, body not supplied; confirm expectations with course staff).

## E. Design rationale (Architect)

- **Todo App kept:** the brief allows a different application if the methodology is followed; this PRD keeps the Todo App.
- **Multi-user left open (FR-12; origin "architecture should not prevent" auth and multi-user):** give Todos a stable ID, keep the Todo record open to an owner field, keep list and write endpoints free of single-list assumptions, and version or namespace the API path.
- **100 ms UI feedback bound (origin "interactions should feel instantaneous under normal conditions"):** optimistic rendering with rollback was considered and rejected as a requirement. A confirmed render meets the bound on a local or containerised stack, and rollback logic is the complexity the source PRD warns against. The Architect may still choose it; failed writes must then revert to the last persisted state (FR-8, FR-9, FR-14).
- **Immediate delete (FR-9):** chosen over an undo toast or a confirm dialog for the same reason: minimalism. Revisit if accidental deletes show up in use.
- **Single in-flight write per Todo (FR-11):** the simplest mechanism that makes "data consistency" testable without request versioning or queues.
- **README-only onboarding and boring technology (§5 Simplicity; origin "easy to understand, deploy, and extend by future developers.").**
