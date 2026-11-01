import { Router, type RequestHandler } from 'express';
import type { DatabaseSync } from 'node:sqlite';
import { programAccessSql } from '../domain/access.js';
import { awaitsNamedAssignment, type ReviewPart } from '../domain/unassigned.js';

export function unassignedRoutes(db: DatabaseSync, coordinator: RequestHandler) {
  const router = Router();
  router.get('/api/unassigned', coordinator, (_req, res) => {
    const programs = db.prepare(`SELECT p.id, p.title FROM programs p WHERE ${programAccessSql('p')} ORDER BY p.title COLLATE NOCASE, p.id`).all(res.locals.user.id, res.locals.user.id);
    const rows = db.prepare(`SELECT p.id AS programId, p.title AS programTitle, e.name AS eventName,
      part.id, part.target_id AS targetId, part.target_kind AS targetKind, part.kind, part.value,
      part.role, part.name, part.extra_info AS extraInfo,
      part.intentionally_not_listed AS intentionallyNotListed,
      d.role AS participantRole, d.name AS participantName, d.honorific AS participantHonorific,
      d.position AS participantPosition, d.organization AS participantOrganization, d.subtitle AS participantSubtitle,
      fr.title AS footerTitle
      FROM programs p JOIN parts part ON part.program_id = p.id
      LEFT JOIN events e ON e.id = p.event_id
      LEFT JOIN participants d ON d.id = part.participant_id
      LEFT JOIN footer_roles fr ON part.target_kind = 'footer' AND fr.program_id = p.id AND fr.id = part.target_id
      WHERE ${programAccessSql('p')}
      ORDER BY e.id IS NULL, e.id, p.event_position, p.id, part.position`).all(res.locals.user.id, res.locals.user.id) as Record<string, unknown>[];
    const records: ReviewPart[] = [];
    const contentCache = new Map<number, Map<string, { id: string; parentId: string | null; kind: string; label: string }>>();
    for (const row of rows) {
      const programId = Number(row.programId);
      const targetId = String(row.targetId);
      const targetKind = String(row.targetKind) as ReviewPart['targetKind'];
      let targetLabel: string;
      let targetPath: string;
      if (targetKind === 'footer') {
        targetLabel = String(row.footerTitle || '') || 'Removed Footer role';
        targetPath = `Footer · ${targetLabel}`;
      } else {
        let byId = contentCache.get(programId);
        if (!byId) {
          const nodes = db.prepare('SELECT id, parent_id AS parentId, kind, label FROM content_nodes WHERE program_id = ?').all(programId) as unknown as { id: string; parentId: string | null; kind: string; label: string }[];
          byId = new Map(nodes.map(node => [node.id, node]));
          contentCache.set(programId, byId);
        }
        const target = byId.get(targetId);
        targetLabel = target?.label || (targetKind === 'item' ? 'Untitled Item' : targetKind === 'section' ? 'Unheaded Section' : 'Untitled mini-program');
        const parents: string[] = [];
        let parentId = target?.parentId;
        while (parentId) {
          const parent = byId.get(parentId);
          if (!parent) break;
          if (parent.label.trim()) parents.unshift(parent.label);
          parentId = parent.parentId;
        }
        targetPath = [...parents, targetLabel].join(' › ');
      }
      const part = {
        id: String(row.id), targetId, targetKind,
        kind: String(row.kind) as ReviewPart['kind'], value: String(row.value || ''),
        role: String(row.role || ''), name: String(row.name || ''), extraInfo: String(row.extraInfo || ''),
        intentionallyNotListed: Boolean(row.intentionallyNotListed),
        participant: row.participantRole == null ? undefined : {
          role: String(row.participantRole), name: String(row.participantName || ''),
          honorific: String(row.participantHonorific || ''), position: String(row.participantPosition || ''),
          organization: String(row.participantOrganization || ''), subtitle: String(row.participantSubtitle || ''),
        },
      } as ReviewPart;
      if (awaitsNamedAssignment(part)) records.push({ ...part, programId, programTitle: String(row.programTitle), eventName: row.eventName == null ? null : String(row.eventName), targetLabel, targetPath });
    }
    res.json({ parts: records, programs });
  });
  return router;
}
