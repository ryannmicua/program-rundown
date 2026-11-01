import { test, expect } from '@playwright/test';
import { fixture } from '../test/support.js';
import { seedProduct } from '../src/demo/seed.js';
import { openProduct } from '../src/db/product.js';

test('lists seeded Sabbath Participants, filters to Divine Worship, and opens the source Part', async ({ page }) => {
  const app = await fixture();
  try {
    seedProduct({ APP_ENV: 'dev', PRODUCT_DB_PATH: app.config.productPath, DEV_COORDINATOR_ISSUER: app.config.testerIssuer, DEV_COORDINATOR_SUBJECT: app.config.testerSubject });
    const db = openProduct(app.config.productPath);
    let eventId: number, worshipId: number;
    try {
      eventId = Number((db.prepare("SELECT id FROM events WHERE seed_key = 'demo-event-sabbath'").get() as { id: number }).id);
      worshipId = Number((db.prepare("SELECT id FROM programs WHERE seed_key = 'demo-divine-worship'").get() as { id: number }).id);
    } finally { db.close(); }
    await page.goto(`${app.origin}/signin`);
    await page.getByRole('link', { name: 'Sign in', exact: true }).click();
    await page.goto(`${app.origin}/events/${eventId}`);
    await page.getByRole('link', { name: 'View Event Participants' }).click();
    await expect(page).toHaveURL(`${app.origin}/events/${eventId}/participants`);
    await expect(page.getByRole('heading', { name: 'Dr. Alex Placeholder' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Vesper · Welcome' })).toBeVisible();
    await page.getByLabel('Filter by Program').selectOption(String(worshipId));
    await expect(page.getByRole('link', { name: 'Vesper · Welcome' })).toHaveCount(0);
    const source = page.getByRole('link', { name: /^Divine Worship · / }).first();
    await expect(source).toBeVisible();
    await source.click();
    await expect(page).toHaveURL(new RegExp(`/programs/${worshipId}#part-`));
    const part = page.locator(`[id="${decodeURIComponent(new URL(page.url()).hash.slice(1))}"]`);
    await expect(part).toBeInViewport();
  } finally { await page.close(); await app.close(); }
});
