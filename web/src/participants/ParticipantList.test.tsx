import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ParticipantList } from './ParticipantList.js';
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('shows Event assignments, filters by Program, and gives an empty view guidance', async () => {
  vi.stubGlobal('location', { pathname: '/events/42/participants' });
  const response = (value: unknown) => ({ ok: true, json: async () => value });
  const fetcher = vi.fn()
    .mockResolvedValueOnce(response({ programs: [{ id: 2, title: 'Divine Worship Placeholder' }], namedParticipants: [{ participantId: 1, role: 'Speaker', name: 'Alex Placeholder', honorific: '', position: '', organization: '', subtitle: '', assignments: [{ programId: 2, programTitle: 'Divine Worship Placeholder', partId: 'part-one', targetLabel: 'Reading', targetKind: 'item', url: '/programs/2#part-part-one' }] }], textAssignments: [], awaitingName: [] }))
    .mockResolvedValueOnce(response({ programs: [{ id: 2, title: 'Divine Worship Placeholder' }], namedParticipants: [], textAssignments: [], awaitingName: [] }));
  vi.stubGlobal('fetch', fetcher);
  render(<ParticipantList/>);
  expect(await screen.findByRole('heading', { name: 'Alex Placeholder' })).toBeDefined();
  fireEvent.change(screen.getByLabelText('Filter by Program'), { target: { value: '2' } });
  await waitFor(() => expect(fetcher).toHaveBeenCalledWith('/api/events/42/participants?programId=2'));
  await screen.findByText('No Participant assignments yet. Add assignments to Parts to see them here.');
});
