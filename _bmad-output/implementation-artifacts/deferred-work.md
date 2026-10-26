- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-scaffold-the-workspace-and-the-api-contract-package.md`
  summary: Remove `--passWithNoTests` from the api `test:int` script once Story 1.2 adds the first integration spec, so a mis-globbed spec cannot pass silently.
  evidence: Verification-gap reviewer observed `npm run test:int` exits 0 on "No test files found"; the flag exists only because 1.1 ships no specs.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-2-api-lists-todos-from-a-durable-sqlite-store-and-reports-health.md`
  summary: Add an automated check that `apps/api/src/server.ts` honours the env contract (DB_PATH parent created, HOST/PORT applied, completion log line at LOG_LEVEL, SIGTERM closes app and store), unless Story 1.5's run against the built image covers it.
  evidence: Verification-gap reviewer showed `npm test`, `npm run test:int` and `npm run lint` stay green when `server.ts` drops the logger, the mkdir or reads the wrong env var; the file is excluded from coverage and only the manual `tsx` smoke run exercises it.
