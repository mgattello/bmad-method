import { randomUUID } from 'node:crypto';

import { expect, test, type APIResponse } from '@playwright/test';
import { API_PREFIX, HEALTH_PATH, TODOS_PATH } from '@todo/contract';

import { compose } from './stack.ts';
import { purgeTodos } from './support.ts';

type RequestLine = { method?: string; url?: string; statusCode?: number; responseTime?: number };

function expectSecurityHeaders(res: APIResponse): void {
  expect(res.headers()['x-content-type-options']).toBe('nosniff');
  expect(res.headers()['content-security-policy']).toBe("default-src 'self'");
}

// Every api log line is JSON; anything else (none expected) is dropped.
function apiLogLines(): RequestLine[] {
  return compose(['logs', '--no-log-prefix', 'api'])
    .split('\n')
    .filter((line) => line.startsWith('{'))
    .map((line) => JSON.parse(line) as RequestLine);
}

test.beforeEach(async ({ request }) => {
  await purgeTodos(request);
});

test('web serves the page and /healthz with the security headers', async ({ request }) => {
  const page = await request.get('/');
  expect(page.status()).toBe(200);
  expectSecurityHeaders(page);
  expect(await page.text()).toContain('<title>Todo</title>');

  const health = await request.get('/healthz');
  expect(health.status()).toBe(200);
  expectSecurityHeaders(health);
  expect(await health.text()).toBe('ok');
});

test('hashed assets are gzipped and cacheable and keep the security headers', async ({
  request,
}) => {
  const html = await (await request.get('/')).text();
  const asset = /\/assets\/index-[\w-]+\.js/.exec(html)?.[0];
  expect(asset).toBeDefined();

  const res = await request.get(asset as string);

  expect(res.status()).toBe(200);
  expect(res.headers()['content-encoding']).toBe('gzip');
  expect(res.headers()['cache-control']).toContain('max-age=31536000');
  expectSecurityHeaders(res);
});

test('nginx passes /api/ through to the api unchanged', async ({ request }) => {
  const health = await request.get(HEALTH_PATH);
  expect(health.status()).toBe(200);
  expectSecurityHeaders(health);
  expect(await health.json()).toEqual({ status: 'ok' });

  const todos = await request.get(TODOS_PATH);
  expect(todos.status()).toBe(200);
  expect(Array.isArray(await todos.json())).toBe(true);

  // The api envelope proves the unknown path reached the api, not nginx.
  const nope = await request.get(`${API_PREFIX}/nope`);
  expect(nope.status()).toBe(404);
  expectSecurityHeaders(nope);
  expect(await nope.json()).toEqual({ code: 'NOT_FOUND', message: expect.any(String) });
});

test('the api logs one JSON completion line per request', async ({ request }) => {
  // The line is written in onResponse, after the reply is sent, so poll the logs.
  expect((await request.get(HEALTH_PATH)).status()).toBe(200);
  await expect
    .poll(() =>
      apiLogLines()
        .filter((line) => line.url === HEALTH_PATH)
        .at(-1),
    )
    .toMatchObject({
      method: 'GET',
      url: HEALTH_PATH,
      statusCode: 200,
      responseTime: expect.any(Number),
    });

  // A unique path shows exactly one line for exactly one request.
  const unique = `${API_PREFIX}/nope-${randomUUID()}`;
  expect((await request.get(unique)).status()).toBe(404);
  await expect.poll(() => apiLogLines().filter((line) => line.url === unique)).toHaveLength(1);
  expect(apiLogLines().find((line) => line.url === unique)).toMatchObject({
    method: 'GET',
    statusCode: 404,
  });
});

test('both containers run as non-root and /data belongs to node', () => {
  expect(compose(['exec', '-T', 'api', 'id', '-u']).trim()).not.toBe('0');
  expect(compose(['exec', '-T', 'web', 'id', '-u']).trim()).not.toBe('0');
  expect(compose(['exec', '-T', 'api', 'stat', '-c', '%U', '/data']).trim()).toBe('node');
});

// Last test in the last file: its row survives (no DELETE route yet) and must not precede a journey.
test('todos survive a container restart', async ({ request }) => {
  test.setTimeout(120_000);
  const description = 'Survives a restart';
  const created = await request.post(TODOS_PATH, { data: { description } });
  expect(created.status()).toBe(201);
  const { id } = (await created.json()) as { id: string };

  compose(['restart']);
  compose(['up', '--wait']);

  const list = await request.get(TODOS_PATH);
  expect(list.status()).toBe(200);
  expect(await list.json()).toContainEqual(expect.objectContaining({ id, description }));

  // The purge meets a real row here; a 404 DELETE must be tolerated until Story 2.4.
  await expect(purgeTodos(request)).resolves.toBeUndefined();
});
