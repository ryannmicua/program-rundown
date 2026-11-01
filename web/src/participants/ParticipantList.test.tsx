import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ParticipantList } from './ParticipantList.js';
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('shows Event assignments, filters by Program, and gives an empty view guidance', async () => {
  vi.stubGlobal('location', { pathname: '/events/42/participants' });
  const response = (value: unknown) => ({ ok: true, json: async () => value });
  const fetcher = vi.fn()
    .mockResolvedValueOnce(response({ programs: [{ id: 2, title: 'Divine Worship Placeholder' }], namedParticipants: [{ participantId: 1, role: 'Speaker', name: 'Alex Placeholder', honorific: '', position: '', organization: '', subtitle: '', assignments: [{ programId: 2, programTitle: 'Divine Worship Placeholder', partId: 'part-one', targetLabel: 'Reading', targetKind: 'item', url: '/programs/2#part-part-one' }] }], textAssignments: [], awaitingName: [] }))
    .mockResolvedValue(response({ programs: [{ id: 2, title: 'Divine Worship Placeholder' }], namedParticipants: [], textAssignments: [], awaitingName: [] }));
  vi.stubGlobal('fetch', fetcher);
  render(<ParticipantList/>);
  expect(await screen.findByRole('heading', { name: 'Alex Placeholder' })).toBeDefined();
  fireEvent.change(screen.getByLabelText('Filter by Program'), { target: { value: '2' } });
  await waitFor(() => expect(fetcher).toHaveBeenCalledWith('/api/events/42/participants?programId=2'));
  await screen.findByText('No assignments in this Program.', { exact: false });
  expect(screen.queryByText('No Participant assignments yet. Add assignments to Parts to see them here.')).toBeNull();
  expect(screen.queryByText('No named participants in this view.')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Show all Event Programs' }));
  await waitFor(() => expect(fetcher).toHaveBeenLastCalledWith('/api/events/42/participants'));
  expect(await screen.findByText('No Participant assignments yet. Add assignments to Parts to see them here.')).toBeDefined();
});

it('keeps the session recovery on retry and loads assignments once the session returns', async () => {
  vi.stubGlobal('location', { pathname: '/programs/7/participants' });
  const expired = { ok: false, status: 401, json: async () => ({ error: 'Sign in required.' }) };
  const fetcher = vi.fn()
    .mockResolvedValueOnce(expired)
    .mockResolvedValueOnce(expired)
    .mockResolvedValueOnce({ ok: true, json: async () => ({ programs: [{ id: 7, title: 'Standalone Placeholder' }], namedParticipants: [], textAssignments: [{ value: 'Choir Placeholder', assignments: [{ programId: 7, programTitle: 'Standalone Placeholder', partId: 'choir', targetLabel: 'Anthem', targetKind: 'item', url: '/programs/7#part-choir' }] }], awaitingName: [] }) });
  vi.stubGlobal('fetch', fetcher);
  render(<ParticipantList/>);
  expect((await screen.findByRole('alert')).textContent).toContain('Your session ended. Sign in again to view Participants.');
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  expect(await screen.findByRole('link', { name: 'Sign in again' })).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect((await screen.findByRole('link', { name: 'Standalone Placeholder · Anthem' })).getAttribute('href')).toBe('/programs/7#part-choir');
  expect(fetcher).toHaveBeenLastCalledWith('/api/programs/7/participants');
});
