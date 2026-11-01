import { test, expect } from '@playwright/test';
import { fixture } from '../test/support.js';
import { seedProduct } from '../src/demo/seed.js';

test('saves an owned template, previews its snapshot, and creates a Draft in an Event', async ({ page }) => {
  const app = await fixture();
  try {
    seedProduct({ APP_ENV: 'dev', PRODUCT_DB_PATH: app.config.productPath, DEV_COORDINATOR_ISSUER: app.config.testerIssuer, DEV_COORDINATOR_SUBJECT: app.config.testerSubject });
    await page.goto(`${app.origin}/signin`);
    await page.getByRole('link', { name: 'Sign in', exact: true }).click();
    await page.getByRole('link', { name: 'Community Gathering' }).click();
    await page.getByLabel('Template name').fill('Browser Placeholder Template');
    await page.getByRole('button', { name: 'Save as template' }).click();
    await expect(page.getByRole('status')).toHaveText('Browser Placeholder Template saved. You can use it across your Events.');

    await page.goto(`${app.origin}/templates`);
    await page.getByRole('listitem').filter({ hasText: 'Browser Placeholder Template' }).getByRole('link', { name: 'Preview and create Draft' }).click();
    await expect(page.getByRole('heading', { name: 'Preview: Browser Placeholder Template' })).toBeVisible();
    await expect(page.locator('.program-renderer').getByText(/A song of welcome/)).toBeVisible();
    await page.getByLabel('Title', { exact: true }).fill('Template Draft Placeholder');
    await page.getByLabel('Date (optional)').fill('2026-11-08');
    await page.getByLabel('Event (optional)').selectOption({ label: 'Sabbath' });
    await page.getByRole('button', { name: 'Create Draft' }).click();
    await expect(page.getByText('Draft created from template. Review the rundown and save your changes when ready.', { exact: true })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toHaveValue('Template Draft Placeholder');
    await expect(page.locator('.rundown-preview').getByText(/A song of welcome/)).toBeVisible();
    await expect(page.locator('.program-editor .eyebrow')).toContainText('Draft');
  } finally {
    await page.close();
    await app.close();
  }
});
