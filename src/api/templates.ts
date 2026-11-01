import { Router, type RequestHandler } from 'express';
import type { DatabaseSync } from 'node:sqlite';
import { programAccessSql } from '../domain/access.js';
import { readContent, writeContent } from './content.js';
import { readParts } from './parts.js';
import type { DirectPart } from '../domain/parts.js';
import { createTemplateSnapshot, type TemplateSnapshot } from '../domain/templates.js';

type Snapshot = TemplateSnapshot;
function snapshotProgram(db: DatabaseSync, programId: number): Snapshot {
  const { parts, footer } = readParts(db, programId);
  return createTemplateSnapshot(readContent(db, programId), parts as unknown as DirectPart[], footer);
}

export function templateRoutes(db: DatabaseSync, coordinator: RequestHandler) {
  const router = Router();
  router.use('/api/templates', coordinator);
  router.get('/api/templates', (_req, res) => res.json({ templates: db.prepare('SELECT id, name FROM program_templates WHERE owner_id = ? ORDER BY id DESC').all(res.locals.user.id) }));
  router.get('/api/templates/:id', (req, res) => {
    const id = Number(req.params.id), template = Number.isSafeInteger(id) && id > 0 ? db.prepare('SELECT id, name, snapshot FROM program_templates WHERE id = ? AND owner_id = ?').get(id, res.locals.user.id) as { id: number; name: string; snapshot: string } | undefined : undefined;
    if (!template) return res.status(404).json({ error: 'Template not found. It may belong to another coordinator.' });
    return res.json({ template: { id: template.id, name: template.name }, ...JSON.parse(template.snapshot) as Snapshot });
  });
  router.post('/api/templates', (req, res) => {
    if (!req.body || Object.keys(req.body).some(key => !['name', 'programId'].includes(key)) || typeof req.body.name !== 'string' || !req.body.name.trim() || req.body.name.trim().length > 200 || !Number.isSafeInteger(req.body.programId) || req.body.programId < 1) return res.status(400).json({ error: 'Enter a template name and choose a Program.' });
    const owner = Number(res.locals.user.id), programId = Number(req.body.programId);
    const program = db.prepare(`SELECT id FROM programs WHERE id = ? AND ${programAccessSql()}`).get(programId, owner, owner);
    if (!program) return res.status(404).json({ error: 'Program not found.' });
    const result = db.prepare('INSERT INTO program_templates (owner_id, name, snapshot) VALUES (?, ?, ?)').run(owner, req.body.name.trim(), JSON.stringify(snapshotProgram(db, programId)));
    return res.status(201).json({ template: { id: Number(result.lastInsertRowid), name: req.body.name.trim() } });
  });
  router.post('/api/templates/:id/programs', (req, res) => {
    const id = Number(req.params.id), owner = Number(res.locals.user.id), template = Number.isSafeInteger(id) && id > 0 ? db.prepare('SELECT snapshot FROM program_templates WHERE id = ? AND owner_id = ?').get(id, owner) as { snapshot: string } | undefined : undefined;
    if (!template) return res.status(404).json({ error: 'Template not found. It may belong to another coordinator.' });
    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    const date = req.body?.date || null;
    const eventId = req.body?.eventId == null || req.body.eventId === '' ? null : Number(req.body.eventId);
    const errors: Record<string, string> = {};
    if (!req.body || Object.keys(req.body).some(key => !['title', 'date', 'eventId'].includes(key))) errors.form = 'Use the Program fields shown.';
    if (!title || title.length > 200) errors.title = 'Enter a title between 1 and 200 characters.';
    if (date != null && (typeof date !== 'string' || !/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`)) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date)) errors.date = 'Enter a real date as YYYY-MM-DD, or leave it blank.';
    if (eventId != null && (!Number.isSafeInteger(eventId) || !db.prepare('SELECT 1 FROM events WHERE id = ? AND owner_id = ?').get(eventId, owner))) errors.eventId = 'Choose an Event you coordinate.';
    if (Object.keys(errors).length) return res.status(400).json({ error: 'Check the Program fields.', errors });
    const copy = JSON.parse(template.snapshot) as Snapshot;
    db.exec('BEGIN IMMEDIATE');
    try {
      const result = db.prepare('INSERT INTO programs (owner_id, title, date, event_id, event_position) VALUES (?, ?, ?, ?, ?)').run(owner, title, date, eventId, eventId == null ? null : Number((db.prepare('SELECT COALESCE(MAX(event_position) + 1, 0) AS next FROM programs WHERE event_id = ?').get(eventId) as { next: number }).next));
      const programId = Number(result.lastInsertRowid);
      writeContent(db, programId, copy.nodes);
      const footer = db.prepare('INSERT INTO footer_roles (program_id, id, title, position) VALUES (?, ?, ?, ?)');
      copy.footer.forEach((role, index) => footer.run(programId, role.id, role.title, index));
      const insertPart = db.prepare('INSERT INTO parts (program_id, id, target_id, target_kind, kind, value, role, name, extra_info, intentionally_not_listed, position) VALUES (:programId, :id, :targetId, :targetKind, :kind, :value, :role, :name, :extraInfo, :intentionallyNotListed, :position)');
      copy.parts.forEach((savedPart, index) => insertPart.run({ programId, id: savedPart.id, targetId: savedPart.targetId, targetKind: savedPart.targetKind, kind: savedPart.kind, value: '', role: savedPart.role, name: '', extraInfo: savedPart.extraInfo, intentionallyNotListed: savedPart.intentionallyNotListed ? 1 : 0, position: index }));
      db.exec('COMMIT');
      return res.status(201).json({ program: db.prepare(`SELECT id, title, subtitle, date, start_time AS startTime, end_time AS endTime, event_id AS eventId, 'Draft' AS status, version FROM programs WHERE id = ?`).get(programId) });
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  });
  return router;
}
