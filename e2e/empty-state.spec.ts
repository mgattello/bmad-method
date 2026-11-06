import { expect, test } from '@playwright/test';

import { EMPTY_STATE_TEXT, LIST_REGION_NAME, LOADING_TEXT, purgeTodos } from './support.ts';

test.beforeEach(async ({ request }) => {
  await purgeTodos(request);
});

test('Empty State invites the first todo when the store is empty', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle('Todo');
  const list = page.getByRole('region', { name: LIST_REGION_NAME });
  await expect(list.getByText(EMPTY_STATE_TEXT)).toBeVisible();
  await expect(page.getByText(LOADING_TEXT)).toHaveCount(0);
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
  await expect(page.getByRole('status')).toBeEmpty();
});
