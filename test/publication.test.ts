import { expect, it } from 'vitest';
import { fixture } from './support.js';
import type { ContentNode } from '../src/domain/content.js';

it('publishes by coordinator action, hides Drafts, and serves the latest Published content anonymously', async () => {
  const f = await fixture();
  try {
    const cookie = await f.signIn();
    const send = (path: string, method: string, body: unknown, auth = cookie) => fetch(`${f.origin}${path}`, {
      method, headers: { cookie: auth, origin: f.origin, 'content-type': 'application/json' }, body: JSON.stringify(body),
    });
    const created = await send('/api/programs', 'POST', { title: 'Private Draft' });
    const { program } = await created.json();
    expect(created.status).toBe(201);
    expect((await fetch(`${f.origin}/api/public/programs/${program.id}`)).status).toBe(404);
    expect((await send(`/api/programs/${program.id}/publish`, 'POST', {})).status).toBe(200);
    const reader = await fetch(`${f.origin}/api/public/programs/${program.id}`);
    expect(reader.status).toBe(200);
    expect(await reader.json()).toMatchObject({ program: { id: program.id, title: 'Private Draft', status: 'Published' }, nodes: [] });
    expect((await send(`/api/programs/${program.id}/publish`, 'POST', {}, 'invalid-session')).status).toBe(401);
    f.issuer.setSubject('another-placeholder-coordinator');
    const otherIdentity = await f.signIn();
    expect((await send(`/api/programs/${program.id}/publish`, 'POST', {}, otherIdentity)).status).toBe(403);

    const edited = await send(`/api/programs/${program.id}`, 'PATCH', { title: 'Revised Published Program', version: 1 });
    expect(edited.status).toBe(200);
    const section: ContentNode = { id: 'published-section', parentId: null, kind: 'section', label: 'Welcome', detail: '', startTime: null, endTime: null };
    const item: ContentNode = { id: 'published-item', parentId: section.id, kind: 'item', label: 'Opening Remarks', detail: 'Latest copy', startTime: null, endTime: null };
    const content = await send(`/api/programs/${program.id}/content`, 'PUT', { version: 2, nodes: [section, item] });
    expect(content.status).toBe(200);
    expect(await (await fetch(`${f.origin}/api/public/programs/${program.id}`)).json()).toMatchObject({
      program: { title: 'Revised Published Program' }, nodes: [{ label: 'Welcome' }, { label: 'Opening Remarks', detail: 'Latest copy' }],
    });
    expect((await send(`/api/programs/${program.id}`, 'PATCH', { title: 'Stranger edit', version: 1 }, 'invalid-session')).status).toBe(401);
  } finally { await f.close(); }
});
