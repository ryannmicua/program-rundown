import { test, expect, type BrowserContext } from '@playwright/test';
import { fixture } from '../test/support.js';
import { seedProduct } from '../src/demo/seed.js';

test('manages Event order and date grouping, and reads only Published Programs anonymously', async ({ page, browser }) => {
  const app = await fixture();
  let anonymous: BrowserContext | undefined;
  try {
    seedProduct({ APP_ENV: 'dev', PRODUCT_DB_PATH: app.config.productPath, DEV_COORDINATOR_ISSUER: app.config.testerIssuer, DEV_COORDINATOR_SUBJECT: app.config.testerSubject });
    await page.goto(`${app.origin}/signin`);
    await page.getByRole('link', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Events' })).toBeVisible();
    await page.getByRole('button', { name: 'Sabbath', exact: true }).click();
    await expect(page.getByLabel('Group Programs by their dates')).toBeChecked();
    const eventLink = page.getByRole('link', { name: 'Open anonymous Event reader' });
    const href = await eventLink.getAttribute('href');
    anonymous = await browser.newContext();
    const reader = await anonymous.newPage();
    await reader.goto(`${app.origin}${href}`, { waitUntil: 'domcontentloaded' });
    await expect(reader.getByRole('heading', { name: '2026-11-06' })).toBeVisible();
    await expect(reader.getByRole('heading', { name: '2026-11-07' })).toBeVisible();
    await expect(reader.getByRole('heading', { name: 'Undated' })).toHaveCount(0);
    const order = page.locator('.event-program-order');
    await expect(order.getByRole('listitem')).toHaveCount(6);
    await order.getByRole('button', { name: 'Move AY up' }).click();
    await page.getByRole('button', { name: 'Save Program order and links' }).click();
    await expect(page.getByRole('status')).toHaveText('Program order saved.');
    await page.getByLabel('Group Programs by their dates').uncheck();
    await expect(page.getByLabel('Group Programs by their dates')).not.toBeChecked();

    await reader.reload();
    await expect(reader.getByRole('heading', { name: 'Sabbath' })).toBeVisible();
    await expect(reader.getByRole('heading', { name: 'Programs' })).toBeVisible();
    await expect(reader.getByRole('link', { name: 'Vesper', exact: true })).toBeVisible();
    await expect(reader.getByRole('link', { name: 'Divine Worship', exact: true })).toBeVisible();
    await expect(reader.getByText('Sabbath School', { exact: true })).toHaveCount(0);
    await expect(reader.getByText('AY', { exact: true })).toHaveCount(0);
    await reader.getByRole('link', { name: 'Vesper', exact: true }).click();
    await expect(reader.getByRole('heading', { name: 'Vesper' })).toBeVisible();
  } finally {
    await anonymous?.close();
    await page.close();
    await app.close();
  }
});
