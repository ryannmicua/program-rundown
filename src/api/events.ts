import { Router, type RequestHandler } from 'express';
import type { DatabaseSync } from 'node:sqlite';
import { programAccessSql } from '../domain/access.js';
import { readContent } from './content.js';
import { readParts } from './parts.js';

const eventFields = `id, name, start_date AS startDate, end_date AS endDate, group_by_date AS groupByDate`;
const dateOk = (value: unknown) => value == null || value === '' || (typeof value === 'string' && /^(?!0000)\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value);
function validateEvent(body: unknown, editing: boolean) {
  const errors: Record<string, string> = {};
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { form: 'Enter Event details.' };
  const value = body as Record<string, unknown>;
  const allowed = ['name', 'startDate', 'endDate', 'groupByDate', ...(editing ? [] : [])];
  if (Object.keys(value).some(key => !allowed.includes(key))) errors.form = 'Use the Event fields shown.';
  if ((!editing || 'name' in value) && (typeof value.name !== 'string' || !value.name.trim() || value.name.trim().length > 200)) errors.name = 'Enter an Event name between 1 and 200 characters.';
  for (const key of ['startDate', 'endDate']) if (key in value && !dateOk(value[key])) errors[key] = 'Enter a real date as YYYY-MM-DD, or leave it blank.';
  if ('groupByDate' in value && typeof value.groupByDate !== 'boolean') errors.groupByDate = 'Choose whether to group Programs by date.';
  if (value.startDate && value.endDate && value.startDate > value.endDate) errors.endDate = 'The end date must be on or after the start date.';
  return errors;
}
function listPrograms(db: DatabaseSync, eventId: number, publishedOnly = false) {
  return db.prepare(`SELECT p.id, p.title, p.subtitle, p.date, p.start_time AS startTime, p.end_time AS endTime,
    ${publishedOnly ? "'Published'" : "CASE WHEN EXISTS (SELECT 1 FROM program_publications pub WHERE pub.program_id = p.id) THEN 'Published' ELSE 'Draft' END"} AS status, p.version, p.event_position AS eventPosition
    FROM programs p ${publishedOnly ? 'JOIN program_publications pub ON pub.program_id = p.id' : ''}
    WHERE p.event_id = ? ORDER BY p.event_position, p.id`).all(eventId);
}
export function eventRoutes(db: DatabaseSync, coordinator: RequestHandler) {
  const router = Router();
  const requireCoordinator = coordinator;
  router.get('/api/events', requireCoordinator, (_req, res) => {
    const events = db.prepare(`SELECT ${eventFields} FROM events WHERE owner_id = ? ORDER BY id DESC`).all(res.locals.user.id);
    res.json({ events: events.map(event => ({ ...event, groupByDate: Boolean(event.groupByDate), programs: listPrograms(db, Number(event.id)) })) });
  });
  router.post('/api/events', requireCoordinator, (req, res) => {
    const errors = validateEvent(req.body, false);
    if (Object.keys(errors).length) return res.status(400).json({ error: 'Check the Event fields.', errors });
    const value = req.body as Record<string, unknown>;
    const result = db.prepare('INSERT INTO events (owner_id, name, start_date, end_date, group_by_date) VALUES (?, ?, ?, ?, ?)').run(res.locals.user.id, (value.name as string).trim(), (value.startDate as string | null) || null, (value.endDate as string | null) || null, value.groupByDate ? 1 : 0);
    return res.status(201).json({ event: db.prepare(`SELECT ${eventFields} FROM events WHERE id = ?`).get(Number(result.lastInsertRowid)) });
  });
  router.get('/api/events/:id', requireCoordinator, (req, res) => {
    const id = Number(req.params.id);
    const event = Number.isSafeInteger(id) && id > 0 ? db.prepare(`SELECT ${eventFields} FROM events WHERE id = ? AND owner_id = ?`).get(id, res.locals.user.id) as Record<string, unknown> | undefined : undefined;
    if (!event) return res.status(404).json({ error: 'Event not found.' });
    res.json({ event: { ...event, groupByDate: Boolean(event.groupByDate) }, programs: listPrograms(db, id) });
  });
  router.patch('/api/events/:id', requireCoordinator, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(404).json({ error: 'Event not found.' });
    const current = db.prepare(`SELECT ${eventFields} FROM events WHERE id = ? AND owner_id = ?`).get(id, res.locals.user.id) as Record<string, unknown> | undefined;
    if (!current) return res.status(404).json({ error: 'Event not found.' });
    const errors = validateEvent(req.body, true);
    if (Object.keys(errors).length) return res.status(400).json({ error: 'Check the Event fields.', errors });
    const value = req.body as Record<string, unknown>;
    const name = value.name === undefined ? current.name : (value.name as string).trim();
    const startDate = (value.startDate === undefined ? current.startDate : value.startDate || null) as string | null;
    const endDate = (value.endDate === undefined ? current.endDate : value.endDate || null) as string | null;
    if (startDate && endDate && startDate > endDate) return res.status(400).json({ error: 'Check the Event fields.', errors: { endDate: 'The end date must be on or after the start date.' } });
    db.prepare('UPDATE events SET name = ?, start_date = ?, end_date = ?, group_by_date = ? WHERE id = ? AND owner_id = ?').run(name as string, startDate, endDate, value.groupByDate === undefined ? Number(current.groupByDate) : value.groupByDate ? 1 : 0, id, res.locals.user.id);
    res.json({ event: db.prepare(`SELECT ${eventFields} FROM events WHERE id = ?`).get(id), programs: listPrograms(db, id) });
  });
  router.put('/api/events/:id/programs', requireCoordinator, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(404).json({ error: 'Event not found.' });
    if (!db.prepare('SELECT 1 FROM events WHERE id = ? AND owner_id = ?').get(id, res.locals.user.id)) return res.status(404).json({ error: 'Event not found.' });
    if (!req.body || !Array.isArray(req.body.programIds) || req.body.programIds.some((n: unknown) => !Number.isSafeInteger(n) || Number(n) < 1) || new Set(req.body.programIds).size !== req.body.programIds.length) return res.status(400).json({ error: 'Choose an ordered list of Programs.' });
    const ids = req.body.programIds as number[];
    if (ids.some(programId => !db.prepare(`SELECT 1 FROM programs WHERE id = ? AND ${programAccessSql()}`).get(programId, res.locals.user.id, res.locals.user.id))) return res.status(404).json({ error: 'One or more Programs are unavailable.' });
    if (ids.some(programId => { const row = db.prepare('SELECT event_id FROM programs WHERE id = ?').get(programId) as { event_id: number | null }; return row.event_id != null && row.event_id !== id; })) return res.status(409).json({ error: 'A Program can belong to only one Event. Unlink it from its current Event first.' });
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare('UPDATE programs SET event_id = NULL, event_position = NULL WHERE event_id = ?').run(id);
      const link = db.prepare('UPDATE programs SET event_id = ?, event_position = ? WHERE id = ?');
      ids.forEach((programId, index) => link.run(id, index, programId));
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    res.json({ programs: listPrograms(db, id) });
  });
  router.get('/api/public/events/:id', (req, res) => {
    const id = Number(req.params.id);
    const event = Number.isSafeInteger(id) && id > 0 ? db.prepare(`SELECT ${eventFields} FROM events WHERE id = ?`).get(id) as Record<string, unknown> | undefined : undefined;
    if (!event) return res.status(404).json({ error: 'Event not found.' });
    const programs = listPrograms(db, id, true) as { id: number; eventPosition: number; date: string | null }[];
    res.json({ event: { ...event, groupByDate: Boolean(event.groupByDate) }, programs: programs.map(program => ({ ...program, url: `/api/public/programs/${program.id}` })) });
  });
  router.get('/api/public/events/:id/programs/:programId', (req, res) => {
    const eventId = Number(req.params.id), programId = Number(req.params.programId);
    if (!Number.isSafeInteger(eventId) || eventId < 1 || !Number.isSafeInteger(programId) || programId < 1) return res.status(404).json({ error: 'Published Program not found.' });
    const program = db.prepare(`SELECT p.id, p.title, p.subtitle, p.date, p.start_time AS startTime, p.end_time AS endTime, 'Published' AS status, p.version FROM programs p JOIN program_publications pub ON pub.program_id = p.id WHERE p.id = ? AND p.event_id = ?`).get(programId, eventId);
    if (!program) return res.status(404).json({ error: 'Published Program not found.' });
    res.json({ program, nodes: readContent(db, programId), ...readParts(db, programId) });
  });
  return router;
}
