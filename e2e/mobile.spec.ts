import { expect, test } from '@playwright/test';
import { purgeTodos } from './support.ts';

test.use({ viewport: { width: 360, height: 640 } });

test.beforeEach(async ({ page, request }) => {
  await purgeTodos(request);
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Add' })).toBeEnabled();
});

async function noHorizontalOverflow(page: import('@playwright/test').Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

test('the main journey works at 360px with no horizontal overflow and 44px targets', async ({
  page,
}) => {
  const input = page.getByRole('textbox', { name: 'New todo' });
  const description = `A fairly long todo that must wrap on a phone without clipping ${Date.now()}`;
  await noHorizontalOverflow(page);

  await input.fill(description);
  await input.press('Enter');
  const box = page.getByRole('checkbox', { name: description });
  await expect(box).toBeVisible();
  await noHorizontalOverflow(page);

  for (const control of [
    input,
    page.getByRole('button', { name: 'Add' }),
    page.getByText(description),
    page.getByRole('button', { name: `Delete ${description}` }),
  ]) {
    const size = await control.boundingBox();
    expect(size?.height).toBeGreaterThanOrEqual(44);
    expect(size?.width).toBeGreaterThanOrEqual(44);
  }

  await box.click();
  await expect(box).toBeChecked();
  await page.getByRole('button', { name: `Delete ${description}` }).click();
  await expect(page.getByText(description)).toHaveCount(0);
  await noHorizontalOverflow(page);
});

test('no horizontal overflow between 320px and 1920px', async ({ page, request }) => {
  await request.post('/api/v1/todos', { data: { description: 'x'.repeat(200) } });
  await page.reload();
  for (const width of [320, 360, 640, 1280, 1920]) {
    await page.setViewportSize({ width, height: 800 });
    await noHorizontalOverflow(page);
  }
});
