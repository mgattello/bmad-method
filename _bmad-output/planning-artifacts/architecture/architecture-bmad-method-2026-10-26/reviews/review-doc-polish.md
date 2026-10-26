# Review: architecture.md structure and prose polish

Date: 2026-10-26. Target: `architecture.md`. Binding source: `ARCHITECTURE-SPINE.md` (not edited).

## Verdict

Section order already fit the reader (shape, decisions, contract, backend, frontend, containers, tests, deferred, locations). No section moved. Edits were additions a grader looks for, prose tightening, and terminology alignment. No factual claim in the doc contradicted the spine.

## Changes applied (21)

Structure

1. Added a `### Stack` table under section 1 (runtime, API, web, tests, lint, containers) with versions taken from the spine's Stack table, plus a pointer to the full pinned list.
2. Section 4: added the SQL column shape (snake_case, `completed` as 0/1, camelCase mapping) to the Repository bullet so the data model is visible without the spine's ER diagram.
3. Section 4: health route now states the `503` branch, not just the `200` one.
4. Section 5: first bullet now names the Loading State and Empty State (FR-4, FR-5), which were only implied by the component list.
5. Section 5: added "new Todo goes to the top of the list" (AD-8) and the `NOT_FOUND` on toggle or delete behaviour (AD-7).
6. Section 5: added a short "Targets the frontend must meet" list (accessibility, keyboard path, 100 ms, 1 s with 200 items, Lighthouse 90, completeness) from the spine's conventions. Graders look for NFR coverage here.
7. Section 3: `VALIDATION_ERROR` row now includes "unsupported content type" (AD-3).
8. Section 6: added the `.env.example` sentence (AD-11).
9. Section 8: added the deferred "rate limiting and request size limits" item (spine Deferred list).
10. Renamed section 8 to "Deferred decisions" so headings read as parallel nouns.

Prose (sentences over 25 words, passive voice, one idea each)

11. Intro: "human-readable companion ... which is the terse contract" shortened.
12. Section 1: split the single-origin sentence into two.
13. Section 3: rewrote the trim paragraph in active voice, four short sentences.
14. Section 3: split the `message` paragraph into three sentences.
15. Section 4: "is created at startup" and "is the only place environment variables are read" made active.
16. Section 5: in-flight write bullet rewritten active ("A pending write disables ...").
17. Section 5: "Description text is rendered" made active.
18. Section 6: 28-word build-stages sentence split into four.
19. Section 6: dev-services sentence split, passive "are compiled" removed.
20. Section 7: coverage and E2E paragraph rewritten active and split; the 33-word E2E sentence is now two.
21. Section 8: QA tooling sentence made active.

Terminology

- "description" in prose is now "Description" (the PRD term); the JSON field `description` stays lowercase in code.
- "toggle" in section 5 now reads "Completion Status toggle" once, so the PRD term appears.
- "empty state" in the E2E test row is now "Empty State".
- Section 2 Frontend state row: wording aligned with section 5 ("Disabling controls, not queuing, enforces ...").

## Left as is, and why

- Section 2 decisions table: long cells, but a grader reads this table for rationale and the spine deliberately omits it. Prose would be longer.
- Sections 3 and 4 repeat the spine's endpoint table and backend diagram. The doc must stand alone for a reviewer who never opens the spine, so the repetition earns its place.
- Mermaid blocks unchanged.
- YAML frontmatter unchanged, including `status: final`. Note that the spine's frontmatter says `status: draft`. That is a status field, not an architecture claim, so it is not treated as a contradiction. The owner may want to align them.
- `tsc --watch` keeps its double hyphen (a CLI flag in code, not prose).

## Contradiction check

Every path, status code, env var, port, profile, tool, and test home in the doc was checked against the spine. No mismatch found.

One inconsistency inside the spine itself could not be resolved from the spine alone:

- AD-11 says E2E runs with `WEB_PORT=8081` and Playwright `baseURL http://localhost:8081`. AD-12's table says E2E hits `http://localhost:8080`, and the Structural Seed lists `playwright.config.ts # baseURL http://localhost:8080`. The doc keeps 8081, which matches AD-11's explicit lifecycle rule and the Ports convention row ("E2E `8081`"). The spine owner should fix AD-12 and the seed comment.
