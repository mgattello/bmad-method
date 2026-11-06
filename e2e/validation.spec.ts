import { expect, test } from '@playwright/test';
import { DESCRIPTION_MAX, FAILURE_COPY, VALIDATION_COPY, purgeTodos } from './support.ts';

test.beforeEach(async ({ page, request }) => {
  await purgeTodos(request);
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Add' })).toBeEnabled();
});

for (const [label, value] of [
  ['an empty', ''],
  ['a whitespace-only', '   '],
  ['an over-the-limit', 'x'.repeat(DESCRIPTION_MAX + 1)],
] as const) {
  test(`${label} description is rejected locally`, async ({ page }) => {
    const input = page.getByRole('textbox', { name: 'New todo' });
    const before = await page.getByRole('listitem').count();
    const requests: string[] = [];
    page.on('request', (req) => {
      if (req.method() === 'POST') requests.push(req.url());
    });

    await input.fill(value);
    await input.press('Enter');

    const status = page.getByRole('status');
    await expect(status).toHaveText(VALIDATION_COPY);
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    const describedBy = await input.getAttribute('aria-describedby');
    expect(describedBy).not.toBeNull();
    await expect(page.locator(`[id="${describedBy}"]`)).toHaveText(VALIDATION_COPY);
    await expect(input).toHaveValue(value);
    await expect(input).toBeFocused();
    await expect(page.getByRole('listitem')).toHaveCount(before);
    expect(requests).toEqual([]);
  });
}

test('a server VALIDATION_ERROR shows the same copy and never the server message', async ({
  page,
}) => {
  await page.route('**/api/v1/todos', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    await route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({ code: 'VALIDATION_ERROR', message: 'server says no' }),
    });
  });
  const input = page.getByRole('textbox', { name: 'New todo' });
  const before = await page.getByRole('listitem').count();

  await input.fill('Buy milk');
  await page.getByRole('button', { name: 'Add' }).click();

  await expect(page.getByRole('status')).toHaveText(VALIDATION_COPY);
  await expect(input).toHaveAttribute('aria-invalid', 'true');
  const describedBy = await input.getAttribute('aria-describedby');
  expect(describedBy).not.toBeNull();
  await expect(page.locator(`[id="${describedBy}"]`)).toHaveText(VALIDATION_COPY);
  await expect(input).toBeFocused();
  await expect(page.getByText('server says no')).toHaveCount(0);
  await expect(input).toHaveValue('Buy milk');
  await expect(page.getByRole('listitem')).toHaveCount(before);
});

test('a 502 keeps the typed text and focus and names the add action', async ({ page }) => {
  await page.route('**/api/v1/todos', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    await route.fulfill({
      status: 502,
      contentType: 'text/html',
      body: '<html><body>502 Bad Gateway</body></html>',
    });
  });
  const input = page.getByRole('textbox', { name: 'New todo' });
  const before = await page.getByRole('listitem').count();

  await input.fill('Buy milk');
  await input.press('Enter');

  await expect(page.getByRole('status')).toHaveText(FAILURE_COPY);
  await expect(input).not.toHaveAttribute('aria-invalid', 'true');
  await expect(input).not.toHaveAttribute('aria-describedby');
  await expect(input).toHaveValue('Buy milk');
  await expect(input).toBeFocused();
  await expect(page.getByRole('button', { name: 'Add' })).toBeEnabled();
  await expect(page.getByRole('listitem')).toHaveCount(before);
  await expect(page.getByText('Bad Gateway')).toHaveCount(0);
});
