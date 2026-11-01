import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Templates } from './Templates.js';
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); history.replaceState({}, '', '/'); localStorage.clear(); });

it('shows the owned template preview and keeps inline creation errors with the requested fields', async () => {
  history.replaceState({}, '', '/templates/7/use');
  const fetcher = vi.fn(async (input: string) => {
    if (input === '/api/templates') return { ok: true, json: async () => ({ templates: [{ id: 7, name: 'Gathering Template' }] }) };
    if (input === '/api/events') return { ok: true, json: async () => ({ events: [{ id: 4, name: 'Sabbath Placeholder' }] }) };
    if (input === '/api/templates/7') return { ok: true, json: async () => ({ template: { id: 7, name: 'Gathering Template' }, nodes: [{ id: 'song', parentId: null, kind: 'section', label: 'Opening', detail: '', startTime: null, endTime: null, date: null, blockLabel: '' }, { id: 'hymn', parentId: 'song', kind: 'item', label: 'Hymn', detail: 'Placeholder detail', startTime: null, endTime: null, date: null, blockLabel: '' }], parts: [{ id: 'leader', targetId: 'hymn', targetKind: 'item', kind: 'blank', value: '', role: '', name: '', extraInfo: 'Music note', intentionallyNotListed: false }], footer: [] }) };
    return { ok: false, status: 400, json: async () => ({ errors: { title: 'Enter a title between 1 and 200 characters.' } }) };
  });
  vi.stubGlobal('fetch', fetcher);
  render(<Templates/>);
  expect(await screen.findByText('Placeholder detail')).toBeDefined();
  expect(screen.getByText(/People and Header dates and times are not copied/)).toBeDefined();
  fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Sabbath Placeholder' } });
  fireEvent.change(screen.getByLabelText('Date (optional)'), { target: { value: '2026-11-08' } });
  fireEvent.change(screen.getByLabelText('Event (optional)'), { target: { value: '4' } });
  expect(localStorage.getItem('template-draft-7')).toContain('Sabbath Placeholder');
  fireEvent.submit(screen.getByRole('button', { name: 'Create Draft' }).closest('form')!);
  expect(await screen.findByText('Enter a title between 1 and 200 characters.')).toBeDefined();
  expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('Sabbath Placeholder');
  expect(screen.getByLabelText('Title').getAttribute('aria-invalid')).toBe('true');
});

it('guides an empty template list toward a first template and reports offline retry guidance', async () => {
  history.replaceState({}, '', '/templates');
  vi.stubGlobal('fetch', vi.fn(async (input: string) => input === '/api/templates'
    ? { ok: true, json: async () => ({ templates: [] }) }
    : { ok: true, json: async () => ({ events: [] }) }));
  render(<Templates/>);
  expect(await screen.findByText(/Open a Program and choose Save as template/)).toBeDefined();
  expect(screen.getByRole('link', { name: 'Your Programs' }).getAttribute('href')).toBe('/');

  history.replaceState({}, '', '/templates');
  vi.stubGlobal('navigator', { onLine: false });
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
  render(<Templates/>);
  expect((await screen.findByRole('alert')).textContent).toContain('You are offline. Reconnect, then try again.');
});

it('persists the creation form and offers sign-in recovery after session expiry', async () => {
  history.replaceState({}, '', '/templates/7/use');
  vi.stubGlobal('fetch', vi.fn(async (input: string) => {
    if (input === '/api/templates') return { ok: true, json: async () => ({ templates: [{ id: 7, name: 'Gathering Template' }] }) };
    if (input === '/api/events') return { ok: true, json: async () => ({ events: [] }) };
    if (input === '/api/templates/7') return { ok: true, json: async () => ({ template: { id: 7, name: 'Gathering Template' }, nodes: [], parts: [], footer: [] }) };
    return { ok: false, status: 401, json: async () => ({ error: 'Sign in to continue.' }) };
  }));
  render(<Templates/>);
  await screen.findByRole('button', { name: 'Create Draft' });
  fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Session Draft Placeholder' } });
  fireEvent.submit(screen.getByRole('button', { name: 'Create Draft' }).closest('form')!);
  expect((await screen.findByRole('alert')).textContent).toContain('Your session ended. Sign in again; your entries are still on this page.');
  expect(localStorage.getItem('template-draft-7')).toContain('Session Draft Placeholder');
  expect(screen.getByRole('link', { name: 'Open sign-in in another tab' }).getAttribute('href')).toBe('/signin');
});

it('shows progress when a template preview is slow and provides coordinator recovery on denial', async () => {
  history.replaceState({}, '', '/templates/7/use');
  vi.useFakeTimers();
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
  render(<Templates/>);
  await act(async () => { await vi.advanceTimersByTimeAsync(1800); });
  expect(screen.getByText(/Still loading the template preview/)).toBeDefined();

  cleanup();
  vi.useRealTimers();
  history.replaceState({}, '', '/templates');
  vi.stubGlobal('fetch', vi.fn(async (input: string) => input === '/api/templates'
    ? { ok: false, status: 403, json: async () => ({ error: 'Dev tester access required.' }) }
    : { ok: true, json: async () => ({ events: [] }) }));
  render(<Templates/>);
  expect((await screen.findByRole('alert')).textContent).toContain('Coordinator access is required. Sign in with an authorized coordinator account.');
  expect(screen.getByRole('link', { name: 'Open sign-in in another tab' }).getAttribute('href')).toBe('/signin');
});
