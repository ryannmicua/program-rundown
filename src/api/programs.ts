import { Router, type RequestHandler } from 'express';
import type { DatabaseSync } from 'node:sqlite';
import { headerValues, validateHeader, type Program } from '../domain/programs.js';
import { readContent } from './content.js';

const columns = `id, title, subtitle, date, start_time AS startTime, end_time AS endTime,
  CASE WHEN EXISTS (SELECT 1 FROM program_publications pub WHERE pub.program_id = programs.id) THEN 'Published' ELSE 'Draft' END AS status, version`;
export function programRoutes(db: DatabaseSync, coordinator: RequestHandler) {
  const router = Router();
  router.use('/api/programs', coordinator);
  // Standalone access belongs to the creating coordinator. Event access is added in U8.
  const find = (id: number, owner: number) => db.prepare(`SELECT ${columns} FROM programs WHERE id = ? AND owner_id = ?`).get(id, owner) as Program | undefined;
  router.get('/api/programs', (_req, res) => {
    res.json({ programs: db.prepare(`SELECT ${columns} FROM programs WHERE owner_id = ? ORDER BY id DESC`).all(res.locals.user.id) });
  });
  router.post('/api/programs', (req, res) => {
    const errors = validateHeader(req.body, false);
    if (Object.keys(errors).length) return res.status(400).json({ error: 'Check the Header fields.', errors });
    const header = headerValues(req.body);
    const result = db.prepare('INSERT INTO programs (owner_id, title, subtitle, date, start_time, end_time) VALUES (?, ?, ?, ?, ?, ?)').run(res.locals.user.id, header.title, header.subtitle, header.date, header.startTime, header.endTime);
    res.status(201).location(`/api/programs/${result.lastInsertRowid}`).json({ program: find(Number(result.lastInsertRowid), res.locals.user.id) });
  });
  router.get('/api/programs/:id', (req, res) => {
    const id = Number(req.params.id);
    const program = Number.isSafeInteger(id) && id > 0 ? find(id, res.locals.user.id) : undefined;
    if (!program) return res.status(404).json({ error: 'Program not found.' });
    res.json({ program, nodes: readContent(db, program.id) });
  });
  router.patch('/api/programs/:id', (req, res) => {
    const id = Number(req.params.id);
    const previous = Number.isSafeInteger(id) && id > 0 ? find(id, res.locals.user.id) : undefined;
    if (!previous) return res.status(404).json({ error: 'Program not found.' });
    const errors = validateHeader(req.body, true);
    if (Object.keys(errors).length) return res.status(400).json({ error: 'Check the Header fields.', errors });
    const header = headerValues(req.body, previous);
    // The revision check and write are one SQLite statement, including across app processes.
    const result = db.prepare('UPDATE programs SET title = ?, subtitle = ?, date = ?, start_time = ?, end_time = ?, version = version + 1 WHERE id = ? AND owner_id = ? AND version = ?').run(header.title, header.subtitle, header.date, header.startTime, header.endTime, id, res.locals.user.id, req.body.version);
    if (!result.changes) return res.status(409).json({ error: 'This Draft changed since you opened it. Your entries are kept. Reload the saved Draft, then review and reapply your changes.' });
    res.json({ program: find(id, res.locals.user.id) });
  });
  return router;
}
