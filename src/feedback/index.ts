// Adapted from Steward's optional feedback module: independent data and routes.
import { Router, type RequestHandler } from 'express';
import { openDatabase } from '../db/product.js';

const text = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : '';
// Context is intentionally lossy. Never retain queries, fragments, credentials,
// arbitrary page titles, form values, or callback parameters.
export function safeRoute(value: unknown) {
  try {
    const path = new URL(String(value), 'https://context.invalid').pathname;
    return ['/', '/signin', '/feedback'].includes(path) ? path : '/';
  } catch { return '/'; }
}
function dimensions(value: unknown, keys: string[]) {
  if (!value || typeof value !== 'object') return null;
  const values = value as Record<string, unknown>;
  if (!keys.every(key => typeof values[key] === 'number' && Number.isFinite(values[key]) && Math.abs(values[key] as number) < 1e6)) return null;
  return Object.fromEntries(keys.map(key => [key, Math.round(values[key] as number)]));
}
function contextText(value: unknown) {
  return text(value, 200).replace(/(?:https?:\/\/|[?#])\S+/gi, '[redacted]').replace(/\b(?:password|token|secret|authorization|code)\s*[:=]\s*\S+/gi, '[redacted]');
}
export function feedbackModule(path: string, tester: RequestHandler) {
  const db = openDatabase(path);
  db.exec(`CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY, created_at TEXT NOT NULL, route TEXT NOT NULL,
    reporter TEXT, note TEXT NOT NULL CHECK(length(note) BETWEEN 1 AND 4000),
    element TEXT, viewport TEXT, done INTEGER NOT NULL DEFAULT 0 CHECK(done IN (0,1))
  )`);
  const router = Router();
  type Row = { id: number; created_at: string; route: string; reporter: string | null; note: string; element: string | null; viewport: string | null; done: number };
  const encode = (row: Row) => ({ id: row.id, createdAt: row.created_at, route: row.route, reporter: row.reporter, note: row.note, element: row.element ? JSON.parse(row.element) : null, viewport: row.viewport ? JSON.parse(row.viewport) : null, done: Boolean(row.done) });
  const one = (id: number) => db.prepare('SELECT * FROM feedback WHERE id = ?').get(id) as Row | undefined;
  router.post('/api/feedback', (req, res) => {
    const body = req.body;
    if (typeof body?.note !== 'string' || !body.note.trim() || body.note.length > 4000) return res.status(400).json({ error: 'Write a note between 1 and 4000 characters.' });
    const raw = body.element;
    // Only structural selectors produced by the picker; no attribute values.
    const selector = text(raw?.selector, 1000);
    const validSelector = /^(?:body|[a-z][a-z0-9-]*(?::nth-of-type\(\d+\))?)(?: > [a-z][a-z0-9-]*(?::nth-of-type\(\d+\))?)*$/.test(selector);
    const sensitive = /^(input|textarea|select|form)$/i.test(String(raw?.tag));
    const element = validSelector && !sensitive ? {
      selector, tag: text(raw.tag, 40).replace(/[^a-z0-9-]/gi, ''), text: contextText(raw.text),
      box: dimensions(raw.box, ['x', 'y', 'width', 'height']),
    } : null;
    const result = db.prepare('INSERT INTO feedback (created_at, route, reporter, note, element, viewport) VALUES (?, ?, ?, ?, ?, ?)').run(
      new Date().toISOString(), safeRoute(body.route), res.locals.user?.label ?? null, body.note.trim(),
      element ? JSON.stringify(element) : null, JSON.stringify(dimensions(body.viewport, ['width', 'height'])),
    );
    // Anonymous writers receive only the receipt, never readback.
    return res.status(201).json({ id: Number(result.lastInsertRowid) });
  });
  router.get('/api/feedback', tester, (req, res) => {
    const after = req.query.after === undefined ? 0 : Number(req.query.after);
    if (!Number.isSafeInteger(after) || after < 0) return res.status(400).json({ error: 'after must be a note id.' });
    const rows = db.prepare('SELECT * FROM feedback WHERE id > ? ORDER BY id DESC').all(after) as Row[];
    res.json({ feedback: rows.map(encode), latestId: rows[0]?.id ?? after });
  });
  router.get('/api/feedback/:id', tester, (req, res) => {
    const row = one(Number(req.params.id));
    return row ? res.json({ feedback: encode(row) }) : res.status(404).json({ error: 'No such note.' });
  });
  router.patch('/api/feedback/:id', tester, (req, res) => {
    if (typeof req.body?.done !== 'boolean') return res.status(400).json({ error: 'done must be true or false.' });
    const id = Number(req.params.id);
    if (!one(id)) return res.status(404).json({ error: 'No such note.' });
    db.prepare('UPDATE feedback SET done = ? WHERE id = ?').run(Number(req.body.done), id);
    return res.json({ feedback: encode(one(id)!) });
  });
  return { router, close: () => db.close() };
}
