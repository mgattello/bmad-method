import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { TODOS_PATH } from '@todo/contract';
import { purgeTodos } from './support.ts';

const VIEWPORTS = [
  { name: '360px', width: 360, height: 800 },
  { name: '1280px', width: 1280, height: 800 },
];

// Critical and serious fail the run; moderate and minor are printed for the report.
async function audit(page: Page, state: string) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  for (const v of violations.filter((x) => x.impact !== 'critical' && x.impact !== 'serious')) {
    console.log(`a11y ${state}: ${v.impact} ${v.id} (${v.nodes.length} nodes)`);
  }
  const blocking = violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
  expect(
    blocking.map((v) => `${v.impact} ${v.id}: ${v.nodes.map((n) => n.target).join(' ')}`),
    `${state} has critical or serious violations`,
  ).toEqual([]);
}

for (const viewport of VIEWPORTS) {
  test.describe(`axe at ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test.beforeEach(async ({ request }) => {
      await purgeTodos(request);
    });

    test('Empty State', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByText('No todos yet')).toBeVisible();
      await audit(page, `empty ${viewport.name}`);
    });

    test('populated and Completed states', async ({ page, request }) => {
      await request.post(TODOS_PATH, { data: { description: 'Open item' } });
      const done = await request.post(TODOS_PATH, { data: { description: 'Finished item' } });
      const { id } = (await done.json()) as { id: string };
      await request.patch(`${TODOS_PATH}/${id}`, { data: { completed: true } });
      await page.goto('/');
      await expect(page.getByRole('checkbox', { name: 'Finished item' })).toBeChecked();
      await audit(page, `populated ${viewport.name}`);
    });

    test('validation error', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByRole('button', { name: 'Add' })).toBeEnabled();
      await page.getByRole('textbox', { name: 'New todo' }).press('Enter');
      await expect(page.getByRole('status')).not.toBeEmpty();
      await audit(page, `validation ${viewport.name}`);
    });

    test('load error', async ({ page }) => {
      await page.route(
        (url) => url.pathname === TODOS_PATH,
        (route) => route.abort(),
      );
      await page.goto('/');
      await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
      await audit(page, `load-error ${viewport.name}`);
    });
  });
}
