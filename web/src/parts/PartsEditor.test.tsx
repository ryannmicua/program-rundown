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
