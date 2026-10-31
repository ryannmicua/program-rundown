import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Programs } from './Programs.js';
afterEach(() => { cleanup(); vi.unstubAllGlobals(); history.replaceState({}, '', '/'); });

it('keeps local entries on conflict and lets the coordinator explicitly reload the saved Header', async () => {
  history.replaceState({}, '', '/programs/1');
  const program = { id: 1, title: 'Original Gathering', date: null, startTime: null, endTime: null, status: 'Draft', version: 1 };
  const fetcher = vi.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ program }) })
    .mockResolvedValueOnce({ ok: false, status: 409, json: async () => ({ error: 'This Draft changed. Your entries are kept.' }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ program: { ...program, title: 'Other saved title', version: 2 } }) });
  vi.stubGlobal('fetch', fetcher);
  render(<Programs />);
  await screen.findByDisplayValue('Original Gathering');
  fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'My unsaved title' } });
  fireEvent.submit(screen.getByRole('form', { name: 'Program Header' }));
  await screen.findByRole('alert');
  expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('My unsaved title');
  fireEvent.click(screen.getByRole('button', { name: 'Reload saved Draft' }));
  await screen.findByDisplayValue('Other saved title');
  expect(JSON.parse(fetcher.mock.calls[1][1].body)).toMatchObject({ title: 'My unsaved title', version: 1 });
  expect(screen.getByText(/My unsaved title/)).toBeDefined();
});

it('shows field errors without losing a new Header', async () => {
  history.replaceState({}, '', '/programs/new');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({ error: 'Check the Header fields.', errors: { title: 'Enter a title between 1 and 200 characters.' } }) }));
  render(<Programs />);
  fireEvent.change(screen.getByLabelText('Title'), { target: { value: '  ' } });
  fireEvent.submit(screen.getByRole('form', { name: 'Program Header' }));
  await screen.findByText('Enter a title between 1 and 200 characters.');
  expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('  ');
});

it('keeps unsaved entries on a failed save of an existing Draft without offering a reload', async () => {
  history.replaceState({}, '', '/programs/1');
  const program = { id: 1, title: 'Original Gathering', date: null, startTime: null, endTime: null, status: 'Draft', version: 1 };
  const fetcher = vi.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ program }) })
    .mockRejectedValueOnce(new TypeError('Failed to fetch'))
    .mockResolvedValueOnce({ ok: true, json: async () => ({ program: { ...program, title: 'My unsaved title', version: 2 } }) });
  vi.stubGlobal('fetch', fetcher);
  render(<Programs />);
  await screen.findByDisplayValue('Original Gathering');
  fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'My unsaved title' } });
  fireEvent.submit(screen.getByRole('form', { name: 'Program Header' }));
  await screen.findByRole('alert');
  expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
  expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('My unsaved title');
  fireEvent.submit(screen.getByRole('form', { name: 'Program Header' }));
  await screen.findByText('Draft saved.');
  expect(JSON.parse(fetcher.mock.calls[2][1].body)).toMatchObject({ title: 'My unsaved title', version: 1 });
});
