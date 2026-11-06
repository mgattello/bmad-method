import { expect, test } from '@playwright/test';
import { purgeTodos } from './support.ts';

test('a description with HTML and script renders as literal text and runs nothing', async ({
  page,
  request,
}) => {
  await purgeTodos(request);
  const dialogs: string[] = [];
  page.on('dialog', (dialog) => {
    dialogs.push(dialog.message());
    void dialog.dismiss();
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Add' })).toBeEnabled();
  const description = '<img src=x onerror=alert(1)><script>alert(2)</script><b>bold</b>';

  const input = page.getByRole('textbox', { name: 'New todo' });
  await input.fill(description);
  await input.press('Enter');

  const item = page.getByRole('listitem').first();
  await expect(item).toContainText(description);
  await page.reload();
  await expect(page.getByRole('listitem').first()).toContainText(description);
  expect(await page.locator('li img, li script, li b').count()).toBe(0);
  expect(dialogs).toEqual([]);
});
