import { test, expect } from '@playwright/test';
import { fixture } from '../test/support.js';

test('composes and reorders Sections and Items with pointer and keyboard controls, then reopens the saved rundown', async ({ page }, testInfo) => {
  const app = await fixture();
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(`${app.origin}/signin`);
    await page.getByRole('link', { name: 'Sign in', exact: true }).click();
    await page.getByRole('link', { name: 'New Program' }).click();
    await page.getByLabel('Title', { exact: true }).fill('Community Gathering');
    await page.getByRole('button', { name: 'Save Draft', exact: true }).click();
    const editor = page.getByRole('region', { name: 'Rundown editor' });
    await expect(editor.getByText('No Sections yet.', { exact: false })).toBeVisible();
    await editor.getByRole('button', { name: 'Add top-level Section', exact: true }).click();
    let opening = editor.getByRole('region', { name: 'Section 1: Unheaded', exact: true });
    await opening.getByLabel('Section heading (optional)').fill('Call to Worship');
    opening = editor.getByRole('region', { name: 'Section 1: Call to Worship', exact: true });
    await opening.getByLabel('Start time (optional)', { exact: true }).fill('09:00');
    for (const label of ['*Introit', 'Prayer']) {
      await opening.getByRole('button', { name: 'Add Item', exact: true }).click();
      const item = opening.getByRole('group', { name: 'Item: New Item', exact: true });
      await item.getByLabel('Item label', { exact: true }).fill(label);
    }
    const introit = opening.getByRole('group', { name: 'Item: *Introit', exact: true });
    await introit.getByLabel('Detail (optional)').fill('A long welcome line that wraps naturally on a small screen.\nA second line in the same Item.');
    await introit.getByLabel('End time (optional)').fill('09:10');
    await opening.getByRole('button', { name: 'Move Prayer up', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(opening.getByLabel('Item label').first()).toHaveValue('Prayer');
    await editor.getByRole('button', { name: 'Add top-level Section', exact: true }).click();
    let closing = editor.getByRole('region', { name: 'Section 2: Unheaded', exact: true });
    await closing.getByRole('button', { name: 'Add Item', exact: true }).click();
    await closing.getByLabel('Item label').fill('Closing Remarks');
    await editor.getByRole('button', { name: 'Move Unheaded Section up', exact: true }).click();
    await editor.getByRole('button', { name: 'Save rundown', exact: true }).click();
    await expect(editor.getByRole('status')).toHaveText('Rundown saved.');
    await page.reload();
    closing = editor.getByRole('region', { name: 'Section 1: Unheaded', exact: true });
    await expect(closing.getByLabel('Item label')).toHaveValue('Closing Remarks');
    opening = editor.getByRole('region', { name: 'Section 2: Call to Worship', exact: true });
    await expect(opening.getByLabel('Item label').nth(0)).toHaveValue('Prayer');
    await expect(opening.getByLabel('Item label').nth(1)).toHaveValue('*Introit');
    await expect(opening.getByRole('group', { name: 'Item: *Introit', exact: true }).getByLabel('End time (optional)')).toHaveValue('09:10');
    await expect(opening.getByLabel('Start time (optional)').first()).toHaveValue('09:00');
    const preview = editor.getByRole('region', { name: 'Rundown preview' });
    await expect(preview.getByRole('listitem')).toHaveCount(3);
    for (const width of [1280, 768, 390]) {
      await page.setViewportSize({ width, height: 844 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await editor.screenshot({ path: testInfo.outputPath(`compose-${width}.png`) });
    }
    await closing.getByRole('button', { name: 'Remove Item', exact: true }).click();
    await editor.getByRole('button', { name: 'Save rundown', exact: true }).click();
    await expect(editor.getByRole('status')).toHaveText('Rundown saved.');
    await page.reload();
    await expect(editor.getByRole('region', { name: 'Section 1: Unheaded', exact: true }).getByLabel('Item label')).toHaveCount(0);
    await editor.getByRole('region', { name: 'Section 2: Call to Worship', exact: true }).getByRole('button', { name: 'Remove Section and its contents', exact: true }).click();
    await editor.getByRole('button', { name: 'Save rundown', exact: true }).click();
    await expect(editor.getByRole('status')).toHaveText('Rundown saved.');
    await page.reload();
    await expect(editor.getByLabel('Section heading (optional)')).toHaveCount(1);
    expect(errors).toEqual([]);
  } finally { await app.close(); }
});
