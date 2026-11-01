import { expect, test } from '@playwright/test';
import { fixture } from '../test/support.js';

test('coordinator reviews an unnamed Part, opens its editor, and sees the saved assignment leave the list', async ({ page }) => {
  const app = await fixture();
  try {
    await page.goto(`${app.origin}/signin`);
    await page.getByRole('link', { name: 'Sign in', exact: true }).click();
    await page.getByRole('link', { name: 'New Program' }).click();
    await page.getByLabel('Title', { exact: true }).fill('Review Placeholder Program');
    await page.getByRole('button', { name: 'Save Draft' }).click();
    await page.getByRole('button', { name: 'Add top-level Section' }).click();
    const section = page.getByRole('region', { name: 'Section 1: Unheaded' });
    await section.getByRole('button', { name: 'Add Item' }).click();
    await page.getByLabel('Item label').fill('Review Placeholder Item');
    await page.getByRole('button', { name: 'Save rundown' }).click();
    const target = page.getByRole('region', { name: 'Participants for Review Placeholder Item' });
    await target.getByRole('button', { name: 'Add participant' }).click();
    await page.getByRole('button', { name: 'Save Parts and Footer' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Parts and Footer saved.' })).toBeVisible();
    await page.getByRole('link', { name: 'Assignments awaiting a name' }).click();
    await expect(page.getByRole('heading', { name: 'Assignments awaiting a name' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Opening › Review Placeholder Item' })).toBeVisible();
    await page.getByRole('link', { name: 'Open Program editor' }).click();
    await expect(page).toHaveURL(/#part-target-item-/);
    await page.getByLabel('Intentionally not listed').check();
    await page.getByRole('button', { name: 'Save Parts and Footer' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Parts and Footer saved.' })).toBeVisible();
    await page.goBack();
    await expect(page.getByText('All assignments have names')).toBeVisible();
  } finally { await app.close(); }
});
