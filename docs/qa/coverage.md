# Coverage report

Measured with `@vitest/coverage-v8`. `npm test` runs the contract, api and web suites; each app's
`vitest.config.ts` sets `thresholds: { lines: 70, branches: 70 }`, so the run exits non-zero when
either app falls below 70% on lines or branches. The target is 70% meaningful coverage (NFR7).

## Numbers

| Package             | Tests                   | Lines before | Branches before           | Lines after    | Branches after |
| ------------------- | ----------------------- | ------------ | ------------------------- | -------------- | -------------- |
| `apps/api`          | 64 unit, 47 integration | 100%         | 95% (Story 2.2 baseline)  | 100% (102/102) | 97.82% (45/46) |
| `apps/web`          | 113                     | 100%         | 100% (Story 2.2 baseline) | 100% (130/130) | 98.96% (96/97) |
| `packages/contract` | 18                      | n/a          | n/a                       | 100% (12/12)   | 100% (0/0)     |

"Before" is the baseline recorded in the Story 2.3 spec; "after" is the end of the build
(Story 2.5). Coverage was high at every story boundary because each story shipped with its own
unit, component and integration tests, so there was no late gap to close; the added tests in this
phase were for new behaviour (PATCH, DELETE, toggle, remove), not for padding.

## Gap analysis

Two branches are uncovered:

- `apps/api/src/repository/sqlite-todo-repository.ts` line 37, a defensive branch in
  `openDatabase` setup. Left untested: reaching it needs a filesystem fault that would make the
  test depend on the host.
- `apps/web/src/state/use-todos.ts` line 83, the `NOT_FOUND` branch of `toggle` when the list is
  no longer `ready` (a toggle result landing after a reload started). The matching `remove` case
  is tested; the `toggle` one is the same guard on the same state check.

## Are the tests meaningful

Coverage measures what ran, not what was asserted, so eight plausible regressions were applied by
hand one at a time and the suites re-run. Every one failed a test:

| Mutation                                       | Result |
| ---------------------------------------------- | ------ |
| `TodoService`: description no longer trimmed   | killed |
| `TodoService.update`: not-found check removed  | killed |
| `TodoService.delete`: not-found lookup removed | killed |
| Description limit off by one (`>=`)            | killed |
| Web client ignores the error envelope code     | killed |
| `toggle` sends the unchanged status            | killed |
| `create` inserts at the end instead of the top | killed |
| `toggle` pending guard removed                 | killed |

## Left untested on purpose

- Visual appearance (colours, spacing, focus outline). jsdom has no layout; the 360 px and
  overflow checks run in the Playwright specs instead.
- Real keyboard focus movement. Component tests assert document order; `e2e/` specs exercise the
  focus rules in a browser.
- Container behaviour. Covered by `e2e/stack.spec.ts` against the built images, not by unit
  coverage.
