import { Router, type RequestHandler } from 'express';
import type { DatabaseSync } from 'node:sqlite';
import { validateParts, type DirectPart, type FooterRole } from '../domain/parts.js';
import { readContent } from './content.js';
import { participantAccessSql, programAccessSql } from '../domain/access.js';

export function readParts(db: DatabaseSync, programId: number) {
  const parts = db.prepare("SELECT p.id, p.target_id AS targetId, p.target_kind AS targetKind, p.kind, p.value, p.role, p.name, p.extra_info AS extraInfo, p.intentionally_not_listed AS intentionallyNotListed, p.participant_id AS participantId, p.reference_mode AS referenceMode, d.role AS participantRole, d.name AS participantName, d.honorific AS participantHonorific, d.position AS participantPosition, d.organization AS participantOrganization, d.subtitle AS participantSubtitle FROM parts p LEFT JOIN participants d ON d.id = p.participant_id WHERE p.program_id = ? ORDER BY p.position").all(programId) as unknown as (Omit<DirectPart, 'intentionallyNotListed'> & { intentionallyNotListed: number; participantRole?: string; participantName?: string; participantHonorific?: string; participantPosition?: string; participantOrganization?: string; participantSubtitle?: string })[];
  return { parts: parts.map(part => {
    const { participantRole, participantName, participantHonorific, participantPosition, participantOrganization, participantSubtitle, ...value } = part;
    const result: Record<string, unknown> = { ...value, intentionallyNotListed: Boolean(part.intentionallyNotListed) };
    if (part.participantId != null) Object.assign(result, { participant: { role: participantRole, name: participantName, honorific: participantHonorific, position: participantPosition, organization: participantOrganization, subtitle: participantSubtitle } });
    else { delete result.participantId; delete result.referenceMode; }
    return result;
  }), footer: db.prepare('SELECT id, title FROM footer_roles WHERE program_id = ? ORDER BY position').all(programId) as FooterRole[] };
}

export function readPublicParts(db: DatabaseSync, programId: number) {
  const { parts, footer } = readParts(db, programId);
  return { parts: parts.map(({ intentionallyNotListed, ...part }) => part), footer };
}

export function partsRoutes(db: DatabaseSync, coordinator: RequestHandler) {
  const router = Router();
  router.use('/api/programs/:id/parts', coordinator);
  const find = (id: number, owner: number) => db.prepare(`SELECT id, version FROM programs WHERE id = ? AND ${programAccessSql()}`).get(id, owner, owner) as { id: number; version: number } | undefined;
  router.put('/api/programs/:id/parts', (req, res) => {
    const program = find(Number(req.params.id), res.locals.user.id);
    if (!program) return res.status(404).json({ error: 'Program not found.' });
    const nodes = readContent(db, program.id);
    const error = validateParts(req.body, nodes);
    if (error) return res.status(400).json({ error });
    const participantIds = (req.body.parts as DirectPart[]).filter(part => part.kind === 'reference').map(part => part.participantId);
    db.exec('BEGIN IMMEDIATE');
    try {
      if (participantIds.some(id => !db.prepare(`SELECT 1 FROM participants WHERE id = ? AND ${participantAccessSql()}`).get(Number(id), res.locals.user.id, res.locals.user.id, res.locals.user.id))) { db.exec('ROLLBACK'); return res.status(400).json({ error: 'Choose a Participant you can manage.' }); }
      const result = db.prepare(`UPDATE programs SET version = version + 1 WHERE id = ? AND ${programAccessSql()} AND version = ?`).run(program.id, res.locals.user.id, res.locals.user.id, req.body.version);
      if (!result.changes) { db.exec('ROLLBACK'); return res.status(409).json({ error: 'This Program changed. Your Parts are kept. Reload the saved Program, then review and reapply them.' }); }
      db.prepare('DELETE FROM parts WHERE program_id = ?').run(program.id);
      db.prepare('DELETE FROM footer_roles WHERE program_id = ?').run(program.id);
      const footer = req.body.footer as FooterRole[];
      const insertFooter = db.prepare('INSERT INTO footer_roles (program_id, id, title, position) VALUES (?, ?, ?, ?)');
      footer.forEach((role, index) => insertFooter.run(program.id, role.id, role.title, index));
      const insertPart = db.prepare('INSERT INTO parts (program_id, id, target_id, target_kind, kind, value, role, name, extra_info, intentionally_not_listed, position, participant_id, reference_mode) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
      (req.body.parts as DirectPart[]).forEach((part, index) => insertPart.run(program.id, part.id, part.targetId, part.targetKind, part.kind, part.value, part.role, part.name, part.extraInfo, part.intentionallyNotListed ? 1 : 0, index, part.kind === 'reference' ? part.participantId ?? null : null, part.kind === 'reference' ? part.referenceMode ?? null : null));
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    res.json({ ...readParts(db, program.id), version: program.version + 1 });
  });
  return router;
}
