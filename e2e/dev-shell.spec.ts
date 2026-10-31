import { test, expect } from '@playwright/test';
import { fixture } from '../test/support.js';
test('dev shell: anonymous page note, PKCE sign-in, readback, picking, persistence and done/reopen', async ({ page }, testInfo) => {
  const app = await fixture();
  const browserErrors: string[] = [];
  page.on('pageerror', error => browserErrors.push(error.message));
  try {
    await page.goto(`${app.origin}/signin`);
    await page.getByRole('button', { name: 'Feedback', exact: true }).click();
    await page.getByRole('link', { name: 'Sign in', exact: true }).click();
    await expect(page).toHaveURL(`${app.origin}/signin`);
    await page.getByLabel('Your note').fill('The sign-in button is clear.');
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Your note was sent');
    await page.getByRole('link', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'No programs yet' })).toBeVisible();
    await page.getByRole('link', { name: 'View feedback notes' }).click();
    await expect(page.getByText('The sign-in button is clear.')).toBeVisible();
    await page.getByRole('button', { name: 'Mark done' }).click();
    await expect(page.getByRole('button', { name: 'Reopen' })).toBeVisible();
    await page.getByRole('button', { name: 'Reopen' }).click();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Mark done' })).toBeVisible();
    await app.restart();
    await page.reload();
    await expect(page.getByText('The sign-in button is clear.')).toBeVisible();
    await page.getByRole('link', { name: 'Open page context' }).click();
    await expect(page.getByRole('dialog', { name: 'Saved feedback' })).toContainText('The sign-in button is clear.');
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    for (const width of [1280, 768, 390]) {
      await page.setViewportSize({ width, height: 844 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`shell-${width}.png`), fullPage: true });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('button', { name: 'Feedback', exact: true }).click();
    await page.getByRole('button', { name: 'General note' }).click();
    await page.getByLabel('Your note').fill('A general mobile note.');
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Your note was sent');
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page.getByRole('link', { name: 'Sign in', exact: true })).toBeVisible();
    expect(browserErrors).toEqual([]);
  } finally { await app.close(); }
});
