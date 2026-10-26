# Integration specs

Run with `npm run test:int` from the repository root (it builds the contract first). Each spec
builds the real app with `buildApp` on a `SqliteTodoRepository` over a temp file created in
`beforeAll` (`mkdtemp`) and removed in `afterAll`, and drives it with `fastify.inject`; no
network port is opened.

| Spec                    | Proves                                                                                                                                                                                                                      |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `todos.int.test.ts`     | A fresh file yields `200 []`; rows seeded directly with better-sqlite3 come back newest first with exactly `id, description, completed, createdAt`; a second app on the same file sees the same order (restart persistence) |
| `health.int.test.ts`    | `200 { status: "ok" }` while the store is open, `503 { status: "degraded" }` after the repository is closed                                                                                                                 |
| `not-found.int.test.ts` | `404 { code: "NOT_FOUND", message }` for an unknown route and a trailing slash; `500 { code: "INTERNAL_ERROR", message }` with no library text once the store is closed                                                     |

The runner has no `--passWithNoTests`, so a mis-globbed spec directory fails the run.
