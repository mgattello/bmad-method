# Reconciliation: `/PRD.md` (course prose PRD) vs draft `prd.md`

Input: `/PRD.md`, seven paragraphs of prose. Checked sentence by sentence against `prd.md` and `addendum.md`.

## Covered

- Four core actions (create, view, complete, delete): FR-1, FR-3, FR-8, FR-9.
- Todo shape (description, completion status, creation time): Glossary §3, FR-10.
- List visible on open, no sign-in: FR-3, §4.2 description, UJ-1.
- Instant updates / "feel instantaneous under normal conditions": 100 ms bound in FR-1/8/9, §5 Performance, SM-4, addendum F.
- Completed visually distinct at a glance: FR-6.
- Desktop and mobile: FR-7.
- Empty, loading, error states: FR-4, FR-5, FR-14.
- Small API, basic CRUD, durable across sessions: FR-10, FR-11, §5 Reliability.
- Auth and multi-user deferred but not blocked: FR-12, §7, addendum F.
- Performance and maintainability NFRs: §5.
- Client and server error handling without disrupting flow: FR-14, FR-15, FR-10 (400/404, no 500 on input), §5 Reliability.
- Explicit v1 exclusions (accounts, collaboration, priority, deadlines, notifications): §7.
- Success: unguided completion (SM-1), stability across refresh and sessions (SM-2).
- Minimalism as a stance: §1 Vision, SM-C1 counter-metric.

## Gaps

Qualitative expectations are where the FR structure loses the most. Several words the original repeats ("clarity" x3, "intuitive", "polished", "clean", "simplicity", "complete") do not appear in the draft at all.

### G1. "feel like a complete, usable product despite its deliberately minimal scope"
- Draft: absent. Nothing states that v1 must read as finished rather than as a demo or scaffold.
- Land in: §1 Vision (closing sentence) and a new §5 NFR "Product completeness" (no placeholder copy, no unstyled defaults, page title and favicon set, consistent spacing/typography, no layout shift on load). Optionally a secondary SM: usability-session participants describe it as "done", not "a prototype".

### G2. "to maintain a polished user experience" / "clean and reliable core experience"
- Draft: the states exist (FR-4/5/14) but the quality bar on them is unstated. "Polished" and "clean" appear nowhere.
- Land in: §4.6 or §5 as a design-quality NFR; also a line in each of FR-4/5/14 that the state is designed, not a raw string (e.g. Loading State is a skeleton or spinner within the list region, Error State copy is human-readable).

### G3. "the clarity of the overall user experience" (a named success criterion)
- Draft: only SM-1 (task completion without guidance), which is a proxy for usability, not clarity. The original lists clarity as a third, separate measure.
- Land in: §9 as SM-6 "Clarity", e.g. in the usability session no participant asks what a control does, and every visible string is understood without explanation; or fold into SM-1 as an explicit observation criterion.

### G4. "clear, reliable, and intuitive" / "focus on clarity and ease of use"
- Draft: §1 says "obviously-usable" and "nothing in the way", which carries the spirit, but the words are not carried into any testable place.
- Land in: §1 Vision keep the original adjectives verbatim; §5 add a UX NFR: one screen, one input, no hidden controls, every action one tap/click from the list.

### G5. "prioritize simplicity, performance, and maintainability" (three named NFR priorities)
- Draft: §5 has Performance and Maintainability but no Simplicity entry. Addendum F mentions a "boring-technology preference" but only as a note to the Architect, outside the PRD.
- Land in: §5 new NFR "Simplicity": smallest dependency set that meets the FRs, no framework or abstraction without a requirement behind it, one service per concern. Move the boring-technology line from addendum F into it.

### G6. "easy to understand, deploy, and extend by future developers"
- Draft: "deploy" lands in Deployability, "extend" partially in FR-12. "Understand" is reduced to "run from the README alone", which is about running, not understanding.
- Land in: §5 Maintainability add: codebase layout explained in README, no file a new developer cannot place in under a minute, architecture doc kept to the decisions actually made.

### G7. "interact with it without any onboarding or explanation"
- Draft: stated in §4.2 description prose and UJ-1, but no FR consequence makes it testable. SM-1 measures outcome, not the absence of onboarding UI.
- Land in: FR-3 consequence: no onboarding screen, tour, modal, tooltip sequence or instructional copy on load; the only guidance text allowed is the Empty State message.

### G8. "a small, well-defined API"
- Draft: "small" survives in §4.5; "well-defined" does not. FR-10 defers paths and payloads to architecture with no requirement that the contract be written down.
- Land in: FR-10 consequence: API contract documented (OpenAPI or a README section) and kept in sync with integration tests; or §5 Maintainability.

### G9. "should include ... basic metadata such as creation time"
- Draft: Created At is stored and returned but `[ASSUMPTION: Created At not shown in v1 UI]` (FR-3). The original lists creation time alongside description and status as what a todo "should include", which reads as user-facing, and "such as" leaves metadata open.
- Land in: Open Question 6 for the PO: show Created At (relative time is enough) or confirm hidden. Keep "such as" open by noting no other metadata is planned.

### G10. "support basic CRUD operations"
- Draft: FR-10 narrows Update to "update a Todo's Completion Status" and §8.2 defers editing the Description. The original says CRUD at the API level without restricting the U.
- Land in: Open Question 5 already covers UI edit; add the API angle: does the update endpoint accept Description (cheap, keeps CRUD literal, helps FR-12) even if the UI does not expose it in v1? PO decision; note the minimalism trade-off.

### G11. "work well across desktop and mobile devices"
- Draft: FR-7 tests 360 px and 1280 px for reachability and touch targets only. "Work well" is a quality statement, and intermediate widths (tablet, split screen) are untested.
- Land in: FR-7 consequence: layout has no breakpoint at which content is clipped or overlaps between 320 px and 1920 px; text remains readable without zoom on phone.

### G12. "data consistency ... across user sessions"
- Draft: covered for durability. "Consistency" across two open tabs or two devices on the same deployment is not addressed (UJ-2 moves phone to laptop but only sequentially).
- Land in: FR-11 note: last write wins; a stale tab shows the latest list after refresh; no live sync in v1. State it so it is a decision rather than an omission.

## Contradictions / scope creep

The original argues for minimalism in three places (avoid unnecessary features or complexity; prioritize simplicity; remain focused on a clean core). The draft honours this in §1, §7 and SM-C1 but undercuts it in the following places.

### C1. Optimistic UI is forced by the 100 ms "before the API response arrives" bound
- FR-1 consequence 2, FR-8, FR-9, UJ-3 and SM-4 require the UI to update before the API confirms, with rollback on failure. The original asks only that interactions "feel instantaneous under normal conditions". On a local or containerised deployment a plain await-then-render meets that without rollback logic, and rollback is exactly the "unnecessary complexity" the original warns against. The draft tags it `[ASSUMPTION]` but then bakes it into four FRs and a metric.
- Suggest: restate the bound as "visible within 100 ms under normal conditions (local deployment)" and leave optimistic vs confirmed rendering to the Architect. Keep FR-15 (never lose typed input) either way.

### C2. `[NOTE FOR PM: cheap to add and commonly expected; revisit if the team finishes early]` on Description editing (§8.2)
- This invites feature growth that SM-C1 in the same document calls a regression, and that the original explicitly avoids. Either keep edit out of v1 and drop the nudge, or resolve it through Open Question 5. Not both.

### C3. Open Question 2 opens the door to undo toasts or confirm dialogs
- Both options add UI and state the original does not ask for. The minimal answer (immediate delete) is already the draft's default. Suggest recording the minimalism argument in the question so the PO decides with it in view, and listing undo/confirm under §8.2 deferred rather than as a live option.

### C4. SM-1 requires an observed usability session with 5 test users
- The original says success is "the ability of a user to complete all core actions without guidance", not a moderated study. Five participants is process scope the training brief does not ask for and the team may not have. Suggest: 1 to 2 unguided walkthroughs recorded in the QA report, or an E2E test suite written as an unguided user would act, plus one human run.

### C5. FR-11 concurrency consequence ("rapid toggles never leave a Todo in a state other than the last request's intended state")
- Adds an ordering guarantee the original does not request. Defensible under "data consistency", but it can push the Architect toward request queuing or versioning. Suggest keep it but mark it `[ASSUMPTION]` and scope it to "single client, sequential UI actions".

### C6. §5 Observability (request-level logging, debuggable from logs alone)
- Not in the original and only loosely in the brief (logs readable via compose). Small, but it is a new NFR category. Suggest fold a single line into Deployability and drop the separate heading.

### C7. Items sourced from the training brief, not the product PRD (not creep, but worth labelling)
- FR-13 Health Endpoint, container health, WCAG audit, 70% coverage, security review, E2E minimums. The original says nothing about these; the draft presents them in §4 and §5 as product requirements. They are correctly placed in §6 as delivery constraints; suggest FR-13 moves to §6 or is marked "from CONTEXT.md" so the Architect can tell product intent from course grading.

### Not contradictions, already flagged correctly in the draft
- Un-complete toggle (FR-8, OQ 4), 500-character cap (OQ 3), newest-first ordering, single shared store. All are reasonable and tagged `[ASSUMPTION]`.
