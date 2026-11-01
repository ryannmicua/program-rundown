import { expect, it } from 'vitest';
import { fixture } from './support.js';

it('saves direct Parts, independent ticks, ordered Footer roles, and reloads them without partial invalid writes', async () => {
  const f = await fixture();
  try {
    const cookie = await f.signIn();
    const send = (path: string, body: unknown, method = 'PUT') => fetch(`${f.origin}/api/programs${path}`, { method, headers: { cookie, origin: f.origin, 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const { program } = await (await send('', { title: 'Gathering' }, 'POST')).json();
    const nodes = [
      { id: 'section', kind: 'section', parentId: null, label: 'Opening', detail: '', startTime: null, endTime: null },
      { id: 'item', kind: 'item', parentId: 'section', label: 'Opening Song', detail: 'Amazing Grace, Hymn #321', startTime: null, endTime: null },
      { id: 'mini', kind: 'mini-program', parentId: null, label: 'Closing', detail: '', startTime: null, endTime: null },
    ];
    expect((await send(`/${program.id}/content`, { version: 1, nodes })).status).toBe(200);
    const parts = [
      { id: 'section-part', targetId: 'section', targetKind: 'section', kind: 'text', value: 'Congregation', role: '', name: '', extraInfo: 'All together', intentionallyNotListed: false },
      { id: 'item-part', targetId: 'item', targetKind: 'item', kind: 'structured', value: '', role: 'Song Leader', name: 'Alex Placeholder', extraInfo: '', intentionallyNotListed: false },
      { id: 'mini-part', targetId: 'mini', targetKind: 'mini-program', kind: 'role', value: '', role: 'Presider', name: '', extraInfo: '', intentionallyNotListed: false },
      { id: 'empty-part', targetId: 'item', targetKind: 'item', kind: 'blank', value: '', role: '', name: '', extraInfo: '', intentionallyNotListed: true },
    ];
    const footer = [{ id: 'pianist', title: 'Pianist' }, { id: 'coordinator', title: 'Program Coordinator' }];
    expect((await send(`/${program.id}/parts`, { version: 2, parts, footer })).status).toBe(200);
    const read = () => fetch(`${f.origin}/api/programs/${program.id}`, { headers: { cookie } }).then(response => response.json());
    const saved = await read();
    expect(saved.parts).toEqual(parts);
    expect(saved.footer).toEqual(footer);
    expect(saved.nodes.find((node: { id: string }) => node.id === 'item').detail).toBe('Amazing Grace, Hymn #321');
    const stale = await send(`/${program.id}/parts`, { version: 2, parts, footer });
    expect(stale.status).toBe(409);
    expect((await stale.json()).error).toContain('Your Parts are kept');
    const invalid = await send(`/${program.id}/parts`, { version: 3, parts: [{ ...parts[0], targetId: 'missing' }], footer });
    expect(invalid.status).toBe(400);
    expect(await read()).toEqual(saved);
    expect((await send(`/${program.id}/content`, { version: 3, nodes: [nodes[0], nodes[2]] })).status).toBe(200);
    expect((await read()).parts.map((part: { id: string }) => part.id)).toEqual(['section-part', 'mini-part']);
    expect((await send(`/${program.id}/publish`, {}, 'POST')).status).toBe(200);
    const listing = await fetch(`${f.origin}/api/public/programs/${program.id}`).then(response => response.json());
    expect(listing.parts).toEqual([parts[0], parts[2]].map(({ intentionallyNotListed, ...part }) => part));
    expect(listing.footer).toEqual(footer);
    await f.restart();
    expect((await read()).footer).toEqual(footer);
  } finally { await f.close(); }
});
