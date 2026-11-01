import { expect, test } from '@playwright/test';
import { fixture } from '../test/support.js';

test('coordinator manages parallel direct Parts and Footer roles in the shared reader renderer', async ({ page }) => {
  const app = await fixture();
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(`${app.origin}/signin`);
    await page.getByRole('link', { name: 'Sign in', exact: true }).click();
    await page.getByRole('link', { name: 'New Program' }).click();
    await page.getByLabel('Title', { exact: true }).fill('U6 Placeholder Program');
    await page.getByRole('button', { name: 'Save Draft' }).click();
    await page.getByRole('button', { name: 'Add top-level Section' }).click();
    const section = page.getByRole('region', { name: 'Section 1: Unheaded' });
    await section.getByRole('button', { name: 'Add Item' }).click();
    await page.getByLabel('Item label').fill('Opening Song');
    await page.getByLabel('Detail (optional)').fill('Amazing Grace, Hymn #321');
    await page.getByRole('button', { name: 'Save rundown' }).click();
    await expect(page.getByRole('status')).toHaveText('Rundown saved.');

    const song = page.getByRole('region', { name: 'Participants for Opening Song' });
    await song.getByRole('button', { name: 'Add participant' }).click();
    await song.getByLabel('Participant form').selectOption('structured');
    await song.getByLabel('Role').fill('Song Leader');
    await song.getByLabel('Participant name').fill('Alex Placeholder');
    await song.getByRole('button', { name: 'Add participant' }).click();
    const ticks = song.getByLabel('Intentionally not listed');
    await ticks.nth(1).check();

    await page.getByRole('button', { name: 'Add Footer role' }).click();
    await page.getByLabel('Footer role title').fill('Pianist');
    const footer = page.getByRole('region', { name: 'Parts and Footer editor' }).getByRole('region', { name: 'Footer standing roles' }).locator('.part-target');
    await footer.getByLabel('Participant form').first().selectOption('text');
    await footer.getByLabel('Participant text').fill('Jamie Placeholder');
    await page.getByRole('button', { name: 'Save Parts and Footer' }).click();
    await expect(page.getByRole('region', { name: 'Parts and Footer editor' }).getByRole('status')).toContainText('Parts and Footer saved.');

    const listing = page.getByRole('article');
    await expect(listing.getByText('Opening Song', { exact: true })).toBeVisible();
    await expect(listing.getByText('Alex Placeholder', { exact: true })).toBeVisible();
    await expect(listing.getByText('Amazing Grace, Hymn #321', { exact: true })).toHaveCount(1);
    await expect(listing.getByRole('region', { name: 'Footer standing roles' }).getByText('Jamie Placeholder')).toBeVisible();
    await page.getByRole('button', { name: 'Publish Program' }).click();
    await expect(page.getByText('Program published.', { exact: false })).toBeVisible();
    const link = page.locator('.share-link a');
    const reader = await page.context().newPage();
    await reader.goto(new URL(await link.getAttribute('href') || '', app.origin).href);
    await expect(reader.getByText('Alex Placeholder', { exact: true })).toBeVisible();
    await expect(reader.getByText('Amazing Grace, Hymn #321', { exact: true })).toHaveCount(1);
    await expect(reader.getByRole('region', { name: 'Footer standing roles' }).getByText('Jamie Placeholder')).toBeVisible();
    expect(errors).toEqual([]);
  } finally { await app.close(); }
});
