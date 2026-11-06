import { expect, test } from '@playwright/test';
import { TODOS_PATH } from '@todo/contract';
import { FAILURE_COPY, purgeTodos } from './support.ts';

test.beforeEach(async ({ page, request }) => {
  await purgeTodos(request);
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Add' })).toBeEnabled();
});

test('a failed create announces in the status region, keeps the text and focus, then succeeds', async ({
  page,
}) => {
  const input = page.getByRole('textbox', { name: 'New todo' });
  const description = `Retry me ${Date.now()}`;
  const fail = (url: URL) => url.pathname === TODOS_PATH;
  await page.route(fail, (route) =>
    route.request().method() === 'POST' ? route.abort() : route.continue(),
  );

  await input.fill(description);
  await input.press('Enter');

  await expect(page.getByRole('status')).toHaveText(FAILURE_COPY);
  await expect(input).toHaveValue(description);
  await expect(input).toBeFocused();
  await expect(page.getByText(description)).toHaveCount(0);

  await page.unroute(fail);
  await input.press('Enter');

  await expect(page.getByRole('listitem').first()).toContainText(description);
  await expect(input).toHaveValue('');
  await expect(page.getByRole('status')).toBeEmpty();
});
