- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-scaffold-the-workspace-and-the-api-contract-package.md`
  summary: Remove `--passWithNoTests` from the api `test:int` script once Story 1.2 adds the first integration spec, so a mis-globbed spec cannot pass silently.
  evidence: Verification-gap reviewer observed `npm run test:int` exits 0 on "No test files found"; the flag exists only because 1.1 ships no specs.
