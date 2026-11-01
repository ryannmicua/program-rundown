import { expect, it } from 'vitest';
import { openProduct } from '../src/db/product.js';
import { fixture } from './support.js';

it('creates shared definitions, keeps same-name identities distinct, and renders updated name and role references', async () => {
  const f = await fixture();
  try {
    const cookie = await f.signIn();
    const send = (path: string, body?: unknown, method = 'GET') => fetch(`${f.origin}${path}`, { method, headers: { cookie, origin: f.origin, ...(body ? { 'content-type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const createProgram = async (title: string) => (await (await send('/api/programs', { title }, 'POST')).json()).program;
    const first = await createProgram('First Gathering');
    const second = await createProgram('Second Gathering');
    const nodes = [
      { id: 'section', parentId: null, kind: 'section', label: 'Opening', detail: '', startTime: null, endTime: null },
      { id: 'song', parentId: 'section', kind: 'item', label: 'Opening Song', detail: 'Amazing Grace', startTime: null, endTime: null },
    ];
    expect((await send(`/api/programs/${first.id}/content`, { version: 1, nodes }, 'PUT')).status).toBe(200);
    expect((await send(`/api/programs/${second.id}/content`, { version: 1, nodes }, 'PUT')).status).toBe(200);
    const fields = { role: 'Speaker', name: 'Alex Placeholder', honorific: 'Dr.', position: 'Education Director', organization: 'Example Conference', subtitle: 'Guest speaker' };
    const response = await send('/api/participants', fields, 'POST');
    expect(response.status).toBe(201);
    const { participant } = await response.json();
    const duplicate = await (await send('/api/participants', fields, 'POST')).json();
    expect(duplicate.participant.id).not.toBe(participant.id);
    const reference = (id: string, targetId: string, targetKind: string, mode: 'name' | 'role') => ({ id, targetId, targetKind, kind: 'reference', value: '', role: '', name: '', extraInfo: 'Part note', intentionallyNotListed: false, participantId: participant.id, referenceMode: mode });
    const footer = [{ id: 'pianist', title: 'Pianist' }];
    expect((await send(`/api/programs/${first.id}/parts`, { version: 2, parts: [reference('first-reference', 'song', 'item', 'name'), reference('block-reference', 'section', 'section', 'role'), reference('footer-reference', 'pianist', 'footer', 'role')], footer }, 'PUT')).status).toBe(200);
    expect((await send(`/api/programs/${second.id}/parts`, { version: 2, parts: [reference('second-reference', 'song', 'item', 'role')], footer: [] }, 'PUT')).status).toBe(200);
    const firstRead = await (await send(`/api/programs/${first.id}`)).json();
    expect(firstRead.parts).toEqual(expect.arrayContaining([expect.objectContaining({ targetId: 'song', participantId: participant.id, referenceMode: 'name', participant: fields, extraInfo: 'Part note' }), expect.objectContaining({ targetId: 'section', targetKind: 'section', referenceMode: 'role' }), expect.objectContaining({ targetId: 'pianist', targetKind: 'footer', referenceMode: 'role' })]));
    expect((await (await send(`/api/programs/${first.id}/publish`, {}, 'POST')).json()).url).toBe(`/p/${first.id}`);
    const publicListing = await (await send(`/api/public/programs/${first.id}`)).json();
    expect(publicListing.parts[0].participant.name).toBe('Alex Placeholder');

    const updated = { ...fields, position: 'Senior Education Director' };
    const patch = await send(`/api/participants/${participant.id}`, updated, 'PATCH');
    expect(patch.status).toBe(200);
    expect((await patch.json()).participant.programs).toEqual(expect.arrayContaining([{ id: first.id, title: 'First Gathering', status: 'Published' }, { id: second.id, title: 'Second Gathering', status: 'Draft' }]));
    const changedPublic = await (await send(`/api/public/programs/${first.id}`)).json();
    expect(changedPublic.parts[0].participant.position).toBe('Senior Education Director');
    expect(changedPublic.parts[0].participant.name).toBe('Alex Placeholder');
    const invalidReference = await send(`/api/programs/${first.id}/parts`, { version: 3, parts: [{ id: 'invalid-reference', targetId: 'song', targetKind: 'item', kind: 'reference', value: '', role: '', name: '', extraInfo: '', intentionallyNotListed: false, participantId: 999999, referenceMode: 'role' }], footer }, 'PUT');
    expect(invalidReference.status).toBe(400);
    const deletion = await send(`/api/participants/${participant.id}`, {}, 'DELETE');
    expect(deletion.status, await deletion.text()).toBe(409);

    f.issuer.setSubject('outsider-placeholder');
    const outsider = await f.signIn();
    expect((await fetch(`${f.origin}/api/participants`, { headers: { cookie: outsider } })).status).toBe(403);
    expect((await fetch(`${f.origin}/api/programs/${first.id}`, { headers: { cookie: outsider } })).status).toBe(403);

    const db = openProduct(f.config.productPath);
    let foreignParticipantId: number;
    try {
      db.prepare("INSERT INTO identities (issuer, subject, label) VALUES (?, ?, 'Other owner')").run(f.config.testerIssuer, 'other-owner-placeholder');
      const otherOwner = (db.prepare('SELECT id FROM identities WHERE issuer = ? AND subject = ?').get(f.config.testerIssuer, 'other-owner-placeholder') as { id: number }).id;
      foreignParticipantId = Number(db.prepare("INSERT INTO participants (owner_id, role, name) VALUES (?, 'Reader', 'Taylor Placeholder')").run(otherOwner).lastInsertRowid);
    } finally { db.close(); }
    const visible = await (await send('/api/participants')).json();
    expect(visible.participants.some((item: { id: number }) => item.id === foreignParticipantId)).toBe(false);
    const foreignReference = { id: 'foreign-reference', targetId: 'song', targetKind: 'item', kind: 'reference', value: '', role: '', name: '', extraInfo: '', intentionallyNotListed: false, participantId: foreignParticipantId, referenceMode: 'name' };
    expect((await send(`/api/programs/${first.id}/parts`, { version: 3, parts: [foreignReference], footer: [] }, 'PUT')).status).toBe(400);
    expect((await send(`/api/participants/${foreignParticipantId}`, fields, 'PATCH')).status).toBe(404);
  } finally { await f.close(); }
});
