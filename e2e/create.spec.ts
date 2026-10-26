import { expect, test } from '@playwright/test';
import { purgeTodos } from './support/todos';

test.beforeEach(async ({ page, request }) => {
  await purgeTodos(request);
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Add' })).toBeEnabled();
});

test('Enter adds a todo at the top, clears the input and keeps focus', async ({ page }) => {
  const input = page.getByRole('textbox', { name: 'New todo' });
  const items = page.getByRole('listitem');
  const before = await items.count();
  const description = `Buy milk ${Date.now()}`;

  await input.fill(`  ${description}  `);
  await input.press('Enter');

  const list = page.getByRole('list', { name: 'Todos' });
  await expect(items).toHaveCount(before + 1);
  await expect(list.getByRole('listitem').first()).toContainText(description);
  await expect(input).toHaveValue('');
  await expect(input).toBeFocused();
  await expect(page.getByRole('status')).toBeEmpty();
});

test('the Add control adds a todo and returns focus to the input', async ({ page }) => {
  const input = page.getByRole('textbox', { name: 'New todo' });
  const items = page.getByRole('listitem');
  const before = await items.count();
  const description = `Walk the dog ${Date.now()}`;

  await input.fill(description);
  await page.getByRole('button', { name: 'Add' }).click();

  const list = page.getByRole('list', { name: 'Todos' });
  await expect(items).toHaveCount(before + 1);
  await expect(list.getByRole('listitem').first()).toContainText(description);
  await expect(input).toHaveValue('');
  await expect(input).toBeFocused();
});

test('a second todo appears first and both survive a reload', async ({ page }) => {
  const input = page.getByRole('textbox', { name: 'New todo' });
  const list = page.getByRole('list', { name: 'Todos' });
  const items = page.getByRole('listitem');
  const before = await items.count();
  const first = `First ${Date.now()}`;
  const second = `Second ${Date.now()}`;

  await input.fill(first);
  await input.press('Enter');
  await expect(items).toHaveCount(before + 1);
  await input.fill(second);
  await input.press('Enter');
  await expect(items).toHaveCount(before + 2);
  await expect(list.getByRole('listitem').first()).toContainText(second);

  await page.reload();

  await expect(items).toHaveCount(before + 2);
  await expect(list.getByRole('listitem').first()).toContainText(second);
  await expect(list.getByRole('listitem').nth(1)).toContainText(first);
});
