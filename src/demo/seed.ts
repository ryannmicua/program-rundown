import { openProduct } from '../db/product.js';
import { readContent, writeContent } from '../api/content.js';
import type { ContentNode } from '../domain/content.js';
import { createTemplateSnapshot } from '../domain/templates.js';
import { readParts } from '../api/parts.js';
import type { DirectPart } from '../domain/parts.js';

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
    const seededEvents = [
      { key: 'demo-event-sabbath', name: 'Sabbath', start: '2026-11-06', end: '2026-11-07', programs: [
        ['demo-sabbath-vesper', 'Vesper', '2026-11-06', 1], ['demo-sabbath-school', 'Sabbath School', '2026-11-07', 0], ['demo-divine-worship', 'Divine Worship', '2026-11-07', 1], ['demo-ay', 'AY', '2026-11-07', 0],
        ['demo-next-vesper', 'Vesper', '2026-11-13', 0], ['demo-next-worship', 'Divine Worship', '2026-11-14', 0],
      ] as const },
      { key: 'demo-event-conference', name: 'Example Conference', start: '2026-11-20', end: '2026-11-21', programs: [
        ['demo-conference-session-one', 'Conference Session One', '2026-11-20', 0], ['demo-conference-session-two', 'Conference Session Two', '2026-11-21', 0], ['demo-conference-undated', 'Conference Welcome', null, 1],
      ] as const },
    ];
    for (const eventSeed of seededEvents) {
      db.prepare('INSERT OR IGNORE INTO events (owner_id, name, start_date, end_date, group_by_date, seed_key) VALUES (?, ?, ?, ?, 1, ?)').run(identity.id, eventSeed.name, eventSeed.start, eventSeed.end, eventSeed.key);
      const event = db.prepare('SELECT id FROM events WHERE seed_key = ?').get(eventSeed.key) as { id: number };
      db.prepare('UPDATE events SET owner_id = ? WHERE id = ? AND owner_id != ?').run(identity.id, event.id, identity.id);
      if (db.prepare('INSERT OR IGNORE INTO demo_event_seeds (event_id) VALUES (?)').run(event.id).changes) {
        const insert = db.prepare('INSERT OR IGNORE INTO programs (owner_id, title, date, event_id, event_position, seed_key) VALUES (?, ?, ?, ?, ?, ?)');
        eventSeed.programs.forEach(([key, title, date, published], index) => {
          insert.run(identity.id, title, date, event.id, index, key);
          const program = db.prepare('SELECT id FROM programs WHERE seed_key = ?').get(key) as { id: number };
          if (published) db.prepare('INSERT OR IGNORE INTO program_publications (program_id) VALUES (?)').run(program.id);
          if (db.prepare('INSERT OR IGNORE INTO demo_content_seeds (program_id) VALUES (?)').run(program.id).changes && !db.prepare('SELECT 1 FROM content_nodes WHERE program_id = ?').get(program.id)) {
            const sectionId = `event-${key}-section`;
            writeContent(db, program.id, [
              { id: sectionId, parentId: null, kind: 'section', label: 'Gathering', detail: '', startTime: null, endTime: null },
              { id: `event-${key}-opening`, parentId: sectionId, kind: 'item', label: 'Welcome', detail: `${title} placeholder welcome.`, startTime: null, endTime: null },
              { id: `event-${key}-main`, parentId: sectionId, kind: 'item', label: 'Main Program', detail: 'Placeholder program details.', startTime: null, endTime: null },
              { id: `event-${key}-closing`, parentId: sectionId, kind: 'item', label: 'Closing Remarks', detail: '', startTime: null, endTime: null },
            ]);
            db.prepare('UPDATE programs SET version = version + 1 WHERE id = ?').run(program.id);
          }
        });
      }
    }
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
    db.prepare('UPDATE participants SET owner_id = ? WHERE seed_key IS NOT NULL AND owner_id != ?').run(identity.id, identity.id);
    if (!db.prepare('SELECT 1 FROM demo_participant_seeds WHERE program_id = ?').get(program.id)) {
      const insertParticipant = db.prepare('INSERT OR IGNORE INTO participants (owner_id, seed_key, role, name, honorific, position, organization, subtitle) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
      insertParticipant.run(identity.id, 'demo-speaker', 'Speaker', 'Alex Placeholder', 'Dr.', 'Education Director', 'Example Conference', 'Guest speaker');
      insertParticipant.run(identity.id, 'demo-reader', 'Reader', 'Jamie Placeholder', '', '', '', '');
      insertParticipant.run(identity.id, 'demo-pianist-participant', 'Pianist', 'Morgan Placeholder', '', 'Music Director', 'Example Conference', '');
      const speaker = db.prepare("SELECT id FROM participants WHERE seed_key = 'demo-speaker'").get() as { id: number };
      // Convert only the original seed assignment; later coordinator edits remain untouched.
      const converted = db.prepare("UPDATE parts SET kind = 'reference', value = '', role = '', name = '', participant_id = ?, reference_mode = 'name' WHERE program_id = ? AND id = 'demo-introit-leader' AND kind = 'structured' AND role = 'Song Leader' AND name = 'Alex Placeholder' AND participant_id IS NULL").run(speaker.id, program.id);
      if (converted.changes) db.prepare('UPDATE programs SET version = version + 1 WHERE id = ?').run(program.id);
      db.prepare('INSERT INTO demo_participant_seeds VALUES (?)').run(program.id);
    }
    if (!db.prepare('SELECT 1 FROM demo_participant_seeds WHERE program_id = ?').get(published.id)) {
      const speaker = db.prepare("SELECT id FROM participants WHERE seed_key = 'demo-speaker' AND owner_id = ?").get(identity.id) as { id: number } | undefined;
      const welcome = db.prepare("SELECT 1 FROM content_nodes WHERE program_id = ? AND id = 'demo-welcome' AND kind = 'item'").get(published.id);
      if (speaker && welcome && !db.prepare("SELECT 1 FROM parts WHERE program_id = ? AND target_id = 'demo-welcome'").get(published.id)) {
        db.prepare("INSERT INTO parts (program_id, id, target_id, target_kind, kind, extra_info, position, participant_id, reference_mode) SELECT ?, 'demo-welcome-speaker', 'demo-welcome', 'item', 'reference', '', COALESCE(MAX(position) + 1, 0), ?, 'role' FROM parts WHERE program_id = ?").run(published.id, speaker.id, published.id);
        db.prepare('UPDATE programs SET version = version + 1 WHERE id = ?').run(published.id);
      }
      db.prepare('INSERT INTO demo_participant_seeds VALUES (?)').run(published.id);
    }
    if (!db.prepare('SELECT 1 FROM demo_template_seeds WHERE owner_id = ?').get(identity.id)) {
      const source = db.prepare("SELECT id FROM programs WHERE seed_key = 'standalone-community-gathering'").get() as { id: number };
      const currentParts = readParts(db, source.id);
      const result = db.prepare("INSERT INTO program_templates (owner_id, name, snapshot) VALUES (?, 'Example Worship Template', ?)").run(identity.id, JSON.stringify(createTemplateSnapshot(readContent(db, source.id), currentParts.parts as unknown as DirectPart[], currentParts.footer)));
      db.prepare('INSERT INTO demo_template_seeds (owner_id, template_id) VALUES (?, ?)').run(identity.id, Number(result.lastInsertRowid));
    }
    const speakerDefinition = db.prepare("SELECT id FROM participants WHERE seed_key = 'demo-speaker'").get() as { id: number } | undefined;
    for (const seed of [
      { key: 'demo-divine-worship', sourceId: 'event-demo-divine-worship-opening', targetId: 'event-demo-divine-worship-main', reference: true },
      { key: 'demo-sabbath-school', sourceId: 'event-demo-sabbath-school-opening', targetId: 'event-demo-sabbath-school-main', reference: false },
      { key: 'demo-conference-session-one', sourceId: 'event-demo-conference-session-one-opening', targetId: 'event-demo-conference-session-one-main', reference: false },
    ]) {
      const seededProgram = db.prepare('SELECT id FROM programs WHERE seed_key = ?').get(seed.key) as { id: number } | undefined;
      if (!seededProgram || db.prepare('SELECT 1 FROM demo_move_part_seeds WHERE program_id = ?').get(seededProgram.id)) continue;
      const hasSource = db.prepare('SELECT 1 FROM content_nodes WHERE program_id = ? AND id = ?').get(seededProgram.id, seed.sourceId);
      const hasTarget = db.prepare('SELECT 1 FROM content_nodes WHERE program_id = ? AND id = ?').get(seededProgram.id, seed.targetId);
      let added = false;
      if (hasSource && !db.prepare('SELECT 1 FROM parts WHERE program_id = ? AND target_id = ?').get(seededProgram.id, seed.sourceId)) {
        if (seed.reference && speakerDefinition) {
          db.prepare("INSERT INTO parts (program_id, id, target_id, target_kind, kind, extra_info, position, participant_id, reference_mode) VALUES (?, 'demo-move-speaker', ?, 'item', 'reference', 'Placeholder notes follow the shared definition.', (SELECT COALESCE(MAX(position) + 1, 0) FROM parts WHERE program_id = ?), ?, 'name')").run(seededProgram.id, seed.sourceId, seededProgram.id, speakerDefinition.id);
        } else {
          db.prepare("INSERT INTO parts (program_id, id, target_id, target_kind, kind, role, name, extra_info, position) VALUES (?, 'demo-move-role', ?, 'item', 'structured', 'Speaker', 'Alex Placeholder', 'A placeholder assignment ready to move or copy.', (SELECT COALESCE(MAX(position) + 1, 0) FROM parts WHERE program_id = ?))").run(seededProgram.id, seed.sourceId, seededProgram.id);
        }
        added = true;
      }
      if (hasTarget && !db.prepare('SELECT 1 FROM parts WHERE program_id = ? AND target_id = ?').get(seededProgram.id, seed.targetId)) {
        db.prepare("INSERT INTO parts (program_id, id, target_id, target_kind, kind, value, extra_info, position) VALUES (?, 'demo-parallel-congregation', ?, 'item', 'text', 'Congregation Placeholder', 'Existing assignment stays when another Part arrives.', (SELECT COALESCE(MAX(position) + 1, 0) FROM parts WHERE program_id = ?))").run(seededProgram.id, seed.targetId, seededProgram.id);
        db.prepare("INSERT INTO parts (program_id, id, target_id, target_kind, kind, role, extra_info, position) VALUES (?, 'demo-parallel-role', ?, 'item', 'role', 'Music Leader Placeholder', 'A parallel Part with independent notes.', (SELECT COALESCE(MAX(position) + 1, 0) FROM parts WHERE program_id = ?))").run(seededProgram.id, seed.targetId, seededProgram.id);
        added = true;
      }
      if (added) db.prepare('UPDATE programs SET version = version + 1 WHERE id = ?').run(seededProgram.id);
      db.prepare('INSERT INTO demo_move_part_seeds VALUES (?)').run(seededProgram.id);
    }
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  finally { db.close(); }
}
if (process.argv[1]?.endsWith('/seed.ts') || process.argv[1]?.endsWith('/seed.js')) {
  seedProduct();
  console.log('U7 demo ready: reusable Participant definitions by name and role. Existing edits and feedback preserved.');
}
