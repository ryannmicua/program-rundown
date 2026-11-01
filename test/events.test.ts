import { expect, it } from 'vitest';
import { openProduct } from '../src/db/product.js';
import { seedProduct } from '../src/demo/seed.js';
import { fixture } from './support.js';

it('groups ordered Programs, grants Event-wide coordinator access, and keeps anonymous readers within published Event links', async () => {
  const f = await fixture();
  try {
    seedProduct({ APP_ENV: 'dev', PRODUCT_DB_PATH: f.config.productPath, DEV_COORDINATOR_ISSUER: f.config.testerIssuer, DEV_COORDINATOR_SUBJECT: f.config.testerSubject });
    const cookie = await f.signIn();
    const eventsResponse = await fetch(`${f.origin}/api/events`, { headers: { cookie } });
    expect(eventsResponse.status).toBe(200);
    const events = (await eventsResponse.json()).events;
    const sabbath = events.find((event: { name: string }) => event.name === 'Sabbath');
    expect(sabbath.groupByDate).toBe(true);
    expect(sabbath.programs.map((program: { title: string }) => program.title)).toEqual(['Vesper', 'Sabbath School', 'Divine Worship', 'AY', 'Vesper', 'Divine Worship']);
    const ids = sabbath.programs.slice(0, 4).map((program: { id: number }) => program.id);
    const anonymous = await fetch(`${f.origin}/api/public/events/${sabbath.id}`);
    expect(anonymous.status).toBe(200);
    const listing = await anonymous.json();
    expect(listing.programs.map((program: { title: string }) => program.title)).toEqual(['Vesper', 'Divine Worship']);
    expect(listing.programs.every((program: { status: string }) => program.status === 'Published')).toBe(true);
    expect((await fetch(`${f.origin}/api/public/events/${sabbath.id}/programs/${ids[1]}`)).status).toBe(404);
    const published = await fetch(`${f.origin}/api/programs/${ids[1]}/publish`, { method: 'POST', headers: { cookie, origin: f.origin, 'content-type': 'application/json' }, body: '{}' });
    expect(published.status).toBe(200);
    const afterPublish = await fetch(`${f.origin}/api/public/events/${sabbath.id}`).then(r => r.json());
    expect(afterPublish).toMatchObject({ programs: expect.arrayContaining([expect.objectContaining({ id: ids[1], title: 'Sabbath School' })]) });

    const edited = await fetch(`${f.origin}/api/programs/${ids[1]}`, { method: 'PATCH', headers: { cookie, origin: f.origin, 'content-type': 'application/json' }, body: JSON.stringify({ title: 'Updated Sabbath School', date: '2026-11-08', version: sabbath.programs.find((program: { id: number; version: number }) => program.id === ids[1])?.version || 1 }) });
    expect(edited.status).toBe(200);
    const freshEvent = await fetch(`${f.origin}/api/events/${sabbath.id}`, { headers: { cookie } }).then(r => r.json());
    expect(freshEvent.programs[1]).toMatchObject({ title: 'Updated Sabbath School', date: '2026-11-08' });
    const afterDateChange = await fetch(`${f.origin}/api/public/events/${sabbath.id}`).then(r => r.json());
    expect(afterDateChange.programs.find((program: { id: number }) => program.id === ids[1])).toMatchObject({ date: '2026-11-08' });
    const grouping = await fetch(`${f.origin}/api/events/${sabbath.id}`, { method: 'PATCH', headers: { cookie, origin: f.origin, 'content-type': 'application/json' }, body: JSON.stringify({ groupByDate: false }) });
    expect(Boolean((await grouping.json()).event.groupByDate)).toBe(false);

    const db = openProduct(f.config.productPath);
    let conferenceId: number;
    let foreignOwnerId: number;
    try {
      conferenceId = Number((db.prepare("SELECT id FROM events WHERE seed_key = 'demo-event-conference'").get() as { id: number }).id);
      const foreign = db.prepare('INSERT INTO identities (issuer, subject, label) VALUES (?, ?, ?)').run(f.config.testerIssuer, 'program-owner-placeholder', 'Program owner');
      foreignOwnerId = Number(foreign.lastInsertRowid);
      db.prepare('UPDATE programs SET owner_id = ? WHERE id = ?').run(foreignOwnerId, ids[2]);
      const participantId = Number(db.prepare("INSERT INTO participants (owner_id, role, name) VALUES (?, 'Session Host', 'Taylor Placeholder')").run(foreignOwnerId).lastInsertRowid);
      const target = db.prepare('SELECT id FROM content_nodes WHERE program_id = ? AND kind = ? ORDER BY position LIMIT 1').get(ids[2], 'item') as { id: string };
      db.prepare("INSERT INTO parts (program_id, id, target_id, target_kind, kind, participant_id, reference_mode, intentionally_not_listed, position) VALUES (?, 'event-owned-participant', ?, 'item', 'reference', ?, 'name', 1, 100)").run(ids[2], target.id, participantId);
    }
    finally { db.close(); }
    const eventReader = await fetch(`${f.origin}/api/public/events/${sabbath.id}/programs/${ids[2]}`).then(r => r.json());
    const readerPart = eventReader.parts.find((part: { id: string }) => part.id === 'event-owned-participant');
    expect(readerPart).toBeDefined();
    expect(readerPart).not.toHaveProperty('intentionallyNotListed');
    const conferenceListing = await fetch(`${f.origin}/api/public/events/${conferenceId}`).then(r => r.json());
    expect(conferenceListing.programs).toEqual([expect.objectContaining({ title: 'Conference Welcome', date: null, status: 'Published' })]);
    const participantsResponse = await fetch(`${f.origin}/api/participants`, { headers: { cookie } });
    const eventParticipant = (await participantsResponse.json()).participants.find((participant: { name: string }) => participant.name === 'Taylor Placeholder');
    expect(eventParticipant.programs).toEqual([expect.objectContaining({ id: ids[2], title: 'Divine Worship' })]);
    const updateParticipant = await fetch(`${f.origin}/api/participants/${eventParticipant.id}`, { method: 'PATCH', headers: { cookie, origin: f.origin, 'content-type': 'application/json' }, body: JSON.stringify({ role: 'Session Host', name: 'Updated Placeholder', honorific: '', position: '', organization: '', subtitle: '' }) });
    expect(updateParticipant.status).toBe(403);
    expect(await updateParticipant.json()).toMatchObject({ code: 'participant-not-owner', error: expect.stringContaining('Only the coordinator who created this Participant') });
    const deleteParticipant = await fetch(`${f.origin}/api/participants/${eventParticipant.id}`, { method: 'DELETE', headers: { cookie, origin: f.origin, 'content-type': 'application/json' }, body: '{}' });
    expect(deleteParticipant.status).toBe(403);
    const eventProgram = await fetch(`${f.origin}/api/programs/${ids[2]}`, { headers: { cookie } }).then(r => r.json());
    expect(eventProgram.program.title).toBe('Divine Worship');
    expect(eventProgram.parts).toEqual(expect.arrayContaining([expect.objectContaining({ participant: expect.objectContaining({ name: 'Taylor Placeholder' }) })]));
    const saveEventParts = await fetch(`${f.origin}/api/programs/${ids[2]}/parts`, { method: 'PUT', headers: { cookie, origin: f.origin, 'content-type': 'application/json' }, body: JSON.stringify({ version: eventProgram.program.version, parts: eventProgram.parts.map(({ participant, ...part }: { participant?: unknown; [key: string]: unknown }) => part), footer: eventProgram.footer }) });
    expect(saveEventParts.status).toBe(200);
    const crossEvent = await fetch(`${f.origin}/api/events/${conferenceId}/programs`, { method: 'PUT', headers: { cookie, origin: f.origin, 'content-type': 'application/json' }, body: JSON.stringify({ programIds: [ids[0]] }) });
    expect(crossEvent.status).toBe(409);
    const remainingIds = ids.slice(1).filter((id: number) => id !== ids[2]);
    const unlink = await fetch(`${f.origin}/api/events/${sabbath.id}/programs`, { method: 'PUT', headers: { cookie, origin: f.origin, 'content-type': 'application/json' }, body: JSON.stringify({ programIds: remainingIds }) });
    expect(unlink.status).toBe(200);
    expect((await unlink.json()).programs.map((program: { id: number }) => program.id)).toEqual(remainingIds);
    expect((await fetch(`${f.origin}/api/programs/${ids[0]}`, { headers: { cookie } })).status).toBe(200);
    expect((await fetch(`${f.origin}/api/programs/${ids[2]}`, { headers: { cookie } })).status).toBe(404);
    const retainedOwner = openProduct(f.config.productPath);
    try { expect(retainedOwner.prepare('SELECT owner_id FROM programs WHERE id = ?').get(ids[2])).toEqual({ owner_id: foreignOwnerId }); }
    finally { retainedOwner.close(); }
    const afterUnlinkParticipants = await fetch(`${f.origin}/api/participants`, { headers: { cookie } }).then(r => r.json());
    expect(afterUnlinkParticipants.participants.some((participant: { name: string }) => participant.name === 'Taylor Placeholder')).toBe(false);

    f.issuer.setSubject('other-coordinator-placeholder');
    const stranger = await f.signIn();
    expect((await fetch(`${f.origin}/api/events/${sabbath.id}`, { headers: { cookie: stranger } })).status).toBe(403);
    expect((await fetch(`${f.origin}/api/programs/${ids[2]}`, { headers: { cookie: stranger } })).status).toBe(403);
    expect((await fetch(`${f.origin}/api/events`, { headers: { cookie: stranger } })).status).toBe(403);
    expect((await fetch(`${f.origin}/api/events`)).status).toBe(401);
    expect((await fetch(`${f.origin}/api/public/events/${sabbath.id}`)).status).toBe(200);
  } finally { await f.close(); }
});
