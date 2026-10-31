import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ContentEditor } from './ContentEditor.js';
import type { ContentNode } from '../../../src/domain/content.js';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const program = { id: 1, title: 'Gathering', date: null, startTime: null, endTime: null, status: 'Draft' as const, version: 1 };
const section: ContentNode = { id: 'opening', parentId: null, kind: 'section', label: 'Opening', detail: '', startTime: '09:00', endTime: null };
const item: ContentNode = { id: 'prayer', parentId: 'opening', kind: 'item', label: '*Introit', detail: '<script>example</script>\nSecond line', startTime: null, endTime: '09:10' };

it('keeps grouping, literal labels and multiline Detail in a readable preview', () => {
  render(<ContentEditor program={program} initialNodes={[section, item, { ...section, id: 'closing', label: '', startTime: null }]} onSaved={vi.fn()} reload={vi.fn()}/>);
  const preview = screen.getByRole('region', { name: 'Rundown preview' });
  expect(within(preview).getByText('*Introit')).toBeDefined();
  expect(within(preview).getAllByRole('listitem')).toHaveLength(1);
  expect(within(preview).getByText(/<script>example<\/script>/).textContent).toContain('\nSecond line');
  expect(within(preview).getByRole('region', { name: 'Unheaded Section' })).toBeDefined();
  expect(preview.querySelector('script')).toBeNull();
});

it('keeps entries on a network error and allows retry', async () => {
  const fetcher = vi.fn().mockRejectedValueOnce(Error('offline')).mockResolvedValueOnce({ ok: true, json: async () => ({ program: { ...program, version: 2 }, nodes: [section, { ...item, label: 'Edited prayer' }] }) });
  vi.stubGlobal('fetch', fetcher);
  const saved = vi.fn();
  render(<ContentEditor program={program} initialNodes={[section, item]} onSaved={saved} reload={vi.fn()}/>);
  fireEvent.change(screen.getByLabelText('Item label'), { target: { value: 'Edited prayer' } });
  fireEvent.submit(screen.getByRole('form', { name: 'Rundown' }));
  await screen.findByRole('alert');
  expect((screen.getByLabelText('Item label') as HTMLInputElement).value).toBe('Edited prayer');
  fireEvent.submit(screen.getByRole('form', { name: 'Rundown' }));
  await screen.findByText('Rundown saved.');
  expect(saved).toHaveBeenCalledWith({ ...program, version: 2 });
});

it('preserves conflict entries, reloads explicitly, and reapplies against the current revision', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce({ ok: false, status: 409, json: async () => ({ error: 'This Draft changed.' }) }).mockResolvedValueOnce({ ok: true, json: async () => ({ program: { ...program, version: 3 }, nodes: [section, item] }) });
  vi.stubGlobal('fetch', fetcher);
  const reload = vi.fn();
  const view = render(<ContentEditor program={program} initialNodes={[section, item]} onSaved={vi.fn()} reload={reload}/>);
  fireEvent.change(screen.getByLabelText('Item label'), { target: { value: 'Kept prayer' } });
  fireEvent.submit(screen.getByRole('form', { name: 'Rundown' }));
  await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button', { name: 'Reload saved rundown' }));
  expect(reload).toHaveBeenCalledOnce();
  view.rerender(<ContentEditor program={{ ...program, version: 2 }} initialNodes={[section, item]} onSaved={vi.fn()} reload={reload}/>);
  fireEvent.click(await screen.findByRole('button', { name: 'Reapply my rundown entries' }));
  expect((screen.getByLabelText('Item label') as HTMLInputElement).value).toBe('Kept prayer');
  fireEvent.submit(screen.getByRole('form', { name: 'Rundown' }));
  await screen.findByText('Rundown saved.');
  expect(JSON.parse(fetcher.mock.calls[1][1].body)).toMatchObject({ version: 2, nodes: [section, { ...item, label: 'Kept prayer' }] });
});
