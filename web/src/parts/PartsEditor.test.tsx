import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { PartsEditor } from './PartsEditor.js';
import type { ContentNode } from '../../../src/domain/content.js';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.sessionStorage.clear(); });
const program = { id: 1, title: 'Gathering', subtitle: '', date: null, startTime: null, endTime: null, status: 'Draft' as const, version: 1 };
const nodes: ContentNode[] = [{ id: 'song', parentId: null, kind: 'item', label: 'Opening Song', detail: 'Amazing Grace, Hymn #321', startTime: null, endTime: null }];

it('adds a Footer role, reports its required title inline, and keeps intentionally unlisted ticks in a session draft', async () => {
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  const onSaved = vi.fn();
  const view = render(<PartsEditor program={program} nodes={nodes} initialParts={[]} initialFooter={[]} onSaved={onSaved} onChange={vi.fn()} onDirtyChange={vi.fn()} reload={vi.fn()}/>);
  fireEvent.click(screen.getByRole('button', { name: 'Add Footer role' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save Parts and Footer' }));
  expect(screen.getByLabelText('Footer role title').getAttribute('aria-invalid')).toBe('true');
  expect(screen.getByText('Enter a Footer role title.')).toBeDefined();
  fireEvent.change(screen.getByLabelText('Footer role title'), { target: { value: 'Pianist' } });
  fireEvent.click(within(screen.getByRole('region', { name: 'Participants for Opening Song' })).getByRole('button', { name: 'Add participant' }));
  fireEvent.click(screen.getAllByLabelText('Intentionally not listed').at(-1)!);
  expect(window.sessionStorage.getItem('program-rundown:parts-draft:1')).toContain('intentionallyNotListed');
  view.unmount();
  render(<PartsEditor program={program} nodes={nodes} initialParts={[]} initialFooter={[]} onSaved={onSaved} onChange={vi.fn()} onDirtyChange={vi.fn()} reload={vi.fn()}/>);
  expect((screen.getByLabelText('Footer role title') as HTMLInputElement).value).toBe('Pianist');
  expect((screen.getAllByLabelText('Intentionally not listed').at(-1) as HTMLInputElement).checked).toBe(true);
});

const pianist = { id: 'pianist', title: 'Pianist' };
const leader = { id: 'leader', targetId: 'song', targetKind: 'item' as const, kind: 'role' as const, value: '', role: 'Song Leader', name: '', extraInfo: '', intentionallyNotListed: false };
const editor = (props: Partial<Parameters<typeof PartsEditor>[0]> = {}) => <PartsEditor program={program} nodes={nodes} initialParts={[]} initialFooter={[pianist]} onSaved={vi.fn()} onChange={vi.fn()} onDirtyChange={vi.fn()} reload={vi.fn()} {...props}/>;

it('locks every Footer control while a save is in flight', async () => {
  let respond!: (response: Response) => void;
  vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(resolve => { respond = resolve; })));
  render(editor());
  fireEvent.change(screen.getByLabelText('Footer role title'), { target: { value: 'Organist' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save Parts and Footer' }));
  expect(screen.getByLabelText('Footer role title').matches(':disabled')).toBe(true);
  expect(screen.getByRole('button', { name: 'Remove role' }).matches(':disabled')).toBe(true);
  respond(new Response(JSON.stringify({ parts: [], footer: [{ ...pianist, title: 'Organist' }], version: 2 })));
  await screen.findByText(/Parts and Footer saved/);
  expect(screen.getByLabelText('Footer role title').matches(':disabled')).toBe(false);
});

it('shows the saved Parts after a conflict and keeps the stale draft behind an explicit reapply', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'This Program changed. Your Parts are kept. Reload the saved Program, then review and reapply them.' }), { status: 409 })));
  const reload = vi.fn(async () => {});
  const onSaved = vi.fn();
  const view = render(editor({ reload, onSaved }));
  fireEvent.change(screen.getByLabelText('Footer role title'), { target: { value: 'Organist' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save Parts and Footer' }));
  await screen.findByText(/This Program changed/);
  expect(screen.queryByRole('button', { name: 'Try saving Parts again' })).toBeNull();
  expect(screen.getByLabelText('Footer role title').matches(':disabled')).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Reload saved Program' }));
  expect(reload).toHaveBeenCalled();
  const newer = { ...program, version: 2 };
  view.rerender(editor({ program: newer, initialParts: [leader], initialFooter: [{ ...pianist, title: 'Keyboardist' }], reload, onSaved }));
  expect((screen.getByLabelText('Footer role title') as HTMLInputElement).value).toBe('Keyboardist');
  expect(screen.getByRole('button', { name: 'Save Parts and Footer' }).matches(':disabled')).toBe(true);
  const kept = screen.getByRole('complementary');
  expect(within(kept).getByText(/Footer: Organist/)).toBeDefined();
  view.unmount();
  render(editor({ program: newer, initialParts: [leader], initialFooter: [{ ...pianist, title: 'Keyboardist' }], reload, onSaved }));
  expect((screen.getByLabelText('Footer role title') as HTMLInputElement).value).toBe('Keyboardist');
  fireEvent.click(screen.getByRole('button', { name: 'Reapply my Parts entries' }));
  expect((screen.getByLabelText('Footer role title') as HTMLInputElement).value).toBe('Organist');
  expect(JSON.parse(window.sessionStorage.getItem('program-rundown:parts-draft:1')!).version).toBe(2);
});

it('keeps an unsaved Parts draft current when this tab saves another part of the Program', () => {
  const initialParts: [] = [];
  const view = render(editor({ initialParts }));
  fireEvent.change(screen.getByLabelText('Footer role title'), { target: { value: 'Organist' } });
  view.rerender(editor({ initialParts, program: { ...program, version: 2 } }));
  view.unmount();
  render(editor({ program: { ...program, version: 2 } }));
  expect((screen.getByLabelText('Footer role title') as HTMLInputElement).value).toBe('Organist');
  expect(screen.queryByRole('complementary')).toBeNull();
});

it('discards kept stale entries so they do not return on the next open', () => {
  window.sessionStorage.setItem('program-rundown:parts-draft:1', JSON.stringify({ version: 1, parts: [], footer: [{ ...pianist, title: 'Organist' }] }));
  const newer = { ...program, version: 2 };
  const view = render(editor({ program: newer }));
  fireEvent.click(within(screen.getByRole('complementary')).getByRole('button', { name: 'Discard my kept entries' }));
  expect(screen.queryByRole('complementary')).toBeNull();
  view.unmount();
  render(editor({ program: newer }));
  expect(screen.queryByRole('complementary')).toBeNull();
  expect((screen.getByLabelText('Footer role title') as HTMLInputElement).value).toBe('Pianist');
});

it('shows a reference Part as a saved Participant, clears the definition when switching form, and flags a missing definition inline', async () => {
  const speaker = { id: 7, role: 'Speaker', name: 'Alex Placeholder', honorific: '', position: '', organization: '', subtitle: '', programs: [] };
  const fetcher = vi.fn((input: string) => input === '/api/participants'
    ? Promise.resolve(new Response(JSON.stringify({ participants: [speaker] })))
    : Promise.resolve(new Response(JSON.stringify({ parts: [], footer: [], version: 2 }))));
  vi.stubGlobal('fetch', fetcher);
  const reference = { ...leader, kind: 'reference' as const, role: '', participantId: 7, referenceMode: 'name' as const };
  render(editor({ initialParts: [reference], initialFooter: [] }));
  const song = screen.getByRole('region', { name: 'Participants for Opening Song' });
  await within(song).findByRole('option', { name: /Alex Placeholder/ });
  expect((within(song).getByLabelText('Participant form') as HTMLSelectElement).value).toBe('reference');
  fireEvent.change(within(song).getByLabelText('Participant definition'), { target: { value: '' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save Parts and Footer' }));
  expect(within(song).getByLabelText('Participant definition').getAttribute('aria-invalid')).toBe('true');
  expect(within(song).getByText('Choose a saved Participant for this entry.')).toBeDefined();
  expect(fetcher.mock.calls.filter(([input]) => input !== '/api/participants')).toEqual([]);
  fireEvent.change(within(song).getByLabelText('Participant form'), { target: { value: 'text' } });
  fireEvent.change(within(song).getByLabelText('Participant text'), { target: { value: 'Choir' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save Parts and Footer' }));
  const put = fetcher.mock.calls.find(([input]) => input !== '/api/participants') as unknown as [string, RequestInit];
  expect(JSON.parse(String(put[1].body)).parts[0]).toMatchObject({ kind: 'text', value: 'Choir', participantId: null, referenceMode: null });
});

it('keeps a linked reference visible while saved Participants cannot load', async () => {
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify({ error: 'down' }), { status: 500 }))));
  const details = { role: 'Speaker', name: 'Alex Placeholder', honorific: 'Dr.', position: '', organization: '', subtitle: '' };
  render(editor({ initialParts: [{ ...leader, kind: 'reference', role: '', participantId: 7, referenceMode: 'name', participant: details }], initialFooter: [] }));
  await screen.findByRole('button', { name: 'Try loading Participants again' });
  const song = screen.getByRole('region', { name: 'Participants for Opening Song' });
  expect((within(song).getByLabelText('Participant definition') as HTMLSelectElement).value).toBe('7');
  expect(within(song).getByRole('option', { name: 'Speaker — Dr. Alex Placeholder' })).toBeDefined();
  expect(within(song).queryByText(/No saved Participants match/)).toBeNull();
});

it('explains that only the creator can edit a shared Participant definition', async () => {
  const speaker = { id: 7, role: 'Speaker', name: 'Alex Placeholder', honorific: '', position: '', organization: '', subtitle: '', programs: [] };
  const refusal = 'Only the coordinator who created this Participant can edit or delete it. You can still choose it for your Parts, or add your own definition.';
  vi.stubGlobal('fetch', vi.fn((input: string) => input === '/api/participants'
    ? Promise.resolve(new Response(JSON.stringify({ participants: [speaker] })))
    : Promise.resolve(new Response(JSON.stringify({ error: refusal, code: 'participant-not-owner' }), { status: 403 }))));
  render(editor());
  fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save Participant changes' }));
  expect((await screen.findByRole('alert')).textContent).toBe(refusal);
});

it('previews destination Parts before moving or copying and acknowledges the completed operation', async () => {
  const eventProgram = { ...program, eventId: 5 };
  const destinationProgram = { ...eventProgram, id: 2, title: 'Sabbath School' };
  const fetcher = vi.fn(async (input: string, init?: RequestInit) => {
    if (input === '/api/participants') return new Response(JSON.stringify({ participants: [] }));
    if (input === '/api/programs') return new Response(JSON.stringify({ programs: [eventProgram, destinationProgram] }));
    if (input === '/api/programs/1') return new Response(JSON.stringify({ program: eventProgram, nodes, parts: [leader], footer: [] }));
    if (input === '/api/programs/2') return new Response(JSON.stringify({ program: destinationProgram, nodes, parts: [{ ...leader, id: 'existing', value: 'Congregation' }], footer: [] }));
    if (input.endsWith('/transfer')) return new Response(JSON.stringify({ source: { parts: [leader], footer: [], version: 2 }, destination: { parts: [leader], footer: [], version: 2 } }));
    throw Error(`Unexpected request ${input} ${init?.method || ''}`);
  });
  vi.stubGlobal('fetch', fetcher);
  render(editor({ program: eventProgram, initialParts: [leader], initialFooter: [] }));
  fireEvent.click(screen.getByRole('button', { name: 'Move or copy Part' }));
  await screen.findByRole('option', { name: 'Opening Song' });
  fireEvent.change(screen.getByLabelText('Destination Program'), { target: { value: '2' } });
  await screen.findByText('Existing destination Parts will stay in place:');
  expect(screen.getByText('Song Leader')).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: 'Copy everything' }));
  await screen.findByRole('status');
  const request = fetcher.mock.calls.find(([input]) => input.endsWith('/transfer'))!;
  expect(JSON.parse(String(request[1]?.body))).toMatchObject({ destinationProgramId: 2, operation: 'copy', copyMode: 'everything' });
  expect(screen.getByText(/Part copied to Opening Song/)).toBeDefined();
});
