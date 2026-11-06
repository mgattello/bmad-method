import { expect, test } from '@playwright/test';
import { TODOS_PATH } from '@todo/contract';
import { purgeTodos } from './support.ts';

// Generous bounds: the targets are 1 s and 100 ms under Normal conditions (NFR3).
const RENDER_BOUND_MS = 2000;
const ACTION_BOUND_MS = 500;
const COUNT = 200;

test('200 todos render quickly and each action reflects promptly', async ({ page, request }) => {
  await purgeTodos(request);
  for (let i = 0; i < COUNT; i += 1) {
    const res = await request.post(TODOS_PATH, { data: { description: `Fixture todo ${i}` } });
    expect(res.status()).toBe(201);
  }

  const start = Date.now();
  await page.goto('/');
  await expect(page.getByRole('listitem')).toHaveCount(COUNT);
  const render = Date.now() - start;
  console.log(`perf: render of ${COUNT} todos ${render} ms`);
  expect(render).toBeLessThan(RENDER_BOUND_MS);

  const description = `Timed ${Date.now()}`;
  const input = page.getByRole('textbox', { name: 'New todo' });
  await input.fill(description);
  let t = Date.now();
  await input.press('Enter');
  await expect(page.getByRole('listitem').first()).toContainText(description);
  const create = Date.now() - t;

  const box = page.getByRole('checkbox', { name: description });
  t = Date.now();
  await box.click();
  await expect(box).toBeChecked();
  const tick = Date.now() - t;

  t = Date.now();
  await page.getByRole('button', { name: `Delete ${description}` }).click();
  await expect(page.getByText(description)).toHaveCount(0);
  const remove = Date.now() - t;

  console.log(`perf: create ${create} ms, tick ${tick} ms, delete ${remove} ms`);
  for (const ms of [create, tick, remove]) expect(ms).toBeLessThan(ACTION_BOUND_MS);
});
