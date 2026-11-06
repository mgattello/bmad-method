# E2E

Playwright on Chromium against the built images, under compose project `todo-e2e` on
`http://localhost:8081`. `npm run test:e2e` at the repository root owns the whole lifecycle; the
root README's E2E section explains it.

```text
run.ts                   lifecycle: down -v, up --build --wait, Playwright, down -v (always)
stack.ts                 compose project name, port, base URL, and compose() for the runner and specs
playwright.config.ts     chromium only, one worker, no webServer, baseURL http://localhost:8081
support.ts               purgeTodos() for every beforeEach, plus the user-visible copy literals
empty-state.spec.ts      Empty State on a fresh store
load-failure.spec.ts     Error State and Retry when the list GET is aborted
stack.spec.ts            container contract: headers, /api/ passthrough, log line, uids, restart
tsconfig.json            noEmit type-check, picked up by the root lint
```

## Specs alone, against a stack you started

Start the stack once by hand with the same project name and port the specs expect, then run
Playwright directly (for example headed, or a single spec):

```sh
WEB_PORT=8081 docker compose -p todo-e2e up --build -d --wait
npm test -w e2e -- --headed
npm test -w e2e -- empty-state.spec.ts
WEB_PORT=8081 docker compose -p todo-e2e down -v
```

The contract must be built first (`npm run build -w packages/contract`) and Chromium installed
once (`npx playwright install chromium`). `stack.spec.ts` restarts the containers in its last
test, so run it last or alone. Every spec purges the store through `DELETE /api/v1/todos/:id`
before each test, so reruns against the same stack are safe.
