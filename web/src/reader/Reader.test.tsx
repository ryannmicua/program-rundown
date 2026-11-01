import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Reader } from './Reader.js';
afterEach(() => { cleanup(); vi.unstubAllGlobals(); history.replaceState({}, '', '/'); });

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
