import { expect, it } from 'vitest';
import { openProduct } from '../src/db/product.js';
import { fixture } from './support.js';

it('aggregates Event and standalone assignments by definition and Part location, with Program filtering', async () => {
  const f = await fixture();
  try {
    const cookie = await f.signIn();
    const send = (path: string, body?: unknown, method = 'GET') => fetch(`${f.origin}${path}`, { method, headers: { cookie, origin: f.origin, ...(body ? { 'content-type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const event = (await (await send('/api/events', { name: 'Sabbath Placeholder' }, 'POST')).json()).event;
    const create = async (title: string) => (await (await send('/api/programs', { title }, 'POST')).json()).program;
    const first = await create('Divine Worship Placeholder'); const second = await create('Vesper Placeholder');
    await send(`/api/events/${event.id}/programs`, { programIds: [first.id, second.id] }, 'PUT');
    const nodes = (prefix: string) => [
      { id: `${prefix}-section`, parentId: null, kind: 'section', label: 'Worship Placeholder', detail: '', startTime: null, endTime: null },
      { id: `${prefix}-nested`, parentId: `${prefix}-section`, kind: 'section', label: 'Nested Placeholder', detail: '', startTime: null, endTime: null },
      { id: `${prefix}-item`, parentId: `${prefix}-nested`, kind: 'item', label: 'Prayer Placeholder', detail: '', startTime: null, endTime: null },
    ];
    await send(`/api/programs/${first.id}/content`, { version: 1, nodes: nodes('first') }, 'PUT');
    await send(`/api/programs/${second.id}/content`, { version: 1, nodes: nodes('second') }, 'PUT');
    const definition = (await (await send('/api/participants', { role: 'Speaker', name: 'Alex Placeholder', honorific: '', position: '', organization: '', subtitle: '' }, 'POST')).json()).participant;
    const part = (id: string, targetId: string, kind: string, extras = {}) => ({ id, targetId, targetKind: 'item', kind, value: kind === 'text' ? 'Congregation Placeholder' : '', role: '', name: '', extraInfo: '', intentionallyNotListed: false, ...extras });
    await send(`/api/programs/${first.id}/parts`, { version: 2, parts: [part('first-speaker', 'first-item', 'reference', { participantId: definition.id, referenceMode: 'name' }), part('parallel-speaker', 'first-item', 'reference', { participantId: definition.id, referenceMode: 'role' }), part('first-text', 'first-item', 'text')], footer: [{ id: 'footer', title: 'Pianist Placeholder' }] }, 'PUT');
    await send(`/api/programs/${second.id}/parts`, { version: 2, parts: [part('second-speaker', 'second-item', 'reference', { participantId: definition.id, referenceMode: 'role' }), part('second-text', 'second-item', 'text')], footer: [] }, 'PUT');
    const all = await (await send(`/api/events/${event.id}/participants`)).json();
    expect(all.namedParticipants).toHaveLength(1);
    expect(all.namedParticipants[0].assignments.map((item: { partId: string }) => item.partId)).toEqual(['first-speaker', 'parallel-speaker', 'second-speaker']);
    expect(all.textAssignments.map((item: { value: string }) => item.value)).toEqual(['Congregation Placeholder', 'Congregation Placeholder']);
    expect(all.textAssignments[0].assignments[0].url).toContain('#part-first-text');
    await expect((await send(`/api/events/${event.id}/participants?programId=${second.id}`)).json()).resolves.toMatchObject({ namedParticipants: [expect.objectContaining({ assignments: [expect.objectContaining({ programId: second.id })] })], textAssignments: [expect.objectContaining({ assignments: [expect.objectContaining({ programId: second.id })] })] });
    await send(`/api/participants/${definition.id}`, { role: 'Guest Speaker', name: 'Alex Updated Placeholder', honorific: '', position: '', organization: '', subtitle: '' }, 'PATCH');
    expect((await (await send(`/api/events/${event.id}/participants`)).json()).namedParticipants[0].name).toBe('Alex Updated Placeholder');
    await send(`/api/programs/${first.id}/parts`, { version: 3, parts: [part('first-text', 'first-item', 'text')], footer: [{ id: 'footer', title: 'Pianist Placeholder' }] }, 'PUT');
    expect((await (await send(`/api/events/${event.id}/participants`)).json()).namedParticipants[0].assignments.map((item: { partId: string }) => item.partId)).toEqual(['second-speaker']);
    expect((await send(`/api/programs/${first.id}/participants`)).status).toBe(200);
    expect((await send(`/api/events/${event.id}/participants?programId=99999`)).status).toBe(404);
  } finally { await f.close(); }
});

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

it('lists Footer roles after content, keeps same-name definitions apart, groups unnamed roles, and gates Event access', async () => {
  const f = await fixture();
  try {
    const cookie = await f.signIn();
    const send = (path: string, body?: unknown, method = 'GET') => fetch(`${f.origin}${path}`, { method, headers: { cookie, origin: f.origin, ...(body ? { 'content-type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const event = (await (await send('/api/events', { name: 'Gate Placeholder' }, 'POST')).json()).event;
    const program = (await (await send('/api/programs', { title: 'Footer Placeholder' }, 'POST')).json()).program;
    await send(`/api/events/${event.id}/programs`, { programIds: [program.id] }, 'PUT');
    expect((await send(`/api/programs/${program.id}/content`, { version: 1, nodes: [{ id: 'section', parentId: null, kind: 'section', label: 'Worship Placeholder', detail: '', startTime: null, endTime: null }, { id: 'shared', parentId: 'section', kind: 'item', label: 'Opening Placeholder', detail: '', startTime: null, endTime: null }] }, 'PUT')).status).toBe(200);
    const define = async (name: string) => (await (await send('/api/participants', { role: 'Reader', name, honorific: '', position: '', organization: '', subtitle: '' }, 'POST')).json()).participant;
    const first = await define('Sam Placeholder'); const twin = await define('Sam Placeholder'); const unnamed = await define('');
    const part = (id: string, targetId: string, targetKind: string, kind: string, extras = {}) => ({ id, targetId, targetKind, kind, value: '', role: '', name: '', extraInfo: '', intentionallyNotListed: false, ...extras });
    const saved = await send(`/api/programs/${program.id}/parts`, { version: 2, parts: [
      part('footer-reader', 'shared', 'footer', 'reference', { participantId: first.id, referenceMode: 'name' }),
      part('item-reader', 'shared', 'item', 'reference', { participantId: first.id, referenceMode: 'name' }),
      part('twin-reader', 'shared', 'item', 'reference', { participantId: twin.id, referenceMode: 'name' }),
      part('unnamed-reader', 'shared', 'item', 'reference', { participantId: unnamed.id, referenceMode: 'role' }),
      part('direct-role', 'shared', 'item', 'role', { role: 'Usher Placeholder' }),
    ], footer: [{ id: 'shared', title: 'Pianist Placeholder' }] }, 'PUT');
    expect(saved.status, await saved.text()).toBe(200);
    const list = await (await send(`/api/events/${event.id}/participants`)).json();
    expect(list.namedParticipants.map((item: { participantId: number }) => item.participantId)).toEqual([first.id, twin.id]);
    expect(list.namedParticipants[0].assignments.map((item: { partId: string; targetLabel: string; footerTitle: string | null }) => [item.partId, item.targetLabel, item.footerTitle])).toEqual([['item-reader', 'Opening Placeholder', null], ['footer-reader', 'Pianist Placeholder', 'Pianist Placeholder']]);
    expect(list.awaitingName).toEqual([expect.objectContaining({ participantId: unnamed.id, role: 'Reader' }), expect.objectContaining({ role: 'Usher Placeholder' })]);
    expect(list.awaitingName[1].participantId).toBeUndefined();

    expect((await fetch(`${f.origin}/api/events/${event.id}/participants`)).status).toBe(401);
    expect((await fetch(`${f.origin}/api/programs/${program.id}/participants`)).status).toBe(401);
    const db = openProduct(f.config.productPath);
    let foreignEvent: number;
    try {
      db.prepare("INSERT INTO identities (issuer, subject, label) VALUES (?, ?, 'Other owner')").run(f.config.testerIssuer, 'event-owner-placeholder');
      const owner = (db.prepare('SELECT id FROM identities WHERE subject = ?').get('event-owner-placeholder') as { id: number }).id;
      foreignEvent = Number(db.prepare("INSERT INTO events (owner_id, name) VALUES (?, 'Foreign Placeholder')").run(owner).lastInsertRowid);
    } finally { db.close(); }
    expect((await send(`/api/events/${foreignEvent}/participants`)).status).toBe(404);
    f.issuer.setSubject('outsider-placeholder');
    const outsider = await f.signIn();
    expect((await fetch(`${f.origin}/api/events/${event.id}/participants`, { headers: { cookie: outsider } })).status).toBe(403);
  } finally { await f.close(); }
});
