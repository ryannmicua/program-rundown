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
  const view = render(<PartsEditor program={program} nodes={nodes} initialParts={[]} initialFooter={[]} onSaved={onSaved} onDirtyChange={vi.fn()}/>);
  fireEvent.click(screen.getByRole('button', { name: 'Add Footer role' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save Parts and Footer' }));
  expect(screen.getByLabelText('Footer role title').getAttribute('aria-invalid')).toBe('true');
  expect(screen.getByText('Enter a Footer role title.')).toBeDefined();
  fireEvent.change(screen.getByLabelText('Footer role title'), { target: { value: 'Pianist' } });
  fireEvent.click(within(screen.getByRole('region', { name: 'Participants for Opening Song' })).getByRole('button', { name: 'Add participant' }));
  fireEvent.click(screen.getAllByLabelText('Intentionally not listed').at(-1)!);
  expect(window.sessionStorage.getItem('program-rundown:parts-draft:1')).toContain('intentionallyNotListed');
  view.unmount();
  render(<PartsEditor program={program} nodes={nodes} initialParts={[]} initialFooter={[]} onSaved={onSaved} onDirtyChange={vi.fn()}/>);
  expect((screen.getByLabelText('Footer role title') as HTMLInputElement).value).toBe('Pianist');
  expect((screen.getAllByLabelText('Intentionally not listed').at(-1) as HTMLInputElement).checked).toBe(true);
});
