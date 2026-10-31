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
      expect(db.prepare('SELECT version FROM schema_migrations ORDER BY version').all()).toEqual([{ version: 1 }, { version: 2 }, { version: 3 }]);
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
    expect(programs).toHaveLength(1);
    expect(programs[0]).toMatchObject({ title: 'Community Gathering', status: 'Draft', date: null, startTime: '09:00', endTime: '12:00' });
    const db = openProduct(f.config.productPath);
    try {
      db.prepare('UPDATE programs SET title = ?, date = ?, version = version + 1 WHERE id = ?').run('Edited Gathering', '2026-11-07', programs[0].id);
      const owner = db.prepare('SELECT owner_id FROM programs WHERE id = ?').get(programs[0].id) as { owner_id: number };
      db.prepare('INSERT INTO programs (owner_id, title) VALUES (?, ?)').run(owner.owner_id, 'Unrelated Draft');
      const before = db.prepare('SELECT * FROM programs ORDER BY id').all();
      const sessions = db.prepare('SELECT * FROM sessions').all();
      expect(db.prepare('SELECT label FROM content_nodes ORDER BY position').all()).toEqual([
        { label: 'Call to Worship' }, { label: '*Introit' }, { label: 'Prayer' }, { label: 'The Spoken Word' }, { label: 'Reading' }, { label: '' }, { label: 'Closing Remarks' },
      ]);
      db.prepare("UPDATE content_nodes SET detail = 'Edited detail' WHERE id = 'demo-introit'").run();
      const content = db.prepare('SELECT * FROM content_nodes ORDER BY position').all();
      seedProduct(env);
      expect(db.prepare('SELECT * FROM content_nodes ORDER BY position').all()).toEqual(content);
      expect(db.prepare('SELECT * FROM programs ORDER BY id').all()).toEqual(before);
      expect(db.prepare('SELECT * FROM sessions').all()).toEqual(sessions);
      // Retarget only demo ownership if the operator replaces the mapped synthetic identity.
      seedProduct({ ...env, DEV_COORDINATOR_SUBJECT: 'replacement-placeholder' });
      const replacement = db.prepare('SELECT id FROM identities WHERE subject = ?').get('replacement-placeholder') as { id: number };
      expect(db.prepare('SELECT owner_id, title, version FROM programs WHERE seed_key IS NOT NULL').get()).toEqual({ owner_id: replacement.id, title: 'Edited Gathering', version: 3 });
      expect(db.prepare('SELECT owner_id FROM programs WHERE seed_key IS NULL').get()).toEqual({ owner_id: owner.owner_id });
      db.prepare('DELETE FROM content_nodes').run();
      seedProduct(env);
      expect(db.prepare('SELECT * FROM content_nodes').all()).toEqual([]);
    } finally { db.close(); }
  } finally { await f.close(); }
});
