import { expect, it } from 'vitest';
import { openProduct } from '../src/db/product.js';
import { seedProduct } from '../src/demo/seed.js';
import { copiedPart } from '../src/domain/move-part.js';
import { fixture } from './support.js';

it('copies no participant while retaining extra info and explicit roles without inferring roles from text', () => {
  const base = { id: 'part', targetId: 'target', targetKind: 'item' as const, value: '', role: '', name: '', extraInfo: 'Placeholder notes', intentionallyNotListed: true };
  expect(copiedPart({ ...base, kind: 'reference', participantId: 7, referenceMode: 'name', participant: { role: 'Speaker', name: 'Alex Placeholder', honorific: 'Dr.', position: 'Director', organization: 'Example', subtitle: '' } }, 'without-participant')).toMatchObject({ kind: 'role', role: 'Speaker', name: '', extraInfo: 'Placeholder notes', participantId: undefined, intentionallyNotListed: false });
  expect(copiedPart({ ...base, kind: 'structured', role: 'Host', name: 'Jamie Placeholder' }, 'without-participant')).toMatchObject({ kind: 'role', role: 'Host', name: '', extraInfo: 'Placeholder notes' });
  expect(copiedPart({ ...base, kind: 'text', value: 'Congregation' }, 'without-participant')).toMatchObject({ kind: 'blank', value: '', role: '', name: '', extraInfo: 'Placeholder notes' });
});

it('moves one selected Part onto occupied content without replacing parallel Parts', async () => {
  const f = await fixture();
  try {
    seedProduct({ APP_ENV: 'dev', PRODUCT_DB_PATH: f.config.productPath, DEV_COORDINATOR_ISSUER: f.config.testerIssuer, DEV_COORDINATOR_SUBJECT: f.config.testerSubject });
    const cookie = await f.signIn();
    const events = await fetch(`${f.origin}/api/events`, { headers: { cookie } }).then(response => response.json());
    const sabbath = events.events.find((event: { name: string }) => event.name === 'Sabbath');
    const sourceProgram = sabbath.programs.find((program: { title: string }) => program.title === 'Divine Worship');
    const destinationProgram = sabbath.programs.find((program: { title: string }) => program.title === 'Sabbath School');
    const source = await fetch(`${f.origin}/api/programs/${sourceProgram.id}`, { headers: { cookie } }).then(response => response.json());
    const part = source.parts.find((entry: { id: string }) => entry.id === 'demo-move-speaker');
    const destination = await fetch(`${f.origin}/api/programs/${destinationProgram.id}`, { headers: { cookie } }).then(response => response.json());
    const target = destination.nodes.find((node: { id: string }) => node.id === `event-demo-sabbath-school-main`);
    const existing = destination.parts.filter((entry: { targetId: string }) => entry.targetId === target.id);
    expect(existing).toHaveLength(2);
    const response = await fetch(`${f.origin}/api/programs/${sourceProgram.id}/parts/${part.id}/transfer`, { method: 'POST', headers: { cookie, origin: f.origin, 'content-type': 'application/json' }, body: JSON.stringify({ destinationProgramId: destinationProgram.id, destinationTargetId: target.id, destinationTargetKind: target.kind, operation: 'move', sourceVersion: source.program.version, destinationVersion: destination.program.version }) });
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.source.parts.some((entry: { id: string }) => entry.id === part.id)).toBe(false);
    expect(result.destination.parts.filter((entry: { targetId: string }) => entry.targetId === target.id)).toHaveLength(3);
    expect(result.destination.parts).toEqual(expect.arrayContaining([expect.objectContaining({ id: part.id, participantId: part.participantId, referenceMode: part.referenceMode, extraInfo: part.extraInfo, targetId: target.id })]));
    expect(result.destination.nodes).toBeUndefined();
  } finally { await f.close(); }
});

it('copies everything with its shared reference and rejects cross-Event, standalone, and stale destinations atomically', async () => {
  const f = await fixture();
  try {
    seedProduct({ APP_ENV: 'dev', PRODUCT_DB_PATH: f.config.productPath, DEV_COORDINATOR_ISSUER: f.config.testerIssuer, DEV_COORDINATOR_SUBJECT: f.config.testerSubject });
    const cookie = await f.signIn();
    const events = await fetch(`${f.origin}/api/events`, { headers: { cookie } }).then(response => response.json());
    const sabbath = events.events.find((event: { name: string }) => event.name === 'Sabbath');
    const conference = events.events.find((event: { name: string }) => event.name === 'Example Conference');
    const sourceProgram = sabbath.programs.find((program: { title: string }) => program.title === 'Divine Worship');
    const source = await fetch(`${f.origin}/api/programs/${sourceProgram.id}`, { headers: { cookie } }).then(response => response.json());
    const part = source.parts.find((entry: { id: string }) => entry.id === 'demo-move-speaker');
    const destinationProgram = sabbath.programs.find((program: { title: string }) => program.title === 'Sabbath School');
    const destination = await fetch(`${f.origin}/api/programs/${destinationProgram.id}`, { headers: { cookie } }).then(response => response.json());
    const target = destination.nodes.find((node: { id: string }) => node.id.endsWith('-main'));
    const send = (id: number, targetId: string, targetKind: string, destVersion = destination.program.version) => fetch(`${f.origin}/api/programs/${sourceProgram.id}/parts/${part.id}/transfer`, { method: 'POST', headers: { cookie, origin: f.origin, 'content-type': 'application/json' }, body: JSON.stringify({ destinationProgramId: id, destinationTargetId: targetId, destinationTargetKind: targetKind, operation: 'copy', copyMode: 'everything', sourceVersion: source.program.version, destinationVersion: destVersion }) });
    const copied = await send(destinationProgram.id, target.id, target.kind);
    expect(copied.status).toBe(200);
    const copiedPart = (await copied.json()).destination.parts.find((entry: { id: string; participantId?: number }) => entry.id !== part.id && entry.participantId === part.participantId);
    expect(copiedPart).toMatchObject({ kind: 'reference', participantId: part.participantId, referenceMode: part.referenceMode, extraInfo: part.extraInfo });
    const foreignProgram = conference.programs[0];
    const foreign = await fetch(`${f.origin}/api/programs/${foreignProgram.id}`, { headers: { cookie } }).then(response => response.json());
    const foreignTarget = foreign.nodes.find((node: { kind: string }) => node.kind === 'item');
    expect((await send(foreignProgram.id, foreignTarget.id, foreignTarget.kind, foreign.program.version)).status).toBe(403);
    const standalone = await fetch(`${f.origin}/api/programs`, { method: 'POST', headers: { cookie, origin: f.origin, 'content-type': 'application/json' }, body: JSON.stringify({ title: 'Standalone Placeholder' }) }).then(response => response.json());
    const standaloneDetail = await fetch(`${f.origin}/api/programs/${standalone.program.id}`, { headers: { cookie } }).then(response => response.json());
    expect((await send(standalone.program.id, 'not-a-target', 'item', standaloneDetail.program.version)).status).toBe(403);
    expect((await send(destinationProgram.id, target.id, target.kind, 1)).status).toBe(409);
    const latestSource = await fetch(`${f.origin}/api/programs/${sourceProgram.id}`, { headers: { cookie } }).then(response => response.json());
    expect(latestSource.parts.some((entry: { id: string }) => entry.id === part.id)).toBe(true);
    f.issuer.setSubject('other-coordinator-placeholder');
    const unauthorized = await f.signIn();
    expect((await fetch(`${f.origin}/api/programs/${sourceProgram.id}/parts/${part.id}/transfer`, { method: 'POST', headers: { cookie: unauthorized, origin: f.origin, 'content-type': 'application/json' }, body: JSON.stringify({ destinationProgramId: destinationProgram.id, destinationTargetId: target.id, destinationTargetKind: target.kind, operation: 'move', sourceVersion: latestSource.program.version, destinationVersion: destination.program.version }) })).status).toBe(403);
    expect((await fetch(`${f.origin}/api/programs/${sourceProgram.id}`, { headers: { cookie } }).then(response => response.json())).parts.some((entry: { id: string }) => entry.id === part.id)).toBe(true);
  } finally { await f.close(); }
});

it('preserves demo Part removals on repeat seed and keeps the configured coordinator on every demo Program', async () => {
  const f = await fixture();
  try {
    const env = { APP_ENV: 'dev', PRODUCT_DB_PATH: f.config.productPath, DEV_COORDINATOR_ISSUER: f.config.testerIssuer, DEV_COORDINATOR_SUBJECT: f.config.testerSubject };
    seedProduct(env);
    const db = openProduct(f.config.productPath);
    try {
      const program = db.prepare("SELECT id FROM programs WHERE seed_key = 'demo-divine-worship'").get() as { id: number };
      db.prepare("DELETE FROM parts WHERE program_id = ? AND id = 'demo-parallel-role'").run(program.id);
    } finally { db.close(); }
    seedProduct(env);
    const reloaded = openProduct(f.config.productPath);
    try {
      const program = reloaded.prepare("SELECT id FROM programs WHERE seed_key = 'demo-divine-worship'").get() as { id: number };
      expect(reloaded.prepare("SELECT 1 FROM parts WHERE program_id = ? AND id = 'demo-parallel-role'").get(program.id)).toBeUndefined();
      expect((reloaded.prepare('SELECT COUNT(*) AS count FROM programs WHERE seed_key IS NOT NULL AND owner_id = (SELECT id FROM identities WHERE issuer = ? AND subject = ?)').get(f.config.testerIssuer, f.config.testerSubject) as { count: number }).count).toBeGreaterThan(5);
    } finally { reloaded.close(); }
  } finally { await f.close(); }
});
