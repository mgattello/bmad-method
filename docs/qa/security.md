# Security review

Scope: `apps/api`, `apps/web`, the two Dockerfiles, `nginx.conf`, `docker-compose.yml` and the
dependency tree. The review was done with AI assistance by reading the code and running the
commands below; each check lists its evidence (NFR5).

## Checks

| Area             | Check                                 | Evidence                                                                                                                                                                                                                                                                                                                                       | Result           |
| ---------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| XSS              | Descriptions render as text only      | `grep -rnE "dangerouslySetInnerHTML\|innerHTML\|eval\(\|new Function\|document\.write" apps/*/src` returns nothing outside tests; `e2e/security.spec.ts` creates `<img onerror><script><b>` through the UI, sees it as literal text before and after a reload, finds no `img`, `script` or `b` in the list, and no dialog fires                | Pass             |
| XSS              | Server never reflects input into HTML | Every API response is JSON; errors use fixed messages (`Not found`, `Invalid request`, `Unexpected error`) or the fixed description rule text                                                                                                                                                                                                  | Pass             |
| Injection        | Prepared statements only              | The only SQL is in `sqlite-todo-repository.ts`: six `prepare` calls with `?` parameters and one constant `CREATE TABLE` in `db.exec`; no template literal builds SQL. `apps/api/test/todos.int.test.ts` stores `'); DROP TABLE todos; --` and similar byte for byte, and a `DELETE` with `x' OR '1'='1` as the id is a 404 that changes no row | Pass             |
| Input validation | Server-side on every write            | Route schemas reject wrong types, unknown fields and an empty PATCH; the service trims and bounds the description (1 to 500) for both create and update                                                                                                                                                                                        | Pass             |
| Headers          | CSP, nosniff, framing, referrer       | `nginx.conf` sets `Content-Security-Policy: default-src 'self'`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer` with `always`; `e2e/stack.spec.ts` asserts them on `/`, `/healthz`, proxied `/api/` responses (including a 404) and the hashed bundle                                              | Pass after fix 1 |
| Containers       | Non-root                              | `apps/api/Dockerfile` has `USER node`; the web image is `nginxinc/nginx-unprivileged` (uid 101); `e2e/stack.spec.ts` asserts neither uid is 0 and that `/data` belongs to `node`                                                                                                                                                               | Pass             |
| Secrets          | None in images, env files or source   | `.env.example` holds only host, port, log level, database path and proxy target; `git ls-files` shows no key or certificate files; a search of tracked files for `password`, `secret`, `token`, `api_key` and `private key` finds only the word "secret" in test fixtures and the `tokens.css` file name                                       | Pass             |
| Dependencies     | `npm audit`                           | `npm audit --omit=dev`: 0 vulnerabilities in anything that ships. `npm audit`: 10 moderate, all in the ESLint toolchain (`eslint`, `typescript-eslint`, `minimatch` and friends), dev only                                                                                                                                                     | Accepted risk 1  |

## Findings and remediations

1. **Missing framing and referrer headers (low).** CSP `default-src` does not cover
   `frame-ancestors`, so the app could be framed (clickjacking of the Delete button). Fixed by
   adding `X-Frame-Options: DENY` and `Referrer-Policy: no-referrer`, with a test.
2. **Uncompressed responses (informational, performance).** Fixed in Story 3.3; no security effect.

## Accepted risks

1. **Dev-only audit findings.** The moderate advisories are in lint tooling that is not installed in
   the runtime images and never handles untrusted input. Upgrading means a breaking ESLint major
   release; revisit when the toolchain updates.
2. **No authentication, rate limiting or CORS configuration.** Out of scope for the single-user v1
   (PRD). The API is reached through the web container's same-origin proxy and Fastify's default
   1 MB body limit applies. Anyone who can reach the port can read and change every Todo.
3. **`default-src 'self'` allows same-origin inline-free content only.** The bundle uses no inline
   script or style, so no `unsafe-inline` is needed; a future change that adds inline style would
   need the CSP revisited.
4. **No TLS.** The compose stack serves HTTP. TLS termination belongs to wherever it is deployed.
