import { expect, test, type Route } from '@playwright/test';
import { TODOS_PATH } from '@todo/contract';

import {
  EMPTY_STATE_TEXT,
  LOAD_ERROR_TEXT,
  LOADING_TEXT,
  RETRY_LABEL,
  purgeTodos,
} from './support.ts';

const isTodosPath = (url: URL) => url.pathname === TODOS_PATH;

// Aborts the list GET only; every other method on the path reaches the api.
const abortListGet = (route: Route) =>
  route.request().method() === 'GET' ? route.abort() : route.continue();

test.beforeEach(async ({ request }) => {
  await purgeTodos(request);
});

test('Error State with Retry replaces the list when the load fails', async ({ page }) => {
  await page.route(isTodosPath, abortListGet);
  await page.goto('/');

  const status = page.getByRole('status');
  await expect(status).toContainText(LOAD_ERROR_TEXT);
  await expect(status.getByRole('button', { name: RETRY_LABEL })).toBeVisible();
  await expect(page.getByText(EMPTY_STATE_TEXT)).not.toBeVisible();
  await expect(page.getByText(LOADING_TEXT)).toHaveCount(0);
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);

  await page.unroute(isTodosPath, abortListGet);
  const reloaded = page.waitForResponse(
    (res) => isTodosPath(new URL(res.url())) && res.ok() && res.request().method() === 'GET',
  );
  await status.getByRole('button', { name: RETRY_LABEL }).click();
  await reloaded;

  await expect(page.getByText(EMPTY_STATE_TEXT)).toBeVisible();
  await expect(status).toBeEmpty();
});
