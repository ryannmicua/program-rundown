import { openProduct } from '../db/product.js';

// Explicit dev-only seed. Stable keys preserve coordinator edits; never open feedback.
export function seedProduct(env = process.env) {
  if (env.APP_ENV !== 'dev') throw new Error('Demo seed requires APP_ENV=dev');
  const issuer = env.DEV_COORDINATOR_ISSUER;
  const subject = env.DEV_COORDINATOR_SUBJECT;
  if (!issuer || !subject) throw new Error('Demo seed requires DEV_COORDINATOR_ISSUER and DEV_COORDINATOR_SUBJECT');
  const db = openProduct(env.PRODUCT_DB_PATH || './data/program-rundown.sqlite');
  try {
    db.exec('BEGIN IMMEDIATE');
    db.prepare('INSERT OR IGNORE INTO identities (issuer, subject, label) VALUES (?, ?, ?)').run(issuer, subject, 'Dev tester');
    const identity = db.prepare('SELECT id FROM identities WHERE issuer = ? AND subject = ?').get(issuer, subject) as { id: number };
    db.prepare("INSERT OR IGNORE INTO coordinator_grants VALUES (?, 'dev')").run(identity.id);
    db.prepare("INSERT OR IGNORE INTO programs (owner_id, title, start_time, end_time, seed_key) VALUES (?, 'Community Gathering', '09:00', '12:00', 'standalone-community-gathering')").run(identity.id);
    // A configured replacement tester must also manage all demo Programs, without resetting Headers.
    db.prepare('UPDATE programs SET owner_id = ? WHERE seed_key IS NOT NULL AND owner_id != ?').run(identity.id, identity.id);
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  finally { db.close(); }
}
if (process.argv[1]?.endsWith('/seed.ts') || process.argv[1]?.endsWith('/seed.js')) {
  seedProduct();
  console.log('U2 demo ready: Community Gathering Draft. Existing Headers and feedback preserved.');
}
