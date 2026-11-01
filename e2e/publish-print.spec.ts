import { test, expect } from '@playwright/test';
import { fixture } from '../test/support.js';

test('coordinator publishes a Program that readers can share and print on narrow screens', async ({ page }) => {
  const app = await fixture();
  try {
    await page.goto(`${app.origin}/signin`);
    await page.getByRole('link', { name: 'Sign in', exact: true }).click();
    await page.getByRole('link', { name: 'New Program' }).click();
    await page.getByLabel('Title', { exact: true }).fill('Community Program');
    await page.getByLabel('Date', { exact: true }).fill('2026-11-07');
    await page.getByLabel('Start time', { exact: true }).fill('09:00');
    await page.getByLabel('End time', { exact: true }).fill('12:00');
    await page.getByRole('button', { name: 'Save Draft' }).click();
    await expect(page.getByRole('heading', { name: 'Community Program' })).toBeVisible();
    await page.getByRole('button', { name: 'Add top-level Section', exact: true }).click();
    await page.getByLabel('Section heading (optional)').fill('Welcome');
    await page.getByRole('button', { name: 'Add Item' }).click();
    await page.getByLabel('Item label').fill('Opening Remarks');
    await page.getByLabel('Detail (optional)').fill('Gather together.');
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
    await expect(page.getByText('Saturday, November 7, 2026 | 9:00 A.M. – 12:00 P.M.')).toBeVisible();
    await expect(page.getByText('Gather together.')).toBeVisible();
    expect(await page.locator('.preview-section .note-text').evaluate(element => getComputedStyle(element).textAlign)).toBe('center');
    await expect(page.getByRole('button', { name: 'Print' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const anonymous = await page.context().newPage();
    try {
      await anonymous.goto(`${app.origin}/p/${draftId}`);
      await expect(anonymous.getByRole('heading', { name: 'Community Program' })).toBeVisible();
      await anonymous.evaluate(() => { window.print = () => { document.documentElement.dataset.printed = 'yes'; }; });
      await anonymous.getByRole('button', { name: 'Print' }).click();
      await expect(anonymous.locator('html')).toHaveAttribute('data-printed', 'yes');
      await anonymous.emulateMedia({ media: 'print' });
      expect(await anonymous.locator('.reader-actions').evaluate(element => getComputedStyle(element).display)).toBe('none');
      expect(await anonymous.locator('.preview-section li').evaluate(element => getComputedStyle(element).breakInside)).toBe('avoid');
      expect(await anonymous.locator('.reader-listing h1').evaluate(element => getComputedStyle(element).textTransform)).toBe('uppercase');
    } finally { await anonymous.close(); }
    const offlineReader = await page.context().newPage();
    try {
      await offlineReader.addInitScript(() => Object.defineProperty(navigator, 'onLine', { value: false }));
      await offlineReader.route('**/api/public/programs/**', route => route.abort());
      await offlineReader.goto(`${app.origin}/p/${draftId}`);
      await expect(offlineReader.getByRole('heading', { name: 'You’re offline' })).toBeVisible();
      await expect(offlineReader.getByRole('button', { name: 'Try again' })).toBeVisible();
    } finally { await offlineReader.close(); }
    const errorReader = await page.context().newPage();
    try {
      await errorReader.route('**/api/public/programs/**', route => route.abort());
      await errorReader.goto(`${app.origin}/p/${draftId}`);
      await expect(errorReader.getByRole('heading', { name: 'Could not load this Program' })).toBeVisible();
      await expect(errorReader.getByRole('button', { name: 'Try again' })).toBeVisible();
    } finally { await errorReader.close(); }
    const missingReader = await page.context().newPage();
    try {
      await missingReader.goto(`${app.origin}/p/999999`);
      await expect(missingReader.getByRole('heading', { name: 'Program not found' })).toBeVisible();
    } finally { await missingReader.close(); }
    const slowReader = await page.context().newPage();
    try {
      await slowReader.route('**/api/public/programs/**', async route => {
        await new Promise(resolve => setTimeout(resolve, 2100));
        await route.continue();
      });
      await slowReader.goto(`${app.origin}/p/${draftId}`);
      await expect(slowReader.getByRole('status')).toContainText('Still loading this Program');
      await expect(slowReader.locator('.loading-progress')).toBeVisible();
      await expect(slowReader.getByRole('heading', { name: 'Community Program' })).toBeVisible();
    } finally { await slowReader.close(); }
    const empty = await page.request.post(`${app.origin}/api/programs`, { headers: { origin: app.origin }, data: { title: 'Empty Example' } });
    const { program: emptyProgram } = await empty.json();
    expect((await page.request.post(`${app.origin}/api/programs/${emptyProgram.id}/publish`, { headers: { origin: app.origin }, data: {} })).status()).toBe(200);
    const emptyReader = await page.context().newPage();
    try {
      await emptyReader.goto(`${app.origin}/p/${emptyProgram.id}`);
      await expect(emptyReader.getByText('No rundown details have been added yet.')).toBeVisible();
    } finally { await emptyReader.close(); }
    const longTitle = await page.request.post(`${app.origin}/api/programs`, { headers: { origin: app.origin }, data: { title: 'Harvest Thanksgiving Service' } });
    const { program: longTitleProgram } = await longTitle.json();
    expect((await page.request.post(`${app.origin}/api/programs/${longTitleProgram.id}/publish`, { headers: { origin: app.origin }, data: {} })).status()).toBe(200);
    const phoneReader = await page.context().newPage();
    try {
      await phoneReader.setViewportSize({ width: 375, height: 800 });
      await phoneReader.goto(`${app.origin}/p/${longTitleProgram.id}`);
      const title = phoneReader.getByRole('heading', { name: 'Harvest Thanksgiving Service' });
      await expect(title).toBeVisible();
      const splitWords = await title.evaluate(element => {
        const text = element.firstChild!;
        const split: string[] = [];
        for (const match of text.textContent!.matchAll(/\S+/g)) {
          const range = document.createRange();
          range.setStart(text, match.index!);
          range.setEnd(text, match.index! + match[0].length);
          if (new Set([...range.getClientRects()].map(rect => Math.round(rect.top))).size > 1) split.push(match[0]);
        }
        return split;
      });
      expect(splitWords).toEqual([]);
    } finally { await phoneReader.close(); }
  } finally { await app.close(); }
});
