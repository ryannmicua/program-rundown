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
    db.prepare("INSERT OR IGNORE INTO programs (owner_id, title, subtitle, seed_key) VALUES (?, 'Example Published Program', 'A day of gratitude', 'standalone-published-example')").run(identity.id);
    const published = db.prepare("SELECT id FROM programs WHERE seed_key = 'standalone-published-example'").get() as { id: number };
    db.prepare('INSERT OR IGNORE INTO program_publications (program_id) VALUES (?)').run(published.id);
    // A configured replacement tester must also manage all demo Programs, without resetting Headers.
    db.prepare('UPDATE programs SET owner_id = ? WHERE seed_key IS NOT NULL AND owner_id != ?').run(identity.id, identity.id);
    if (!db.prepare('SELECT 1 FROM demo_content_seeds WHERE program_id = ?').get(published.id)) {
      db.prepare("UPDATE programs SET subtitle = 'A day of gratitude' WHERE id = ? AND subtitle = ''").run(published.id);
      if (!db.prepare('SELECT 1 FROM content_nodes WHERE program_id = ?').get(published.id)) {
        const block = (id: string, parentId: string | null, kind: 'section' | 'mini-program', label: string, options: Partial<ContentNode> = {}): ContentNode => ({ id, parentId, kind, label, detail: '', startTime: null, endTime: null, ...options });
        const item = (id: string, parentId: string, label: string, detail = ''): ContentNode => ({ id, parentId, kind: 'item', label, detail, startTime: null, endTime: null });
        writeContent(db, published.id, [
          block('demo-main', null, 'section', 'Community Gathering', { blockLabel: 'featured' }),
          block('demo-morning', 'demo-main', 'mini-program', 'Morning Service', { date: '2026-11-07', startTime: '09:00' }),
          block('demo-dedication', 'demo-morning', 'section', 'Dedication'),
          item('demo-welcome', 'demo-dedication', 'Welcome', 'A placeholder welcome.'),
          block('demo-closing-mini', 'demo-main', 'mini-program', 'Closing Program', { endTime: '12:00' }),
          block('demo-closing-section', 'demo-closing-mini', 'section', '', { blockLabel: 'unheaded-closing' }),
          item('demo-thanks', 'demo-closing-section', 'Thanksgiving', 'A placeholder detail.'),
        ]);
        db.prepare('UPDATE programs SET version = version + 1 WHERE id = ?').run(published.id);
      }
      db.prepare('INSERT INTO demo_content_seeds VALUES (?)').run(published.id);
    }
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
    if (!db.prepare('SELECT 1 FROM demo_parts_seeds WHERE program_id = ?').get(program.id)) {
      if (!db.prepare('SELECT 1 FROM parts WHERE program_id = ?').get(program.id) && !db.prepare('SELECT 1 FROM footer_roles WHERE program_id = ?').get(program.id)) {
        const targets = new Set((db.prepare('SELECT id, kind FROM content_nodes WHERE program_id = ?').all(program.id) as {id: string; kind: 'item' | 'section' | 'mini-program'}[]).map(row => row.kind + ':' + row.id));
        const insert = db.prepare('INSERT INTO parts (program_id, id, target_id, target_kind, kind, value, role, name, extra_info, intentionally_not_listed, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        let position = 0;
        if (targets.has('item:demo-introit')) insert.run(program.id, 'demo-introit-leader', 'demo-introit', 'item', 'structured', '', 'Song Leader', 'Alex Placeholder', '', 0, position++);
        if (targets.has('item:demo-prayer')) insert.run(program.id, 'demo-prayer-role', 'demo-prayer', 'item', 'role', '', 'Prayer Leader', '', '', 0, position++);
        if (targets.has('item:demo-reading')) insert.run(program.id, 'demo-reading-unlisted', 'demo-reading', 'item', 'blank', '', '', '', '', 1, position++);
        db.prepare('INSERT INTO footer_roles (program_id, id, title, position) VALUES (?, ?, ?, ?)').run(program.id, 'demo-pianist', 'Pianist', 0);
        insert.run(program.id, 'demo-pianist-participant', 'demo-pianist', 'footer', 'text', 'Jamie Placeholder', '', '', '', 0, position);
      }
      db.prepare('INSERT INTO demo_parts_seeds VALUES (?)').run(program.id);
    }
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  finally { db.close(); }
}
if (process.argv[1]?.endsWith('/seed.ts') || process.argv[1]?.endsWith('/seed.js')) {
  seedProduct();
  console.log('U6 demo ready: direct Parts, an intentionally unlisted Part, and a Footer role. Existing edits and feedback preserved.');
}
