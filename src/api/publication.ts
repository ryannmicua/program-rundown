import { Router, type RequestHandler } from 'express';
import type { DatabaseSync } from 'node:sqlite';
import { readContent } from './content.js';
import { readParts } from './parts.js';
import { programAccessSql } from '../domain/access.js';

const programColumns = `p.id, p.title, p.subtitle, p.date, p.start_time AS startTime,
  p.end_time AS endTime, 'Published' AS status, p.version`;

export function publicationRoutes(db: DatabaseSync, coordinator: RequestHandler) {
  const router = Router();
  router.post('/api/programs/:id/publish', coordinator, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(404).json({ error: 'Program not found.' });
    const program = db.prepare(`SELECT id FROM programs WHERE id = ? AND ${programAccessSql()}`).get(id, res.locals.user.id, res.locals.user.id);
    if (!program) return res.status(404).json({ error: 'Program not found.' });
    db.prepare('INSERT OR IGNORE INTO program_publications (program_id) VALUES (?)').run(id);
    res.json({ url: `/p/${id}` });
  });
  router.get('/api/public/programs/:id', (req, res) => {
    const id = Number(req.params.id);
    const program = Number.isSafeInteger(id) && id > 0
      ? db.prepare(`SELECT ${programColumns} FROM programs p JOIN program_publications pub ON pub.program_id = p.id WHERE p.id = ?`).get(id)
      : undefined;
    if (!program) return res.status(404).json({ error: 'Published Program not found.' });
    const { parts, footer } = readParts(db, id);
    res.json({ program, nodes: readContent(db, id), parts: parts.map(({ intentionallyNotListed, ...part }) => part), footer });
  });
  return router;
}
