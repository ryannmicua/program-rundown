import { expect, test } from '@playwright/test';
import { fixture } from '../test/support.js';

test('coordinator defines a Participant once, reuses it by role on Items, blocks, and Footer, and sees profile updates in the reader', async ({ page }) => {
  const app = await fixture();
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(`${app.origin}/signin`);
    await page.getByRole('link', { name: 'Sign in', exact: true }).click();
    await page.getByRole('link', { name: 'New Program' }).click();
    await page.getByLabel('Title', { exact: true }).fill('U7 Reuse Placeholder');
    await page.getByRole('button', { name: 'Save Draft' }).click();
    await page.getByRole('button', { name: 'Add top-level Section' }).click();
    const section = page.getByRole('region', { name: 'Section 1: Unheaded' });
    await section.getByRole('button', { name: 'Add Item' }).click();
    await page.getByLabel('Item label').fill('Opening Song');
    await page.getByLabel('Detail (optional)').fill('Amazing Grace');
    await page.getByRole('button', { name: 'Save rundown' }).click();
    await expect(page.getByRole('status')).toHaveText('Rundown saved.');

    await page.getByLabel('Definition role').fill('Speaker');
    await page.getByLabel('Definition name').fill('Alex Placeholder');
    await page.getByLabel('Honorific').fill('Dr.');
    await page.getByLabel('Position').fill('Education Director');
    await page.getByLabel('Organization').fill('Example Conference');
    await page.getByLabel('Participant subtitle').fill('Guest speaker');
    await page.getByRole('button', { name: 'Add saved Participant' }).click();
    await expect(page.getByRole('region', { name: 'Participant definitions' }).getByRole('status')).toContainText('Participant created.');
    await page.getByLabel('Search saved Participants').fill('Missing Placeholder');
    await expect(page.getByText(/No saved Participants match/)).toContainText('add a new definition above');
    await page.getByLabel('Search saved Participants').fill('Alex Placeholder');

    const item = page.getByRole('region', { name: 'Participants for Opening Song' });
    await item.getByRole('button', { name: 'Reuse a saved Participant' }).click();
    await item.getByLabel('Find Participant to reuse').fill('Missing Placeholder');
    await expect(item.getByText(/No saved Participants match/)).toContainText('add a definition above');
    await item.getByLabel('Find Participant to reuse').fill('');
    await item.getByLabel('Display reference by').selectOption('role');
    const block = page.getByRole('region', { name: 'Participants for Unheaded Section' });
    await block.getByRole('button', { name: 'Reuse a saved Participant' }).click();
    await block.getByLabel('Display reference by').selectOption('role');
    await page.getByRole('button', { name: 'Add Footer role' }).click();
    await page.getByLabel('Footer role title').fill('Presider');
    const footer = page.getByRole('region', { name: 'Footer standing roles' });
    await footer.getByRole('button', { name: 'Reuse a saved Participant' }).click();
    await footer.getByLabel('Display reference by').selectOption('role');
    await page.getByRole('button', { name: 'Save Parts and Footer' }).click();
    await expect(page.getByText('Parts and Footer saved. Review the Rundown preview, then publish when ready.')).toBeVisible();
    await expect(page.getByRole('article').getByText('Dr. Alex Placeholder')).toHaveCount(3);
    await expect(page.getByRole('article').getByText('Education Director, Example Conference')).toHaveCount(3);
    await expect(page.getByRole('article').getByText('Guest speaker')).toHaveCount(3);

    const definition = page.getByRole('listitem').filter({ hasText: 'Alex Placeholder' });
    await definition.getByRole('button', { name: 'Edit' }).click();
    await expect(page.getByText('This change will update references in these Programs:')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Participant definitions' }).getByText('U7 Reuse Placeholder (Draft)', { exact: true })).toBeVisible();
    await page.getByLabel('Position').fill('Senior Education Director');
    await page.getByRole('button', { name: 'Save Participant changes' }).click();
    await expect(page.getByRole('article').getByText('Senior Education Director, Example Conference')).toHaveCount(3);
    await page.getByRole('button', { name: 'Publish Program' }).click();
    await expect(page.getByText('Program published.')).toBeVisible();
    const link = page.locator('.share-link a');
    const reader = await page.context().newPage();
    await reader.goto(new URL(await link.getAttribute('href') || '', app.origin).href);
    await expect(reader.getByText('Senior Education Director, Example Conference')).toHaveCount(3);
    expect(errors).toEqual([]);
  } finally { await app.close(); }
});
