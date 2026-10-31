import { test, expect } from '@playwright/test';
import { fixture } from '../test/support.js';

test('coordinator publishes a Program that readers can share and print on narrow screens', async ({ page }) => {
  const app = await fixture();
  try {
    await page.goto(`${app.origin}/signin`);
    await page.getByRole('link', { name: 'Sign in', exact: true }).click();
    await page.getByRole('link', { name: 'New Program' }).click();
    await page.getByLabel('Title', { exact: true }).fill('Community Program');
    await page.getByRole('button', { name: 'Save Draft' }).click();
    await expect(page.getByRole('heading', { name: 'Community Program' })).toBeVisible();
    await page.getByRole('button', { name: 'Add Section' }).click();
    await page.getByLabel('Section heading (optional)').fill('Welcome');
    await page.getByRole('button', { name: 'Add Item' }).click();
    await page.getByLabel('Item label').fill('Opening Remarks');
    await page.getByRole('button', { name: 'Save rundown' }).click();
    await expect(page.getByRole('status')).toHaveText('Rundown saved.');
    const draftId = /\/programs\/(\d+)$/.exec(page.url())![1];
    expect((await page.request.get(`${app.origin}/api/public/programs/${draftId}`)).status()).toBe(404);
    await page.getByRole('button', { name: 'Publish Program' }).click();
    await expect(page.getByText('Program published. Anyone with the link can read and print it.')).toBeVisible();
    const link = page.getByRole('link', { name: new RegExp(`/p/${draftId}$`) });
    await expect(link).toBeVisible();
    await page.setViewportSize({ width: 360, height: 800 });
    await link.click();
    await expect(page.getByRole('heading', { name: 'Community Program' })).toBeVisible();
    await expect(page.getByText('Opening Remarks')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Print' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const anonymous = await page.context().newPage();
    try {
      await anonymous.goto(`${app.origin}/p/${draftId}`);
      await expect(anonymous.getByRole('heading', { name: 'Community Program' })).toBeVisible();
      await anonymous.evaluate(() => { window.print = () => { document.documentElement.dataset.printed = 'yes'; }; });
      await anonymous.getByRole('button', { name: 'Print' }).click();
      await expect(anonymous.locator('html')).toHaveAttribute('data-printed', 'yes');
    } finally { await anonymous.close(); }
  } finally { await app.close(); }
});
