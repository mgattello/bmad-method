import { expect, test } from '@playwright/test';
import { TODOS_PATH } from '@todo/contract';
import { EMPTY_STATE_TEXT, purgeTodos } from './support.ts';

test.beforeEach(async ({ page, request }) => {
  await purgeTodos(request);
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Add' })).toBeEnabled();
});

async function seed(
  page: import('@playwright/test').Page,
  request: import('@playwright/test').APIRequestContext,
  description: string,
) {
  const res = await request.post(TODOS_PATH, { data: { description } });
  expect(res.status()).toBe(201);
  await page.reload();
}

test('deleting a todo removes it and it stays gone after a reload', async ({ page, request }) => {
  const keep = `Keep ${Date.now()}`;
  const drop = `Drop ${Date.now()}`;
  await seed(page, request, keep);
  await seed(page, request, drop);

  await page.getByRole('button', { name: `Delete ${drop}` }).click();

  await expect(page.getByText(drop)).toHaveCount(0);
  await expect(page.getByText(keep)).toBeVisible();
  await expect(page.getByRole('status')).toBeEmpty();
  await page.reload();
  await expect(page.getByText(drop)).toHaveCount(0);
  await expect(page.getByText(keep)).toBeVisible();
});

test('deleting the last todo brings back the Empty State', async ({ page, request }) => {
  const only = `Only ${Date.now()}`;
  await seed(page, request, only);

  await page.getByRole('button', { name: `Delete ${only}` }).click();

  await expect(page.getByText(EMPTY_STATE_TEXT)).toBeVisible();
});

test('a failed delete keeps the todo and names the action', async ({ page, request }) => {
  const stay = `Stay ${Date.now()}`;
  await seed(page, request, stay);
  await page.route(
    (url) => url.pathname.startsWith(`${TODOS_PATH}/`),
    (route) => (route.request().method() === 'DELETE' ? route.abort() : route.continue()),
  );

  await page.getByRole('button', { name: `Delete ${stay}` }).click();

  await expect(page.getByRole('status')).toHaveText(
    "We couldn't delete your todo. Check your connection and try again.",
  );
  await expect(page.getByText(stay)).toBeVisible();
  await expect(page.getByRole('button', { name: `Delete ${stay}` })).toBeEnabled();
});

test('the purge now empties the store through the real endpoint', async ({ request }) => {
  await request.post(TODOS_PATH, { data: { description: `Purge me ${Date.now()}` } });

  await purgeTodos(request);

  const list = await request.get(TODOS_PATH);
  expect(await list.json()).toEqual([]);
});
