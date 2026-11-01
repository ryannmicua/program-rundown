import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { identityMigration } from './migrations/001-identity.js';
import { programsMigration } from './migrations/002-programs.js';
import { contentMigration } from './migrations/003-content.js';
import { publicationMigration } from './migrations/004-publication.js';
import { nestingMigration } from './migrations/005-nesting.js';
import { partsMigration } from './migrations/006-parts.js';
import { participantsMigration } from './migrations/007-participants.js';
import { eventsMigration } from './migrations/008-events.js';
import { templatesMigration } from './migrations/009-templates.js';
import { movePartSeedsMigration } from './migrations/010-move-part-seeds.js';
import { templateSharingMigration } from './migrations/011-template-sharing.js';
import { participantListSeedsMigration } from './migrations/012-participant-list-seeds.js';

export function openDatabase(path: string) {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
  return db;
}
export function openProduct(path: string) {
  const db = openDatabase(path);
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY)');
  for (const migration of [identityMigration, programsMigration, contentMigration, publicationMigration, nestingMigration, partsMigration, participantsMigration, eventsMigration, templatesMigration, movePartSeedsMigration, templateSharingMigration, participantListSeedsMigration]) {
    if (db.prepare('SELECT version FROM schema_migrations WHERE version = ?').get(migration.version)) continue;
    db.exec('BEGIN IMMEDIATE');
    try {
      db.exec(migration.sql);
      db.prepare('INSERT INTO schema_migrations VALUES (?)').run(migration.version);
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); db.close(); throw error; }
  }
  return db;
}
