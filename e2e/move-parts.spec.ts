import { test, expect } from '@playwright/test';
import { fixture } from '../test/support.js';
import { seedProduct } from '../src/demo/seed.js';
import { openProduct } from '../src/db/product.js';

test('moves a shared Participant between Sabbath Programs and keeps occupied destination Parts', async ({ page }) => {
  const app = await fixture();
  try {
    seedProduct({ APP_ENV: 'dev', PRODUCT_DB_PATH: app.config.productPath, DEV_COORDINATOR_ISSUER: app.config.testerIssuer, DEV_COORDINATOR_SUBJECT: app.config.testerSubject });
    const db = openProduct(app.config.productPath);
    let sourceId: number, destinationId: number;
    try {
      sourceId = Number((db.prepare("SELECT id FROM programs WHERE seed_key = 'demo-divine-worship'").get() as { id: number }).id);
      destinationId = Number((db.prepare("SELECT id FROM programs WHERE seed_key = 'demo-sabbath-school'").get() as { id: number }).id);
    } finally { db.close(); }
    await page.goto(`${app.origin}/signin`);
    await page.getByRole('link', { name: 'Sign in', exact: true }).click();
    await page.goto(`${app.origin}/programs/${sourceId}`);
    const source = page.getByRole('region', { name: 'Participants for Welcome' });
    await source.getByRole('button', { name: 'Move or copy Part' }).click();
    await page.getByLabel('Destination Program').selectOption(String(destinationId));
    await expect(page.getByText('Existing destination Parts will stay in place:')).toBeVisible();
    await expect(page.getByRole('list').getByText('Congregation Placeholder')).toBeVisible();
    await source.getByRole('button', { name: 'Move selected Part here' }).click();
    await expect(page.getByRole('status')).toContainText('Part moved to Main Program');
    await expect(source.locator('.part-fields')).toHaveCount(0);
    await page.goto(`${app.origin}/programs/${destinationId}`);
    const target = page.getByRole('region', { name: 'Participants for Main Program' });
    await expect(target.locator('.part-fields')).toHaveCount(3);
  } finally { await page.close(); await app.close(); }
});
