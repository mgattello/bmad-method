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

**Decisions made while implementing.** The `test` and `test:int` root scripts build the
contract first so a clean checkout can run `npm test` without a separate build step; `lint`
does not, because ESLint is configured non-type-aware and needs no `dist/`. Test files are
excluded from each `tsc` build so they are not emitted to `dist/`; a `tsconfig.test.json` per package
and a `typecheck` script (run by the root `lint`) type-check them instead. The web `tsconfig.node.json`
adds `types: ["node"]` alongside `vite/client` because `vite.config.ts` reads
`process.env.API_PROXY_TARGET`. Coverage is enabled for the contract package as well as the two
apps. `todoPath` URL-encodes its id so a malformed id cannot change the path shape. The api
`dev` script is left for Story 1.2, which introduces `tsx`.

**Limitations.** The web placeholder shows the list endpoint path on
screen so the smoke test exercises the contract import; Story 1.3 replaces that shell. No
Docker was available locally, which this story did not need.
