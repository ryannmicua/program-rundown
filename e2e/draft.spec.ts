import { test, expect } from '@playwright/test';
import { fixture } from '../test/support.js';

test('coordinator creates, reopens and safely edits standalone Drafts at desktop and mobile widths', async ({ page }, testInfo) => {
  const app = await fixture();
  const browserErrors: string[] = [];
  page.on('pageerror', error => browserErrors.push(error.message));
  try {
    await page.goto(`${app.origin}/signin`);
    await page.getByRole('link', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'No programs yet' })).toBeVisible();
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await page.getByRole('link', { name: 'New Program' }).click();
      await page.getByLabel('Title', { exact: true }).fill(`Gathering ${width}`);
      // The new Header is keyboard navigable, with no date/time prerequisite.
      await page.getByLabel('Title', { exact: true }).press('Tab');
      await expect(page.getByLabel('Date', { exact: true })).toBeFocused();
      await page.getByRole('button', { name: 'Save Draft' }).click();
      await expect(page).toHaveURL(/\/programs\/\d+$/);
      const draftUrl = page.url();
      await expect(page.getByRole('heading', { name: `Gathering ${width}` })).toBeVisible();
      await expect(page.getByText('No date', { exact: true })).toBeVisible();
      for (const [start, end] of [['09:00', ''], ['', '12:00'], ['09:00', '12:00'], ['', '']]) {
        await page.getByLabel('Start time', { exact: true }).fill(start);
        await page.getByLabel('End time', { exact: true }).fill(end);
        await page.getByRole('button', { name: 'Save Draft' }).click();
        await expect(page.getByRole('status')).toHaveText('Draft saved.');
        await page.reload();
        await expect(page.getByLabel('Start time', { exact: true })).toHaveValue(start);
        await expect(page.getByLabel('End time', { exact: true })).toHaveValue(end);
      }
      await page.getByLabel('Title', { exact: true }).fill('  ');
      await page.getByRole('button', { name: 'Save Draft' }).click();
      await expect(page.getByRole('alert')).toContainText('Check the Header fields');
      await expect(page.getByText('Enter a title between 1 and 200 characters.')).toBeVisible();
      await page.getByLabel('Title', { exact: true }).fill(`Gathering ${width}`);
      await page.getByRole('button', { name: 'Save Draft' }).click();
      await expect(page.getByRole('status')).toHaveText('Draft saved.');

      const other = await page.context().newPage();
      try {
        await other.goto(draftUrl);
        await other.getByLabel('Title', { exact: true }).fill('Saved in another tab');
        await other.getByRole('button', { name: 'Save Draft' }).click();
        await expect(other.getByRole('status')).toHaveText('Draft saved.');
        await page.getByLabel('Title', { exact: true }).fill(`Kept entries ${width}`);
        await page.getByRole('button', { name: 'Save Draft' }).click();
        await expect(page.getByRole('alert')).toContainText('This Draft changed');
        await expect(page.getByLabel('Title', { exact: true })).toHaveValue(`Kept entries ${width}`);
        await page.getByRole('button', { name: 'Reload saved Draft' }).click();
        await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Saved in another tab');
        await page.getByRole('button', { name: 'Reapply my entries' }).click();
        await page.getByRole('button', { name: 'Save Draft' }).click();
        await expect(page.getByRole('status')).toHaveText('Draft saved.');
      } finally { await other.close(); }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`draft-${width}.png`), fullPage: true });
      await page.getByRole('button', { name: 'Sign out', exact: true }).click();
      await expect(page.getByRole('link', { name: 'Sign in', exact: true })).toBeVisible();
      await app.restart();
      await page.getByRole('link', { name: 'Sign in', exact: true }).click();
      await page.getByRole('link', { name: `Kept entries ${width}`, exact: true }).click();
      await expect(page).toHaveURL(draftUrl);
      await expect(page.getByLabel('Title', { exact: true })).toHaveValue(`Kept entries ${width}`);
      await page.getByRole('link', { name: 'Your Programs', exact: false }).click();
    }
    expect(browserErrors).toEqual([]);
  } finally { await app.close(); }
});
