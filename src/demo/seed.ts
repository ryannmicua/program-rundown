import { openProduct } from '../db/product.js';
import { writeContent } from '../api/content.js';
import type { ContentNode } from '../domain/content.js';

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
    const program = db.prepare("SELECT id FROM programs WHERE seed_key = 'standalone-community-gathering'").get() as { id: number };
    if (!db.prepare('SELECT 1 FROM demo_content_seeds WHERE program_id = ?').get(program.id)) {
      // Seed this slice once, and never replace a coordinator's existing rundown.
      if (!db.prepare('SELECT 1 FROM content_nodes WHERE program_id = ?').get(program.id)) {
        const section = (id: string, label: string, startTime: string | null = null): ContentNode => ({ id, kind: 'section', parentId: null, label, detail: '', startTime, endTime: null });
        const item = (id: string, parentId: string, label: string, detail = '', startTime: string | null = null, endTime: string | null = null): ContentNode => ({ id, kind: 'item', parentId, label, detail, startTime, endTime });
        writeContent(db, program.id, [
          section('demo-call', 'Call to Worship', '09:00'),
          item('demo-introit', 'demo-call', '*Introit', 'A song of welcome\nSing together.', '09:00', '09:05'),
          item('demo-prayer', 'demo-call', 'Prayer', '', null, '09:10'),
          section('demo-word', 'The Spoken Word'),
          item('demo-reading', 'demo-word', 'Reading', 'Psalm 100:1–5'),
          section('demo-closing', ''),
          item('demo-remarks', 'demo-closing', 'Closing Remarks', '', '11:50'),
        ]);
        db.prepare('UPDATE programs SET version = version + 1 WHERE id = ?').run(program.id);
      }
      db.prepare('INSERT INTO demo_content_seeds VALUES (?)').run(program.id);
    }
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  finally { db.close(); }
}
if (process.argv[1]?.endsWith('/seed.ts') || process.argv[1]?.endsWith('/seed.js')) {
  seedProduct();
  console.log('U3 demo ready: Community Gathering with ordered Sections and Items. Existing edits and feedback preserved.');
}
