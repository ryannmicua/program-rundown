import { Router, type RequestHandler } from 'express';
import type { DatabaseSync } from 'node:sqlite';
import { participantAccessSql, programAccessSql } from '../domain/access.js';
import { buildParticipantList, type ParticipantAssignment } from '../domain/participant-list.js';

type Definition = { role: string; name: string; honorific: string; position: string; organization: string; subtitle: string };
const fields: (keyof Definition)[] = ['role', 'name', 'honorific', 'position', 'organization', 'subtitle'];
function validate(value: unknown): { data?: Definition; error?: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { error: 'Enter Participant details.' };
  const body = value as Record<string, unknown>;
  if (Object.keys(body).some(key => !fields.includes(key as keyof Definition))) return { error: 'Use the Participant fields shown.' };
  for (const key of fields) if (typeof body[key] !== 'string' || (body[key] as string).length > 200) return { error: 'Participant fields must contain up to 200 characters.' };
  if (!(body.role as string).trim()) return { error: 'Enter a role for this Participant.' };
  return { data: Object.fromEntries(fields.map(key => [key, (body[key] as string).trim()])) as Definition };
}
type Row = Definition & { id: number; programs: string };
function read(db: DatabaseSync, ownerId: number, id?: number) {
  const sql = `SELECT d.id, d.role, d.name, d.honorific, d.position, d.organization, d.subtitle,
    (SELECT json_group_array(json_object('id', used.id, 'title', used.title, 'status', used.status)) FROM (SELECT DISTINCT p.id, p.title, CASE WHEN EXISTS (SELECT 1 FROM program_publications pub WHERE pub.program_id = p.id) THEN 'Published' ELSE 'Draft' END AS status FROM parts x JOIN programs p ON p.id = x.program_id WHERE x.participant_id = d.id AND ${programAccessSql('p')}) used) AS programs
    FROM participants d WHERE ${participantAccessSql('d')} ${id ? 'AND d.id = ?' : ''} ORDER BY d.role COLLATE NOCASE, d.name COLLATE NOCASE, d.id`;
  const params = id === undefined ? [ownerId, ownerId, ownerId, ownerId, ownerId] : [ownerId, ownerId, ownerId, ownerId, ownerId, id];
  return db.prepare(sql).all(...params) as Row[];
}
const notOwner = { error: 'Only the coordinator who created this Participant can edit or delete it. You can still choose it for your Parts, or add your own definition.', code: 'participant-not-owner' };
function serialize(row: Row) { return { ...row, programs: JSON.parse(row.programs || '[]') }; }
export function participantRoutes(db: DatabaseSync, coordinator: RequestHandler) {
  const router = Router();
  router.use('/api/participants', coordinator);
  router.get('/api/participants', (_req, res) => {
    res.json({ participants: read(db, res.locals.user.id).map(serialize) });
  });
  function list(programRows: { id: number; title: string; eventPosition: number | null }[], filterId?: number) {
    if (filterId !== undefined) programRows = programRows.filter(program => program.id === filterId);
    if (!programRows.length) return buildParticipantList([]);
    const ids = programRows.map(program => program.id);
    const sqlIds = ids.map(() => '?').join(',');
    const rows = db.prepare(`WITH RECURSIVE tree(program_id,id,parent_id,kind,label,sort_path) AS (
      SELECT program_id,id,parent_id,kind,label,printf('%08d',position) FROM content_nodes WHERE parent_id IS NULL AND program_id IN (${sqlIds})
      UNION ALL SELECT n.program_id,n.id,n.parent_id,n.kind,n.label,tree.sort_path || '.' || printf('%08d',n.position) FROM content_nodes n JOIN tree ON n.program_id=tree.program_id AND n.parent_id=tree.id
    )
    SELECT p.program_id AS programId, pr.title AS programTitle, p.id AS partId, p.target_kind AS targetKind, p.target_id AS targetId,
      COALESCE(t.label, f.title, p.target_id) AS targetLabel, f.title AS footerTitle, p.kind, p.value, p.role, p.name,
      p.participant_id AS participantId, p.reference_mode AS referenceMode, d.role AS participantRole, d.name AS participantName,
      d.honorific, d.position, d.organization, d.subtitle, pr.event_position AS eventPosition,
      CASE WHEN p.target_kind='footer' THEN printf('~%08d',f.position) ELSE t.sort_path END AS targetOrder, p.position AS partPosition
    FROM parts p JOIN programs pr ON pr.id=p.program_id LEFT JOIN tree t ON t.program_id=p.program_id AND t.id=p.target_id AND p.target_kind!='footer'
    LEFT JOIN footer_roles f ON f.program_id=p.program_id AND f.id=p.target_id AND p.target_kind='footer' LEFT JOIN participants d ON d.id=p.participant_id
    WHERE p.program_id IN (${sqlIds})
    ORDER BY COALESCE(pr.event_position,0), targetOrder, partPosition`).all(...ids, ...ids) as unknown as ParticipantAssignment[];
    return buildParticipantList(rows);
  }
  router.get('/api/events/:id/participants', coordinator, (req, res) => {
    const eventId = Number(req.params.id);
    if (!Number.isSafeInteger(eventId) || eventId < 1) return res.status(404).json({ error: 'Event not found.' });
    const event = db.prepare('SELECT id FROM events WHERE id = ? AND owner_id = ?').get(eventId, res.locals.user.id);
    if (!event) return res.status(404).json({ error: 'Event not found.' });
    const programs = db.prepare('SELECT id, title, event_position AS eventPosition FROM programs WHERE event_id = ? ORDER BY event_position, id').all(eventId) as { id: number; title: string; eventPosition: number }[];
    const requested = req.query.programId === undefined ? undefined : Number(req.query.programId);
    if (requested !== undefined && (!Number.isSafeInteger(requested) || !programs.some(p => p.id === requested))) return res.status(404).json({ error: 'Program not found in this Event.' });
    res.json({ ...list(programs, requested), programs: programs.map(({ id, title }) => ({ id, title })) });
  });
  router.get('/api/programs/:id/participants', coordinator, (req, res) => {
    const id = Number(req.params.id);
    const program = Number.isSafeInteger(id) && id > 0 ? db.prepare(`SELECT id,title,event_position AS eventPosition FROM programs WHERE id=? AND ${programAccessSql()}`).get(id, res.locals.user.id, res.locals.user.id) as { id: number; title: string; eventPosition: number | null } | undefined : undefined;
    if (!program) return res.status(404).json({ error: 'Program not found.' });
    res.json({ ...list([program]), programs: [{ id: program.id, title: program.title }] });
  });
  router.post('/api/participants', (req, res) => {
    const result = validate(req.body);
    if (result.error) return res.status(400).json({ error: result.error });
    const d = result.data!;
    const saved = db.prepare('INSERT INTO participants (owner_id, role, name, honorific, position, organization, subtitle) VALUES (?, ?, ?, ?, ?, ?, ?)').run(res.locals.user.id, d.role, d.name, d.honorific, d.position, d.organization, d.subtitle);
    res.status(201).json({ participant: serialize(read(db, res.locals.user.id, Number(saved.lastInsertRowid))[0]) });
  });
  router.patch('/api/participants/:id', (req, res) => {
    const id = Number(req.params.id);
    const current = Number.isSafeInteger(id) && id > 0 ? read(db, res.locals.user.id, id)[0] : undefined;
    if (!current) return res.status(404).json({ error: 'Participant not found.' });
    if (!db.prepare('SELECT 1 FROM participants WHERE id = ? AND owner_id = ?').get(id, res.locals.user.id)) return res.status(403).json(notOwner);
    const result = validate(req.body);
    if (result.error) return res.status(400).json({ error: result.error });
    const d = result.data!;
    db.prepare('UPDATE participants SET role = ?, name = ?, honorific = ?, position = ?, organization = ?, subtitle = ? WHERE id = ? AND owner_id = ?').run(d.role, d.name, d.honorific, d.position, d.organization, d.subtitle, id, res.locals.user.id);
    const updated = read(db, res.locals.user.id, id)[0];
    res.json({ participant: serialize(updated) });
  });
  router.delete('/api/participants/:id', (req, res) => {
    const id = Number(req.params.id);
    const current = Number.isSafeInteger(id) && id > 0 ? read(db, res.locals.user.id, id)[0] : undefined;
    if (!current) return res.status(404).json({ error: 'Participant not found.' });
    if (!db.prepare('SELECT 1 FROM participants WHERE id = ? AND owner_id = ?').get(id, res.locals.user.id)) return res.status(403).json(notOwner);
    try { db.prepare('DELETE FROM participants WHERE id = ? AND owner_id = ?').run(id, res.locals.user.id); }
    catch { return res.status(409).json({ error: 'This Participant is in use. Remove its references before deleting it.' }); }
    res.status(204).end();
  });
  return router;
}
