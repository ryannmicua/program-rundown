import { expect, it } from 'vitest';
import { fixture } from './support.js';
import { moveSibling, type ContentNode } from '../src/domain/content.js';

it('persists nested Sections and mini-programs, validates parents and cycles, and carries the subtitle to readers', async () => {
  const f = await fixture();
  try {
    const cookie = await f.signIn();
    const send = (path: string, body: unknown, method = 'PUT') => fetch(`${f.origin}/api/programs${path}`, { method, headers: { cookie, origin: f.origin, 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const { program } = await (await send('', { title: 'Community Gathering', subtitle: 'A day of gratitude', date: '2026-11-07' }, 'POST')).json();
    const nodes: ContentNode[] = [
      { id: 'gathering', parentId: null, kind: 'section', label: 'Community Gathering', detail: '', startTime: null, endTime: null, blockLabel: 'featured' },
      { id: 'morning', parentId: 'gathering', kind: 'mini-program', label: 'Morning Service', detail: '', startTime: '09:00', endTime: null, date: '2026-11-07' },
      { id: 'dedication', parentId: 'morning', kind: 'section', label: 'Dedication', detail: '', startTime: null, endTime: null },
      { id: 'prayer', parentId: 'dedication', kind: 'item', label: 'Prayer', detail: 'A placeholder detail.', startTime: null, endTime: '09:10' },
      { id: 'closing', parentId: 'gathering', kind: 'mini-program', label: 'Closing Program', detail: '', startTime: null, endTime: null, blockLabel: 'custom-label' },
      { id: 'closing-section', parentId: 'closing', kind: 'section', label: '', detail: '', startTime: null, endTime: null, blockLabel: 'unheaded-close' },
    ];
    expect(moveSibling(nodes, 'closing', -1).map(node => node.id)).toEqual(['gathering', 'closing', 'closing-section', 'morning', 'dedication', 'prayer']);
    const saved = await send(`/${program.id}/content`, { version: 1, nodes });
    expect(saved.status).toBe(200);
    const stored: ContentNode[] = (await fetch(`${f.origin}/api/programs/${program.id}`, { headers: { cookie } }).then(response => response.json())).nodes;
    expect(stored.map(({ id, parentId, kind, label, date, blockLabel }) => ({ id, parentId, kind, label, date, blockLabel }))).toEqual([
      { id: 'gathering', parentId: null, kind: 'section', label: 'Community Gathering', date: null, blockLabel: 'featured' },
      { id: 'morning', parentId: 'gathering', kind: 'mini-program', label: 'Morning Service', date: '2026-11-07', blockLabel: '' },
      { id: 'dedication', parentId: 'morning', kind: 'section', label: 'Dedication', date: null, blockLabel: '' },
      { id: 'prayer', parentId: 'dedication', kind: 'item', label: 'Prayer', date: null, blockLabel: '' },
      { id: 'closing', parentId: 'gathering', kind: 'mini-program', label: 'Closing Program', date: null, blockLabel: 'custom-label' },
      { id: 'closing-section', parentId: 'closing', kind: 'section', label: '', date: null, blockLabel: 'unheaded-close' },
    ]);
    expect((await send(`/${program.id}/content`, { version: 2, nodes: nodes.map(node => node.id === 'gathering' ? { ...node, parentId: 'closing-section' } : node) })).status).toBe(400);
    expect((await send(`/${program.id}/content`, { version: 2, nodes: [{ ...nodes[0], parentId: 'other-program' }] })).status).toBe(400);
    expect((await send(`/${program.id}`, { subtitle: '   ', version: 2 }, 'PATCH')).status).toBe(200);
    const reopened = await fetch(`${f.origin}/api/programs/${program.id}`, { headers: { cookie } }).then(response => response.json());
    expect(reopened.program.subtitle).toBe('');
    expect(reopened.nodes).toEqual(stored);
    expect((await send(`/${program.id}`, { subtitle: 'A day of gratitude', version: 3 }, 'PATCH')).status).toBe(200);
    expect((await send(`/${program.id}/publish`, {}, 'POST')).status).toBe(200);
    const publicData = await fetch(`${f.origin}/api/public/programs/${program.id}`).then(response => response.json());
    expect(publicData.program.subtitle).toBe('A day of gratitude');
    expect(publicData.nodes).toEqual(stored);
  } finally { await f.close(); }
});
