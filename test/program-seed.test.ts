import { expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { identityMigration } from '../src/db/migrations/001-identity.js';
import { openProduct } from '../src/db/product.js';
import { seedProduct } from '../src/demo/seed.js';
import { fixture } from './support.js';

it('upgrades a U1 database additively, replays safely, and keeps U1 identity/session queries compatible', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rundown-upgrade-'));
  const path = join(dir, 'product.sqlite');
  try {
    const old = new DatabaseSync(path);
    old.exec('PRAGMA foreign_keys=ON; CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY)');
    old.exec(identityMigration.sql);
    old.exec("INSERT INTO schema_migrations VALUES (1); INSERT INTO identities VALUES (1, 'https://issuer.example.invalid', 'placeholder', 'Dev tester'); INSERT INTO coordinator_grants VALUES (1, 'dev'); INSERT INTO sessions VALUES ('hashed-placeholder', 1, 9999999999999, NULL, NULL, NULL)");
    old.close();
    for (let attempt = 0; attempt < 2; attempt++) {
      const db = openProduct(path);
      expect(db.prepare('SELECT version FROM schema_migrations ORDER BY version').all()).toEqual([{ version: 1 }, { version: 2 }, { version: 3 }, { version: 4 }, { version: 5 }, { version: 6 }, { version: 7 }, { version: 8 }, { version: 9 }, { version: 10 }]);
      expect(db.prepare('SELECT * FROM sessions WHERE id = ? AND expires_at > ?').get('hashed-placeholder', Date.now())).toMatchObject({ identity_id: 1 });
      expect(db.prepare('SELECT * FROM identities WHERE id = ?').get(1)).toMatchObject({ subject: 'placeholder' });
      expect(db.prepare('SELECT 1 FROM coordinator_grants WHERE identity_id = ?').get(1)).toBeDefined();
      expect(db.prepare('SELECT * FROM programs').all()).toEqual([]);
      db.close();
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

it('seeds before first sign-in, grants the configured coordinator access, and preserves later edits and unrelated records', async () => {
  const f = await fixture();
  const env = { APP_ENV: 'dev', PRODUCT_DB_PATH: f.config.productPath, DEV_COORDINATOR_ISSUER: f.config.testerIssuer, DEV_COORDINATOR_SUBJECT: f.config.testerSubject };
  try {
    expect(() => seedProduct({ APP_ENV: 'dev', PRODUCT_DB_PATH: f.config.productPath })).toThrow('DEV_COORDINATOR');
    seedProduct(env); seedProduct(env);
    const cookie = await f.signIn();
    const response = await fetch(`${f.origin}/api/programs`, { headers: { cookie } });
    expect(response.status).toBe(200);
    const { programs } = await response.json();
    expect(programs).toHaveLength(11);
    expect(programs.find((program: { title: string }) => program.title === 'Community Gathering')).toMatchObject({ status: 'Draft', date: null, startTime: '09:00', endTime: '12:00' });
    expect(programs.find((program: { title: string }) => program.title === 'Example Published Program')).toMatchObject({ status: 'Published', subtitle: 'A day of gratitude' });
    const seededCommunity = programs.find((program: { title: string }) => program.title === 'Community Gathering');
    const seededListing = await fetch(`${f.origin}/api/programs/${seededCommunity.id}`, { headers: { cookie } }).then(response => response.json());
    expect(seededListing.parts).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'reference', referenceMode: 'name', participant: expect.objectContaining({ name: 'Alex Placeholder', role: 'Speaker', honorific: 'Dr.' }) }), expect.objectContaining({ intentionallyNotListed: true })]));
    const seededSpeaker = seededListing.parts.find((part: { kind: string }) => part.kind === 'reference');
    const seededPublishedProgram = programs.find((program: { title: string }) => program.title === 'Example Published Program');
    const publishedListing = await fetch(`${f.origin}/api/programs/${seededPublishedProgram.id}`, { headers: { cookie } }).then(response => response.json());
    expect(publishedListing.parts).toEqual(expect.arrayContaining([expect.objectContaining({ participantId: seededSpeaker.participantId, referenceMode: 'role' })]));
    const definitions = await fetch(`${f.origin}/api/participants`, { headers: { cookie } }).then(response => response.json());
    expect(definitions.participants).toHaveLength(3);
    expect(seededListing.footer).toEqual([{ id: 'demo-pianist', title: 'Pianist' }]);
    const db = openProduct(f.config.productPath);
    try {
      expect(db.prepare("SELECT name FROM events WHERE seed_key IN ('demo-event-sabbath', 'demo-event-conference') ORDER BY name").all()).toEqual([{ name: 'Example Conference' }, { name: 'Sabbath' }]);
      expect(db.prepare("SELECT p.title, p.date, e.name AS event FROM programs p JOIN events e ON e.id = p.event_id WHERE p.seed_key IN ('demo-sabbath-vesper', 'demo-sabbath-school', 'demo-divine-worship', 'demo-ay') ORDER BY p.event_position").all()).toEqual([
        { title: 'Vesper', date: '2026-11-06', event: 'Sabbath' }, { title: 'Sabbath School', date: '2026-11-07', event: 'Sabbath' }, { title: 'Divine Worship', date: '2026-11-07', event: 'Sabbath' }, { title: 'AY', date: '2026-11-07', event: 'Sabbath' },
      ]);
      const community = programs.find((program: { title: string }) => program.title === 'Community Gathering');
      db.prepare('UPDATE programs SET title = ?, subtitle = ?, date = ?, version = version + 1 WHERE id = ?').run('Edited Gathering', 'Saved subtitle', '2026-11-07', community.id);
      const owner = db.prepare('SELECT owner_id FROM programs WHERE id = ?').get(programs[0].id) as { owner_id: number };
      db.prepare('INSERT INTO programs (owner_id, title) VALUES (?, ?)').run(owner.owner_id, 'Unrelated Draft');
      db.prepare("UPDATE programs SET subtitle = 'Saved custom subtitle' WHERE seed_key = 'standalone-published-example'").run();
      const before = db.prepare('SELECT * FROM programs ORDER BY id').all();
      const sessions = db.prepare('SELECT * FROM sessions').all();
      expect(db.prepare('SELECT label FROM content_nodes WHERE program_id = ? ORDER BY position').all(programs.find((program: { title: string }) => program.title === 'Community Gathering').id)).toEqual([
        { label: 'Call to Worship' }, { label: '*Introit' }, { label: 'Prayer' }, { label: 'The Spoken Word' }, { label: 'Reading' }, { label: '' }, { label: 'Closing Remarks' },
      ]);
      db.prepare("UPDATE content_nodes SET detail = 'Edited detail' WHERE id = 'demo-introit'").run();
      db.prepare("UPDATE participants SET name = 'Edited Placeholder' WHERE seed_key = 'demo-speaker'").run();
      db.prepare("UPDATE footer_roles SET title = 'Edited Pianist' WHERE id = 'demo-pianist'").run();
      const content = db.prepare('SELECT * FROM content_nodes ORDER BY position').all();
      seedProduct(env);
      expect(db.prepare('SELECT * FROM content_nodes ORDER BY position').all()).toEqual(content);
      expect(db.prepare("SELECT name FROM participants WHERE seed_key = 'demo-speaker'").get()).toEqual({ name: 'Edited Placeholder' });
      expect(db.prepare("SELECT title FROM footer_roles WHERE id = 'demo-pianist'").get()).toEqual({ title: 'Edited Pianist' });
      expect(db.prepare('SELECT * FROM programs ORDER BY id').all()).toEqual(before);
      expect(db.prepare('SELECT * FROM sessions').all()).toEqual(sessions);
      // Retarget only demo ownership if the operator replaces the mapped synthetic identity.
      seedProduct({ ...env, DEV_COORDINATOR_SUBJECT: 'replacement-placeholder' });
      const replacement = db.prepare('SELECT id FROM identities WHERE subject = ?').get('replacement-placeholder') as { id: number };
      expect(db.prepare("SELECT owner_id, title, version FROM programs WHERE seed_key = 'standalone-community-gathering'").get()).toEqual({ owner_id: replacement.id, title: 'Edited Gathering', version: 4 });
      expect(db.prepare("SELECT owner_id FROM participants WHERE seed_key = 'demo-speaker'").get()).toEqual({ owner_id: replacement.id });
      expect(db.prepare('SELECT owner_id FROM programs WHERE seed_key IS NULL').get()).toEqual({ owner_id: owner.owner_id });
      db.prepare("DELETE FROM parts WHERE id IN ('demo-welcome-speaker', 'demo-introit-leader')").run();
      db.prepare("DELETE FROM participants WHERE seed_key = 'demo-reader'").run();
      const removed = db.prepare('SELECT id, version FROM programs ORDER BY id').all();
      seedProduct(env);
      expect(db.prepare("SELECT id FROM parts WHERE id IN ('demo-welcome-speaker', 'demo-introit-leader')").all()).toEqual([]);
      expect(db.prepare("SELECT seed_key FROM participants ORDER BY seed_key").all()).toEqual([{ seed_key: 'demo-pianist-participant' }, { seed_key: 'demo-speaker' }]);
      expect(db.prepare('SELECT id, version FROM programs ORDER BY id').all()).toEqual(removed);
      db.prepare('DELETE FROM content_nodes').run();
      seedProduct(env);
      expect(db.prepare('SELECT * FROM content_nodes').all()).toEqual([]);
    } finally { db.close(); }
  } finally { await f.close(); }
});
