import { expect, test } from '@playwright/test';
import { purgeTodos } from './support.ts';

test('create, tick, untick and delete work with the keyboard alone', async ({ page, request }) => {
  await purgeTodos(request);
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Add' })).toBeEnabled();
  const description = `Keyboard ${Date.now()}`;

  await page.keyboard.press('Tab');
  await expect(page.getByRole('textbox', { name: 'New todo' })).toBeFocused();
  await page.keyboard.type(description);
  await page.keyboard.press('Enter');
  const box = page.getByRole('checkbox', { name: description });
  await expect(box).toBeVisible();

  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Add' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(box).toBeFocused();
  await page.keyboard.press('Space');
  await expect(box).toBeChecked();
  await page.keyboard.press('Space');
  await expect(box).not.toBeChecked();

  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: `Delete ${description}` })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByText(description)).toHaveCount(0);
});
