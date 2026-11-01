import { Router, type RequestHandler } from 'express';
import type { DatabaseSync } from 'node:sqlite';
import { validateContent, type ContentNode } from '../domain/content.js';
import type { Program } from '../domain/programs.js';

export function readContent(db: DatabaseSync, programId: number) {
  return db.prepare("SELECT id, parent_id AS parentId, kind, label, detail, start_time AS startTime, end_time AS endTime, date, block_label AS blockLabel FROM content_nodes WHERE program_id = ? ORDER BY position").all(programId) as ContentNode[];
}

export function writeContent(db: DatabaseSync, programId: number, nodes: ContentNode[]) {
  db.prepare('DELETE FROM content_nodes WHERE program_id = ?').run(programId);
  const insert = db.prepare('INSERT INTO content_nodes (program_id, id, parent_id, kind, label, detail, start_time, end_time, date, block_label, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  nodes.forEach((node, index) => insert.run(programId, node.id, node.parentId, node.kind, node.label, node.detail, node.startTime, node.endTime, node.date || null, node.blockLabel || '', index));
}

export function contentRoutes(db: DatabaseSync, coordinator: RequestHandler) {
  const router = Router();
  router.use('/api/programs/:id/content', coordinator);
  const find = (id: number, owner: number) => db.prepare(`SELECT id, title, subtitle, date, start_time AS startTime, end_time AS endTime,
    CASE WHEN EXISTS (SELECT 1 FROM program_publications pub WHERE pub.program_id = programs.id) THEN 'Published' ELSE 'Draft' END AS status, version
    FROM programs WHERE id = ? AND owner_id = ?`).get(id, owner) as Program | undefined;
  router.put('/api/programs/:id/content', (req, res) => {
    const program = find(Number(req.params.id), res.locals.user.id);
    if (!program) return res.status(404).json({ error: 'Program not found.' });
    const error = validateContent(req.body);
    if (error) return res.status(400).json({ error });
    db.exec('BEGIN IMMEDIATE');
    try {
      const result = db.prepare('UPDATE programs SET version = version + 1 WHERE id = ? AND owner_id = ? AND version = ?').run(program.id, res.locals.user.id, req.body.version);
      if (!result.changes) {
        db.exec('ROLLBACK');
        return res.status(409).json({ error: 'This Draft changed. Your rundown entries are kept. Reload the saved rundown, then review and reapply your entries.' });
      }
      writeContent(db, program.id, req.body.nodes);
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    res.json({ program: find(program.id, res.locals.user.id), nodes: readContent(db, program.id) });
  });
  return router;
}
