import { expect, test } from '@playwright/test';
import { purgeTodos, VALIDATION_COPY } from './support.ts';

test.describe('UJ-1 first use on a phone', () => {
  test.use({ viewport: { width: 360, height: 640 } });

  test('four creates, an empty line is refused, and the list is newest first', async ({
    page,
    request,
  }) => {
    await purgeTodos(request);
    await page.goto('/');
    await expect(page.getByText('No todos yet')).toBeVisible();
    const input = page.getByRole('textbox', { name: 'New todo' });
    const run = Date.now();
    const names = ['one', 'two', 'three', 'four'].map((n) => `UJ1 ${n} ${run}`);

    for (const [index, name] of names.entries()) {
      await input.fill(name);
      await input.press('Enter');
      await expect(page.getByRole('listitem')).toHaveCount(index + 1);
      if (index === 1) {
        await input.press('Enter');
        await expect(page.getByRole('status')).toHaveText(VALIDATION_COPY);
        await expect(page.getByRole('listitem')).toHaveCount(2);
      }
    }

    const items = page.getByRole('listitem');
    await expect(items.first()).toContainText(names[3]);
    await expect(items.last()).toContainText(names[0]);
    await expect(page.getByText('No todos yet')).toHaveCount(0);
  });
});

test('UJ-2 a second browser sees the same list after tick, untick, delete and refresh', async ({
  page,
  browser,
  request,
}) => {
  await purgeTodos(request);
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Add' })).toBeEnabled();
  const run = Date.now();
  const keep = `UJ2 keep ${run}`;
  const drop = `UJ2 drop ${run}`;
  const input = page.getByRole('textbox', { name: 'New todo' });
  for (const name of [keep, drop]) {
    await input.fill(name);
    await input.press('Enter');
    await expect(page.getByText(name)).toBeVisible();
  }

  const keepBox = page.getByRole('checkbox', { name: keep });
  await keepBox.click();
  await expect(keepBox).toBeChecked();
  await keepBox.click();
  await expect(keepBox).not.toBeChecked();
  await keepBox.click();
  await expect(keepBox).toBeChecked();
  await page.getByRole('button', { name: `Delete ${drop}` }).click();
  await expect(page.getByText(drop)).toHaveCount(0);

  const other = await browser.newContext();
  const second = await other.newPage();
  await second.goto(page.url());
  await expect(second.getByRole('listitem')).toHaveCount(1);
  await expect(second.getByRole('checkbox', { name: keep })).toBeChecked();
  await expect(second.getByText(drop)).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole('listitem')).toHaveCount(1);
  await expect(page.getByRole('checkbox', { name: keep })).toBeChecked();
  await other.close();
});
