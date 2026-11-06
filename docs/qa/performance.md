# Performance report

Targets (NFR3): the Todo List renders within 1 s with 200 Todos, each action reflects within
100 ms under Normal conditions, and Lighthouse mobile performance is 90 or above.

## Method

- **E2E timing.** `e2e/performance.spec.ts` seeds 200 Todos through the API, then times the first
  render and a create, tick and delete in Chromium against the built images. It asserts generous
  bounds (2 s render, 500 ms per action) so it stays stable on slow machines; the real targets are
  checked against the printed numbers.
- **Lighthouse.** Lighthouse 12.8.2 CLI, mobile form factor with its default simulated slow 4G
  and 4x CPU throttling, headless Chrome, against `todo-e2e` on port 8081 with the same 200 Todos
  loaded. Three runs.
- **Chrome DevTools MCP.** Not available in this build session, so it was not used. Layout shift,
  bundle size and long tasks come from Lighthouse's own audits instead.

## Numbers

| Measure                            | Result             | Target       |
| ---------------------------------- | ------------------ | ------------ |
| Render of 200 Todos (E2E, local)   | 49 ms              | under 1 s    |
| Create, tick, delete (E2E, local)  | 34, 68 and 59 ms   | under 100 ms |
| Lighthouse performance, before fix | 0.85               | 0.90         |
| Lighthouse performance, after fix  | 0.97 (3 of 3 runs) | 0.90         |
| First contentful paint, after      | 1.8 s              | n/a          |
| Largest contentful paint, after    | 2.4 s              | n/a          |
| Total blocking time                | 0 ms               | n/a          |
| Cumulative layout shift            | 0                  | n/a          |
| Transferred size, before and after | 323 KiB to 112 KiB | n/a          |

Action timings include Playwright's polling interval, so they overstate the real latency.

## Issues found and fixed

1. **No text compression.** nginx served the 290 KiB JavaScript bundle uncompressed (Lighthouse
   "Enable text compression", about 228 KiB savings), which put the score at 0.85. Fixed in
   `apps/web/nginx.conf` with `gzip on` for CSS, JavaScript, JSON and SVG. Lighthouse went to 0.97.
2. **No long-lived caching for hashed assets.** Added `expires 1y` on `/assets/`. It uses `expires`
   rather than `add_header`, so the server-level `nosniff` and CSP headers still apply.
   `e2e/stack.spec.ts` now asserts gzip, the cache header and the security headers on the bundle.

## Remaining findings, left as is

- Lighthouse reports about 183 KiB of unused JavaScript (React runtime). Code splitting would not
  help a single-screen app and the score is already above target.
- A small render-blocking stylesheet (about 5 KiB, around 150 ms estimated). Inlining it is not
  worth the build complexity.
- No layout shift: the list region reserves its height for the three states (`--list-min-height`).

## Not done

The one manual check on a real device that the story mentions was not performed here.
