import { expect, it } from 'vitest';
import { fixture } from './support.js';
import { contentLimits } from '../src/domain/content.js';

it('composes, edits, reorders and removes content with atomic revision and parent checks', async () => {
  const f = await fixture();
  try {
    const cookie = await f.signIn();
    const send = (path: string, body: unknown, method = 'PUT') => fetch(`${f.origin}/api/programs${path}`, { method, headers: { cookie, origin: f.origin, 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const { program } = await (await send('', { title: 'Gathering' }, 'POST')).json();
    const section = { id: 'opening', kind: 'section', parentId: null, label: 'Call to Worship', detail: '', startTime: '09:00', endTime: null };
    const closing = { ...section, id: 'closing', label: '', startTime: null };
    const item = { id: 'introit', kind: 'item', parentId: section.id, label: '*Introit', detail: 'A long line\nwith a second line', startTime: null, endTime: '09:10' };
    let nodes = [section, item, closing, { ...item, id: 'prayer', label: 'Prayer', detail: '' }];
    let result = await send(`/${program.id}/content`, { version: 1, nodes });
    expect(result.status).toBe(200);
    expect((await result.json()).program.version).toBe(2);
    const read = () => fetch(`${f.origin}/api/programs/${program.id}`, { headers: { cookie } }).then(r => r.json());
    const before = await read();
    const canonical = (items: typeof nodes) => items.map(node => ({ ...node, date: null, blockLabel: '' }));
    expect(before.nodes).toEqual(canonical(nodes));
    for (const invalid of [
      { version: 1, nodes: [...nodes].reverse() },
      { version: 2, nodes: [{ ...item, parentId: null }] },
      { version: 2, nodes: [section, item, { ...closing, parentId: item.id }] },
      { version: 2, nodes: [section, { ...item, parentId: 'missing' }] },
      { version: 2, nodes: [section, { ...item, startTime: '25:00' }] },
      { version: 2, nodes: [section, section] },
      { version: 2, nodes: [{ ...section, kind: 'mini-program', label: '' }] },
    ]) {
      result = await send(`/${program.id}/content`, invalid);
      expect([400, 409]).toContain(result.status);
      expect(await read()).toEqual(before);
    }
    nodes = [closing, section, { ...nodes[3], detail: 'Edited prayer' }, item];
    expect((await send(`/${program.id}/content`, { version: 2, nodes })).status).toBe(200);
    await f.restart();
    expect((await read()).nodes).toEqual(canonical(nodes));
    // Removing a Section and its Items leaves the unheaded group in place.
    expect((await send(`/${program.id}/content`, { version: 3, nodes: [closing] })).status).toBe(200);
    expect((await read()).nodes).toEqual(canonical([closing]));
    // Header and content edits share one revision counter.
    expect((await send(`/${program.id}`, { title: 'Stale', version: 3 }, 'PATCH')).status).toBe(409);
    expect((await fetch(`${f.origin}/api/programs/${program.id}/content`, { method: 'PUT', headers: { origin: f.origin, 'content-type': 'application/json' }, body: JSON.stringify({ version: 4, nodes: [] }) })).status).toBe(401);
    f.issuer.setSubject('other-placeholder');
    const otherCookie = await f.signIn();
    const response = await fetch(`${f.origin}/api/programs/${program.id}/content`, { method: 'PUT', headers: { cookie: otherCookie, origin: f.origin, 'content-type': 'application/json' }, body: JSON.stringify({ version: 4, nodes: [] }) });
    expect(response.status).toBe(403);
    expect(await read()).toMatchObject({ nodes: [closing], program: { version: 4 } });
  } finally { await f.close(); }
});

it('saves the largest valid rundown and rejects text beyond the total limit', async () => {
  const f = await fixture();
  try {
    const cookie = await f.signIn();
    const send = (path: string, body: unknown, method = 'PUT') => fetch(`${f.origin}/api/programs${path}`, { method, headers: { cookie, origin: f.origin, 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const { program } = await (await send('', { title: 'Hymns' }, 'POST')).json();
    const id = (n: number) => String(n).padStart(80, 'x');
    const escaped = (length: number) => '\u0001'.repeat(length);
    const nodes = Array.from({ length: contentLimits.nodes }, (_, n) => n === 0
      ? { id: id(n), parentId: null, kind: 'section', label: escaped(100), detail: '', startTime: '09:00', endTime: '09:30', date: null, blockLabel: '' }
      : { id: id(n), parentId: id(0), kind: 'item', label: escaped(100), detail: escaped(n <= 3 ? 10000 : 0), startTime: '09:00', endTime: '09:30', date: null, blockLabel: '' });
    expect(nodes.reduce((sum, node) => sum + node.label.length + node.detail.length, 0)).toBe(contentLimits.text);
    let result = await send(`/${program.id}/content`, { version: 1, nodes });
    expect(result.status).toBe(200);
    expect((await result.json()).nodes).toEqual(nodes);
    nodes[4].detail = 'x';
    result = await send(`/${program.id}/content`, { version: 2, nodes });
    expect(result.status).toBe(400);
    expect((await result.json()).error).toMatch(/60000 characters in total/);
  } finally { await f.close(); }
});
