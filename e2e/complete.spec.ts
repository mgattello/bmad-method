import { expect, test } from '@playwright/test';
import { TODOS_PATH } from '@todo/contract';
import { purgeTodos } from './support.ts';

test.beforeEach(async ({ page, request }) => {
  await purgeTodos(request);
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Add' })).toBeEnabled();
});

async function seed(
  page: import('@playwright/test').Page,
  request: import('@playwright/test').APIRequestContext,
  completed = false,
) {
  const description = `Walk the dog ${Date.now()}`;
  const res = await request.post(TODOS_PATH, { data: { description } });
  expect(res.status()).toBe(201);
  if (completed) {
    const { id } = (await res.json()) as { id: string };
    const patched = await request.patch(`${TODOS_PATH}/${id}`, { data: { completed: true } });
    expect(patched.ok()).toBe(true);
  }
  await page.reload();
  return { box: page.getByRole('checkbox', { name: description }), description };
}

test('ticking a todo checks it and strikes through the label', async ({ page, request }) => {
  const { box, description } = await seed(page, request);

  await box.click();

  await expect(box).toBeChecked();
  await expect(box).toBeEnabled();
  await expect(
    page.getByText(await box.evaluate((el) => el.nextElementSibling?.textContent ?? '')),
  ).toHaveCSS('text-decoration-line', 'line-through');
  await expect(page.getByRole('status')).toBeEmpty();
});

test('unticking a completed todo clears the check', async ({ page, request }) => {
  const { box } = await seed(page, request, true);
  await expect(box).toBeChecked();

  await box.click();

  await expect(box).not.toBeChecked();
  await expect(page.getByRole('status')).toBeEmpty();
});

test('a ticked todo stays ticked after a reload', async ({ page, request }) => {
  const { box } = await seed(page, request);
  await box.click();
  await expect(box).toBeChecked();

  await page.reload();

  await expect(box).toBeChecked();
});

test('an unticked todo stays unticked after a reload', async ({ page, request }) => {
  const { box } = await seed(page, request, true);
  await box.click();
  await expect(box).not.toBeChecked();

  await page.reload();

  await expect(box).not.toBeChecked();
});
