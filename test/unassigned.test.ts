import { expect, it } from 'vitest';
import { openProduct } from '../src/db/product.js';
import { awaitsNamedAssignment } from '../src/domain/unassigned.js';
import { fixture } from './support.js';

it('classifies blank and unnamed role assignments while preserving free text and intentional omissions', () => {
  const base = { value: '', name: '', intentionallyNotListed: false };
  expect(awaitsNamedAssignment({ ...base, kind: 'blank' })).toBe(true);
  expect(awaitsNamedAssignment({ ...base, kind: 'blank', intentionallyNotListed: true })).toBe(false);
  expect(awaitsNamedAssignment({ ...base, kind: 'role' })).toBe(true);
  expect(awaitsNamedAssignment({ ...base, kind: 'structured', name: 'Alex Placeholder' })).toBe(false);
  expect(awaitsNamedAssignment({ ...base, kind: 'reference', participant: { role: 'Reader', name: '', honorific: '', position: '', organization: '', subtitle: '' } })).toBe(true);
  expect(awaitsNamedAssignment({ ...base, kind: 'text', value: '   ' })).toBe(true);
  expect(awaitsNamedAssignment({ ...base, kind: 'text', value: 'Congregation' })).toBe(false);
  expect(awaitsNamedAssignment({ ...base, kind: 'text', value: 'TBA' })).toBe(false);
});

it('lists unassigned Parts across accessible Programs, links each location, and excludes protected Programs', async () => {
  const f = await fixture();
  try {
    const cookie = await f.signIn();
    const send = (path: string, body?: unknown, method = 'GET') => fetch(`${f.origin}${path}`, { method, headers: { cookie, origin: f.origin, ...(body ? { 'content-type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const first = (await (await send('/api/programs', { title: 'First Placeholder' }, 'POST')).json()).program;
    const second = (await (await send('/api/programs', { title: 'Second Placeholder' }, 'POST')).json()).program;
    const nodes = [{ id: 'section', parentId: null, kind: 'section', label: 'Opening', detail: '', startTime: null, endTime: null }, { id: 'song', parentId: 'section', kind: 'item', label: 'Opening Song', detail: '', startTime: null, endTime: null }];
    for (const program of [first, second]) expect((await send(`/api/programs/${program.id}/content`, { version: program.version, nodes }, 'PUT')).status).toBe(200);
    const participant = (await (await send('/api/participants', { role: 'Reader', name: '', honorific: '', position: '', organization: '', subtitle: '' }, 'POST')).json()).participant;
    const parts = [
      { id: 'role-only', targetId: 'song', targetKind: 'item', kind: 'role', value: '', role: 'Reader', name: '', extraInfo: '', intentionallyNotListed: false },
      { id: 'blank-with-notes', targetId: 'section', targetKind: 'section', kind: 'blank', value: '', role: '', name: '', extraInfo: 'Placeholder note', intentionallyNotListed: false },
      { id: 'unlisted', targetId: 'song', targetKind: 'item', kind: 'blank', value: '', role: '', name: '', extraInfo: '', intentionallyNotListed: true },
      { id: 'text-group', targetId: 'song', targetKind: 'item', kind: 'text', value: 'Congregation', role: '', name: '', extraInfo: '', intentionallyNotListed: false },
      { id: 'role-reference', targetId: 'song', targetKind: 'item', kind: 'reference', value: '', role: '', name: '', extraInfo: '', intentionallyNotListed: false, participantId: participant.id, referenceMode: 'role' },
    ];
    expect((await send(`/api/programs/${first.id}/parts`, { version: 2, parts, footer: [] }, 'PUT')).status).toBe(200);
    expect((await send(`/api/programs/${second.id}/parts`, { version: 2, parts: [{ ...parts[0], id: 'second-role', name: 'Jamie Placeholder' }], footer: [] }, 'PUT')).status).toBe(200);
    const db = openProduct(f.config.productPath);
    try {
      db.prepare("INSERT INTO identities (issuer, subject, label) VALUES (?, 'protected-owner-placeholder', 'Protected owner')").run(f.config.testerIssuer);
      const owner = (db.prepare("SELECT id FROM identities WHERE issuer = ? AND subject = 'protected-owner-placeholder'").get(f.config.testerIssuer) as { id: number }).id;
      db.prepare("INSERT INTO programs (owner_id, title) VALUES (?, 'Protected Draft Placeholder')").run(owner);
    } finally { db.close(); }
    const result = await (await send('/api/unassigned')).json();
    expect(result.programs.map((program: { id: number }) => program.id)).toEqual(expect.arrayContaining([first.id, second.id]));
    expect(result.programs.some((program: { title: string }) => program.title === 'Protected Draft Placeholder')).toBe(false);
    expect(result.parts.map((part: { id: string }) => part.id)).toEqual(['role-only', 'blank-with-notes', 'role-reference']);
    expect(result.parts[0]).toMatchObject({ programId: first.id, programTitle: 'First Placeholder', targetPath: 'Opening › Opening Song' });
    expect(result.parts[1]).toMatchObject({ targetLabel: 'Opening', extraInfo: 'Placeholder note' });
    expect(result.parts[2].participant).toMatchObject({ role: 'Reader', name: '' });
    const filtered = result.parts.filter((part: { programId: number }) => part.programId === first.id);
    expect(filtered).toHaveLength(3);
    expect((await send('/api/unassigned')).status).toBe(200);
    f.issuer.setSubject('outside-coordinator-placeholder');
    const outsider = await f.signIn();
    expect((await fetch(`${f.origin}/api/unassigned`, { headers: { cookie: outsider } })).status).toBe(403);
  } finally { await f.close(); }
});
