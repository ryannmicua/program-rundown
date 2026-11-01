import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Reader } from './Reader.js';
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); history.replaceState({}, '', '/'); });

it('retries loading in place after a failed load', async () => {
  history.replaceState({}, '', '/p/1');
  const program = { id: 1, title: 'Community Program', date: null, startTime: null, endTime: null, status: 'Published', version: 1 };
  const fetcher = vi.fn()
    .mockRejectedValueOnce(new TypeError('Failed to fetch'))
    .mockRejectedValueOnce(new TypeError('Failed to fetch'))
    .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ program, nodes: [] }) });
  vi.stubGlobal('fetch', fetcher);
  const reload = vi.fn();
  vi.stubGlobal('location', { ...window.location, pathname: '/p/1', reload });
  render(<Reader />);
  fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));
  await screen.findByRole('heading', { name: 'Community Program' });
  expect(fetcher).toHaveBeenCalledTimes(3);
  expect(reload).not.toHaveBeenCalled();
});

it('shows a retryable error when the published Program request hangs', async () => {
  vi.useFakeTimers();
  history.replaceState({}, '', '/p/1');
  const program = { id: 1, title: 'Community Program', date: null, startTime: null, endTime: null, status: 'Published', version: 1 };
  const fetcher = vi.fn()
    .mockImplementationOnce((_url: string, options: RequestInit) => new Promise((_resolve, reject) => {
      options.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    }))
    .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ program, nodes: [] }) });
  vi.stubGlobal('fetch', fetcher);
  vi.stubGlobal('location', { ...window.location, pathname: '/p/1' });
  render(<Reader />);

  await act(async () => { vi.advanceTimersByTime(15_000); });
  expect(screen.getByRole('heading', { name: 'Could not load this Program' })).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
  expect(screen.getByRole('heading', { name: 'Community Program' })).toBeDefined();
  expect(fetcher).toHaveBeenCalledTimes(2);
});
