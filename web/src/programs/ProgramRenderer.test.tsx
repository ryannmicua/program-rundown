import { expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { ProgramRenderer } from './ProgramRenderer.js';
import type { ContentNode } from '../../../src/domain/content.js';
import type { DirectPart } from '../../../src/domain/parts.js';

const program = { id: 1, title: 'Gathering', subtitle: '', date: null, startTime: null, endTime: null, status: 'Published' as const, version: 1 };
const nodes: ContentNode[] = [
  { id: 'section', parentId: null, kind: 'section', label: 'Opening', detail: '', startTime: null, endTime: null },
  { id: 'song', parentId: 'section', kind: 'item', label: 'Opening Song', detail: 'Amazing Grace, Hymn #321', startTime: null, endTime: null },
];
const parts: DirectPart[] = [
  { id: 'participant', targetId: 'song', targetKind: 'item', kind: 'structured', value: '', role: 'Song Leader', name: 'Alex Placeholder', extraInfo: '', intentionallyNotListed: false },
  { id: 'footer-part', targetId: 'pianist', targetKind: 'footer', kind: 'text', value: 'Jamie Placeholder', role: '', name: '', extraInfo: '', intentionallyNotListed: false },
];

it('renders bold activity titles, participants, detail, and Footer roles in the shared program listing', () => {
  render(<ProgramRenderer program={program} nodes={nodes} parts={parts} footer={[{ id: 'pianist', title: 'Pianist' }]}/>);
  const title = screen.getByText('Opening Song');
  expect(title.tagName).toBe('STRONG');
  const row = title.closest('li')!;
  expect(within(row).getByText('Alex Placeholder')).toBeDefined();
  expect(within(row).getByText('Amazing Grace, Hymn #321')).toBeDefined();
  const footer = screen.getByRole('region', { name: 'Footer standing roles' });
  expect(within(footer).getByText('Pianist')).toBeDefined();
  expect(within(footer).getByText('Jamie Placeholder')).toBeDefined();
});
