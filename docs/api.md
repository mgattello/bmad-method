# API contract

The Todo API under `/api/v1`. All bodies are JSON, paths have no trailing slash, and the paths
live in `@todo/contract` (`TODOS_PATH`, `todoPath`, `HEALTH_PATH`). One integration spec per
endpoint in `apps/api/test/` matches this document.

## Todo

```json
{
  "id": "6f1c2a0e-5d3b-4c8a-9e2f-1b7d4a9c3e10",
  "description": "Send invoice to Kerr",
  "completed": false,
  "createdAt": "2026-10-26T11:42:07.512Z"
}
```

`id` and `createdAt` are assigned by the server and never change. `description` is stored trimmed,
1 to 500 characters (`DESCRIPTION_MAX`). `createdAt` is ISO 8601 UTC with milliseconds.

## Endpoints

| Operation | Request                                                                                                | Success                           | Errors                                                         |
| --------- | ------------------------------------------------------------------------------------------------------ | --------------------------------- | -------------------------------------------------------------- |
| List      | `GET /api/v1/todos`                                                                                    | `200` array of Todo, newest first | `500`                                                          |
| Create    | `POST /api/v1/todos` body `{ "description": string }`                                                  | `201` Todo                        | `400`, `500`                                                   |
| Update    | `PATCH /api/v1/todos/:id` body `{ "description"?: string, "completed"?: boolean }`, at least one field | `200` the updated Todo            | `400`, `404`, `500`                                            |
| Delete    | `DELETE /api/v1/todos/:id`                                                                             | `204` empty body                  | `404`, `500`                                                   |
| Health    | `GET /api/v1/health`                                                                                   | `200` `{ "status": "ok" }`        | `503` `{ "status": "degraded" }` when the store is unreachable |

Rules by endpoint:

- **Create.** The server trims `description` and rejects an empty or over-long result with `400 VALIDATION_ERROR`.
- **Update.** Both fields apply when both are sent. An unknown id is `404` even when the body is also invalid. `id` and `createdAt` never change.
- **Delete.** There is no confirmation and no undo. A second delete of the same id is `404`.
- **List.** Ordered by `createdAt` descending, then insertion order descending.

## Errors

Every error body is `{ "code": string, "message": string }`. The web never shows `message`; it
keeps its own copy keyed by action and code.

| Code               | Status | When                                                                                                                                            |
| ------------------ | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `VALIDATION_ERROR` | 400    | Wrong type, unknown field, empty PATCH body, malformed JSON, unsupported content type, or a description empty after trim or over 500 characters |
| `NOT_FOUND`        | 404    | Unknown route, or an id that is malformed or not stored                                                                                         |
| `INTERNAL_ERROR`   | 500    | Anything unexpected; the message is generic                                                                                                     |

## Examples

```sh
curl -X POST   localhost:3000/api/v1/todos -H 'content-type: application/json' -d '{"description":"Buy milk"}'
curl -X PATCH  localhost:3000/api/v1/todos/<id> -H 'content-type: application/json' -d '{"completed":true}'
curl -X DELETE localhost:3000/api/v1/todos/<id>
```
