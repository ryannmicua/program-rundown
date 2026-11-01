import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Events } from './Events.js';
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

it('shows active loading guidance when Event requests are slow', async () => {
  vi.useFakeTimers();
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
  render(<Events/>);
  expect(screen.getByRole('status').textContent).toContain('Loading Events');
  await act(async () => { await vi.advanceTimersByTimeAsync(1600); });
  expect(screen.getByRole('status').textContent).toContain('Still loading Events');
  expect(screen.getByText('Still loading Events… They will appear as soon as they arrive.')).toBeDefined();
});

it('explains offline, denied, and expired sessions with retry or sign-in guidance', async () => {
  vi.stubGlobal('navigator', { onLine: false });
  vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch')));
  const offline = render(<Events/>);
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining('You are offline. Reconnect, then try again.'));
  offline.unmount();
  vi.stubGlobal('navigator', { onLine: true });
  vi.stubGlobal('fetch', vi.fn()
    .mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({ error: 'Dev tester access required.' }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ programs: [] }) }));
  const denied = render(<Events/>);
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining('Coordinator access is required. Sign out and use the configured coordinator account.'));
  denied.unmount();
  vi.stubGlobal('fetch', vi.fn()
    .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ error: 'Sign in to continue.' }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ programs: [] }) }));
  render(<Events/>);
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining('Your session ended. Sign in again to manage Events.'));
  expect((await screen.findByRole('link', { name: 'Sign in again' })).getAttribute('href')).toBe('/auth/login');
});

it('guides the coordinator from an empty Event list through inline validation and successful creation', async () => {
  const fetcher = vi.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ events: [] }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ programs: [] }) })
    .mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({ errors: { name: 'Enter an Event name between 1 and 200 characters.' } }) })
    .mockResolvedValueOnce({ ok: true, status: 201, json: async () => ({ event: { id: 1, name: 'Community Weekend', groupByDate: false } }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ events: [{ id: 1, name: 'Community Weekend', groupByDate: false, programs: [] }] }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ programs: [] }) });
  vi.stubGlobal('fetch', fetcher);
  render(<Events/>);
  await screen.findByText('No Events yet. Create one to group complete Programs by day.');
  fireEvent.change(screen.getByLabelText('New Event name'), { target: { value: 'Community Weekend' } });
  fireEvent.submit(screen.getByLabelText('New Event name').closest('form')!);
  const validation = await screen.findByText('Enter an Event name between 1 and 200 characters.');
  expect(screen.getByLabelText('New Event name').getAttribute('aria-describedby')).toBe('event-name-error');
  expect(validation.id).toBe('event-name-error');
  expect((screen.getByLabelText('New Event name') as HTMLInputElement).value).toBe('Community Weekend');
  fireEvent.submit(screen.getByLabelText('New Event name').closest('form')!);
  await screen.findByText('Event created. Add complete Programs to it next.');
  expect(screen.getByRole('button', { name: 'Community Weekend' })).toBeDefined();
});
