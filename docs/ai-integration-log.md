# AI Integration Log

Append-only record of how AI agents were used on this project: one entry per story, written as
part of that story's definition of done. Each entry covers agent usage, the prompts that drove
the work, MCP servers or tools involved, what the AI got wrong or missed, how problems were
debugged, and limitations worth knowing about.

## Story 1.1: Scaffold the workspace and the API contract package

**Date:** 2026-10-26

**Agent usage.** Claude Code (model Fable 5.1) ran as a BMAD build dispatch agent with the
story spec as its only brief. It read the spec's `context:` files (the epic 1 context and the
architecture spine), then hand-scaffolded the monorepo without a starter template: root
workspace config, `packages/contract` with schemas and tests, placeholder `apps/api` and
`apps/web` workspaces wired to Vitest, the `e2e` stub, and the docs. It ran every verification
command itself (`npm ci`, `npm run build`, `npm run lint`, `npm test`, `npm run test:int`).

**Prompts.** One prompt: implement the story spec, treating it as the sole source of truth, and
report what changed and how it was verified. No follow-up prompting was needed.

**MCPs and tools.** No MCP servers were used. Version and API facts came from the npm registry
through the npm CLI (`npm view`) and from a throwaway probe install in a scratch directory,
where the agent confirmed before writing any code that typebox 1.4.3 exposes a default `Type`
export, a `Static` type and a `typebox/value` default export, that `additionalProperties` and
`minProperties` are honoured by `Value.Check`, that `eslint-plugin-react-hooks` 7 ships
`configs.flat.recommended`, and that `tsc` 6.0.3 accepts `erasableSyntaxOnly` and
`verbatimModuleSyntax`.

**Version pins.** Every package pinned in the spine's Stack table that this story installs
exists in the registry at exactly that version, so no deviation was needed: typescript 6.0.3,
typebox 1.4.3, react and react-dom 19.3.1, @types/react and @types/react-dom 19.3.0, vite
8.3.5, @vitejs/plugin-react 6.1.2, vitest and @vitest/coverage-v8 5.0.5, jsdom 30.1.3,
@testing-library/react 16.3.3, @testing-library/dom 10.4.2, @types/node 24.19.2, eslint
10.13.0, @eslint/js 10.0.1, typescript-eslint 8.72.0, eslint-plugin-react-hooks 7.1.1,
prettier 3.9.10. Fastify, better-sqlite3, tsx and Playwright are not installed yet (Stories 1.2
to 1.5).

**What the AI missed, and debugging.** Three things failed on first run, all caught by the
story's own verification commands:

1. ESLint flagged an unused `_createdAt` variable from a rest-destructure in the contract test.
   Replaced with an explicit object that omits the field.
2. The web smoke test failed with "Found multiple elements with the role heading". The test
   mounts `main.tsx` into `#root` and also renders `App` through Testing Library, whose
   `render` binds queries to `document.body`, so both trees matched. Fixed by scoping queries
   with `within(container)`.
3. After that, asserting on `#root` immediately after importing `main.tsx` found nothing:
   `createRoot().render` schedules work through React's concurrent scheduler and had not
   committed yet (it had only appeared earlier because Testing Library's `render` flushed it
   inside `act`). Fixed by importing the module inside `act(...)`, which also avoids a "not
   wrapped in act" warning.

**Decisions made while implementing.** Every root script that reaches an app builds the
contract first: `test` and `test:int` so a clean checkout can run them without a separate build
step, and `lint`, which after ESLint and Prettier runs `typecheck` in every workspace (api and web
type-check against the contract's `dist/`). Test files are excluded from each `tsc` build so they
are not emitted to `dist/`; contract and api type-check them through a `tsconfig.test.json`, web
through `tsconfig.app.json` via `tsc -b`. The web `tsconfig.node.json` adds `types: ["node"]`
alongside `vite/client` because `vite.config.ts` reads `process.env.API_PROXY_TARGET`. Coverage is
enabled for the contract package as well as the two apps. `todoPath` URL-encodes its id so a
malformed id cannot change the path shape. The api `dev` script is left for Story 1.2, which
introduces `tsx`.

**Review rounds.** Round 1 (build review) raised 18 findings, 11 patched. The main ones: the
README told developers to copy a `.env` file that nothing loads; `document.getElementById('root')
as HTMLElement` crashed inside `createRoot` when `#root` was missing; `??` kept an empty
`API_PROXY_TARGET` so the proxy threw per request; the `/api` proxy key prefix-matched paths such
as `/apiary.png`; and the contract's type exports were pinned by no type-check because test files
were excluded from `tsc`. Round 2 (code review) raised 21 findings, 13 patched, mainly the
remaining type exports still unpinned by any annotation, stale log text, drift between the ignore
files and the lint config, and test setup gaps (no Testing Library cleanup, api integration folder
not type-checked).

**Limitations.** The web placeholder shows the list endpoint path on
screen so the smoke test exercises the contract import; Story 1.3 replaces that shell. No
Docker was available locally, which this story did not need.

## Story 1.3: Web shell shows the Todo List with Loading, Empty and Error States

**Date:** 2026-10-26

**Agent usage.** Claude Code (model Fable 5.1) ran as a BMAD build dispatch agent in a git
worktree on branch `epic-1/story-1-3`, with the story spec as its only brief. It read the spec's
`context:` files (the epic 1 context and the architecture spine), inspected the existing web
workspace, root configs and contract exports, then wrote the client, the state hook, the six
components with their CSS modules, `tokens.css`, `App`, the rewired entry point and the four test
files. It ran every verification command itself (`npm run build`, `npm run lint`, `npm test`, the
spec's greps and the `git diff main` boundary check). Story 1.2 (the API) was built in parallel on
another branch and is not in this tree; everything here runs against a mocked client.

**Prompts.** One prompt: implement the story spec, treating it as the sole source of truth, load
the spec's context files first, and report what changed, how it was verified and what is left.
No follow-up prompting was needed.

**MCPs and tools.** No MCP servers were used. The agent worked through the shell: file writes,
`eslint`, `prettier`, `tsc -b`, `vitest` and `git`. Before writing tests it checked that
`@testing-library/react` 16 exports `renderHook` and that the Node 24 globals `fetch` and
`Response` are available under the jsdom environment, so the client tests could build real
`Response` objects instead of hand-rolled fakes.

**What the AI missed, and debugging.** The first `npm run lint` failed on one finding and
Prettier flagged four files; tests passed on the first run.

1. `react-hooks/set-state-in-effect` fired on the first version of `use-todos.ts`. The mount
   effect called `load()`, and `load` set `{ status: 'loading' }` synchronously before awaiting
   the client, which the React Compiler rule traces through the local `useCallback`. The spec
   anticipated this ("restructure rather than disable"). The fix splits the hook into
   `fetchInto(id)` (await the client, apply the result only if `id` is still the latest) and
   `load()` (set `loading`, then `fetchInto`). The mount effect calls `fetchInto` directly because
   the initial state is already `loading`, so no synchronous `setState` runs inside the effect,
   and the stale-response guard is shared by both paths.
2. Prettier rewrapped a long `if ... return` in the client, the ternary in the hook, a long
   `waitFor` line in the hook test and the `font-family` list in `tokens.css`. Fixed with
   `prettier --write`.

**Decisions made while implementing.** The Retry button is rendered inside the `role="status"`
element, so the message and the control are announced together and E2E can locate both through
`getByRole('status')`; when there is no message the banner stays in the DOM and in normal flow
with no class, so it occupies no visible space but is already in the accessibility tree before the
first message is inserted. The unmount case is handled by the sequence counter alone: the
effect cleanup bumps `seq`, which invalidates the pending request on unmount and on StrictMode's
first pass, so no `isMounted` flag exists. `TodoItem` passes the whole `Todo` to the optional
`onToggle` and `onDelete` props so Story 2 can read `id` and `completed` without a second lookup.
`TodoInput` is a controlled input with `useId` for its label. The visually hidden rule lives in
`LoadingState.module.css` and `:focus-visible` outlines live in each component's module, because
the spec limits `tokens.css` to custom properties and the base rules. `main.test.tsx` mocks the
client with a factory rather than an automock: `vi.resetModules()` re-instantiates the module per
test, which would discard any `mockResolvedValue` set on an automocked function. Client tests
assert the exact `fetch` call (`TODOS_PATH` plus the `accept` header) and that the serialised
result never contains the server message.

**Review rounds.** Round 1 (build review, three layers: blind hunter, edge-case hunter,
verification gap) raised 22 findings (18 after grouping duplicates), 9 patched, 9 rejected, 0 deferred. The main patches: the
empty banner used `display: none`, which removed the live region from the accessibility tree so the
first failure would not reliably be announced; skeleton rows were 44px while a rendered item was
54px, so the list shifted when the skeleton was replaced; the native checkbox was sized 44px and
rendered oversized next to 16px text (now natural size, the row and its label keep the 44px
target); the `TodoInput` submit path had no test, so removing `preventDefault` would have reloaded
the page with every test still green; the completed-item class was never asserted; and the
"server message not rendered" assertion was vacuous because the mocked result carried no message.

**Limitations.** Only jsdom tests exist, so touch-target size, visible focus and the no-layout-shift
guarantee are asserted by CSS (`--row-min-height`, `--list-min-height`) rather than by a test; a
browser-level accessibility and visual check waits for the E2E and QA stories. With no API in this
tree, `npm run dev -w apps/web` shows the Error State with Retry until Story 1.2 is merged or
`API_PROXY_TARGET` points at a running API. The unmount-mid-load test cannot fail if the sequence
guard's cleanup is removed, because React 19 makes `setState` on an unmounted component a silent
no-op, so it documents the behaviour rather than guarding it. Docker was not needed.
