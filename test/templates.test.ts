import express, { type RequestHandler } from 'express';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { templateRoutes } from '../src/api/templates.js';
import { openProduct } from '../src/db/product.js';
import { seedProduct } from '../src/demo/seed.js';
import { fixture, listen } from './support.js';

const json = (origin: string, cookie: string, path: string, method = 'GET', body?: unknown) => fetch(`${origin}${path}`, { method, headers: { cookie, ...(body === undefined ? {} : { origin, 'content-type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

it('saves an owned snapshot, strips people and Header times, and creates independent Drafts across Events', async () => {
  const f = await fixture();
  try {
    seedProduct({ APP_ENV: 'dev', PRODUCT_DB_PATH: f.config.productPath, DEV_COORDINATOR_ISSUER: f.config.testerIssuer, DEV_COORDINATOR_SUBJECT: f.config.testerSubject });
    const cookie = await f.signIn();
    const demoTemplates = (await (await json(f.origin, cookie, '/api/templates')).json()).templates;
    expect(demoTemplates).toEqual([expect.objectContaining({ name: 'Example Worship Template' })]);
    const demoDetail = await (await json(f.origin, cookie, `/api/templates/${demoTemplates[0].id}`)).json();
    expect(demoDetail.nodes.length).toBeGreaterThan(0);
    const programs = (await (await json(f.origin, cookie, '/api/programs')).json()).programs;
    const source = programs.find((program: { title: string }) => program.title === 'Community Gathering');
    const prepared = openProduct(f.config.productPath);
    try {
      prepared.prepare("UPDATE parts SET extra_info = 'Rehearsal note' WHERE program_id = ? AND id = 'demo-introit-leader'").run(source.id);
      prepared.prepare("UPDATE parts SET kind = 'structured', role = 'Prayer Leader', name = 'Taylor Placeholder' WHERE program_id = ? AND id = 'demo-prayer-role'").run(source.id);
      prepared.prepare("INSERT INTO parts (program_id, id, target_id, target_kind, kind, value, extra_info, position) VALUES (?, 'demo-group-assignment', 'demo-reading', 'item', 'text', 'Group Placeholder', 'Microphone note', 20)").run(source.id);
      prepared.prepare("INSERT INTO parts (program_id, id, target_id, target_kind, kind, role, position) VALUES (?, 'demo-role-placeholder', 'demo-reading', 'item', 'role', 'Reader', 21)").run(source.id);
    } finally { prepared.close(); }
    const saved = await json(f.origin, cookie, '/api/templates', 'POST', { programId: source.id, name: 'My Gathering Template' });
    expect(saved.status).toBe(201);
    const template = (await saved.json()).template;
    expect((await json(f.origin, cookie, '/api/templates')).status).toBe(200);
    const detail = await (await json(f.origin, cookie, `/api/templates/${template.id}`)).json();
    expect(detail.nodes.find((node: { id: string }) => node.id === 'demo-introit')).toMatchObject({ detail: 'A song of welcome\nSing together.' });
    expect(detail.parts.find((part: { id: string }) => part.id === 'demo-introit-leader')).toMatchObject({ kind: 'role', role: 'Speaker', name: '', value: '', extraInfo: 'Rehearsal note' });
    expect(detail.parts.find((part: { id: string }) => part.id === 'demo-prayer-role')).toMatchObject({ kind: 'role', role: 'Prayer Leader', name: '' });
    expect(detail.parts.find((part: { id: string }) => part.id === 'demo-group-assignment')).toMatchObject({ kind: 'blank', value: '', extraInfo: 'Microphone note' });
    expect(detail.parts.find((part: { id: string }) => part.id === 'demo-role-placeholder')).toMatchObject({ kind: 'role', role: 'Reader', name: '' });
    expect(detail.parts.find((part: { id: string }) => part.id === 'demo-reading-unlisted')).toMatchObject({ intentionallyNotListed: true });
    expect(detail.footer).toEqual([{ id: 'demo-pianist', title: 'Pianist' }]);
    const sourceAfterSave = await (await json(f.origin, cookie, `/api/programs/${source.id}`)).json();
    expect(sourceAfterSave.parts.find((part: { id: string }) => part.id === 'demo-introit-leader')).toMatchObject({ kind: 'reference', participant: { name: 'Alex Placeholder' } });
    const invalid = await json(f.origin, cookie, `/api/templates/${template.id}/programs`, 'POST', { title: '', date: null });
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toMatchObject({ errors: { title: expect.any(String) } });
    const published = programs.find((program: { title: string }) => program.title === 'Example Published Program');
    const nestedTemplate = await json(f.origin, cookie, '/api/templates', 'POST', { programId: published.id, name: 'Nested Placeholder Template' });
    const nestedId = (await nestedTemplate.json()).template.id;
    const nested = await (await json(f.origin, cookie, `/api/templates/${nestedId}`)).json();
    expect(nested.nodes.find((node: { id: string }) => node.id === 'demo-morning')).toMatchObject({ date: null, startTime: null, endTime: null });

    const events = (await (await json(f.origin, cookie, '/api/events')).json()).events;
    const firstEvent = events.find((event: { name: string }) => event.name === 'Sabbath');
    const secondEvent = events.find((event: { name: string }) => event.name === 'Example Conference');
    const create = (eventId: number, title: string) => json(f.origin, cookie, `/api/templates/${template.id}/programs`, 'POST', { title, date: '2026-11-08', eventId });
    const first = await create(firstEvent.id, 'First Copy');
    const second = await create(secondEvent.id, 'Second Copy');
    expect(first.status).toBe(201); expect(second.status).toBe(201);
    const firstProgram = (await first.json()).program;
    const secondProgram = (await second.json()).program;
    expect(firstProgram).toMatchObject({ title: 'First Copy', status: 'Draft', date: '2026-11-08', startTime: null, endTime: null });
    expect(secondProgram).toMatchObject({ title: 'Second Copy', status: 'Draft' });
    const created = await (await json(f.origin, cookie, `/api/programs/${firstProgram.id}`)).json();
    expect(created.nodes).toEqual(detail.nodes);
    expect(created.parts.find((part: { id: string }) => part.id === 'demo-prayer-role')).toMatchObject({ kind: 'role', role: 'Prayer Leader', name: '' });
    expect(created.parts.some((part: { participant?: unknown }) => part.participant)).toBe(false);
    const db = openProduct(f.config.productPath);
    try {
      expect(db.prepare('SELECT owner_id FROM program_templates WHERE id = ?').get(template.id)).toEqual({ owner_id: db.prepare('SELECT id FROM identities WHERE subject = ?').get(f.config.testerSubject)?.id });
      expect(db.prepare('SELECT COUNT(*) AS count FROM program_publications WHERE program_id IN (?, ?)').get(firstProgram.id, secondProgram.id)).toEqual({ count: 0 });
    } finally { db.close(); }

    f.issuer.setSubject('other-coordinator-placeholder');
    const stranger = await f.signIn();
    const strangerDb = openProduct(f.config.productPath);
    try { strangerDb.prepare("INSERT INTO coordinator_grants (identity_id, environment) SELECT id, 'dev' FROM identities WHERE subject = ?").run('other-coordinator-placeholder'); }
    finally { strangerDb.close(); }
    f.config.testerSubject = 'other-coordinator-placeholder';
    await f.restart();
    expect((await json(f.origin, stranger, `/api/templates/${template.id}`)).status).toBe(404);
    expect((await json(f.origin, stranger, `/api/templates/${template.id}/programs`, 'POST', { title: 'Forbidden Copy' })).status).toBe(404);
    expect((await json(f.origin, stranger, '/api/templates', 'POST', { programId: source.id, name: 'Forbidden' })).status).toBe(404);
  } finally { await f.close(); }
});

it('does not recreate a deliberately removed demo template on seed reruns', async () => {
  const f = await fixture();
  try {
    const env = { APP_ENV: 'dev', PRODUCT_DB_PATH: f.config.productPath, DEV_COORDINATOR_ISSUER: f.config.testerIssuer, DEV_COORDINATOR_SUBJECT: f.config.testerSubject };
    seedProduct(env);
    let db = openProduct(f.config.productPath);
    try { db.prepare("UPDATE program_templates SET name = 'Coordinator Edited Placeholder Template' WHERE name = 'Example Worship Template'").run(); }
    finally { db.close(); }
    seedProduct(env);
    db = openProduct(f.config.productPath);
    try {
      expect(db.prepare("SELECT name FROM program_templates WHERE owner_id = (SELECT id FROM identities WHERE subject = ?)").get(f.config.testerSubject)).toEqual({ name: 'Coordinator Edited Placeholder Template' });
      db.prepare("DELETE FROM program_templates WHERE name = 'Coordinator Edited Placeholder Template'").run();
    }
    finally { db.close(); }
    seedProduct(env);
    db = openProduct(f.config.productPath);
    try { expect(db.prepare("SELECT COUNT(*) AS count FROM program_templates WHERE owner_id = (SELECT id FROM identities WHERE subject = ?)").get(f.config.testerSubject)).toEqual({ count: 0 }); }
    finally { db.close(); }
  } finally { await f.close(); }
});

it('shares owned templates with other coordinators and imports them as independent private copies', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'rundown-sharing-'));
  const db = openProduct(join(dir, 'product.sqlite'));
  const identity = (subject: string) => Number(db.prepare("INSERT INTO identities (issuer, subject, label) VALUES ('https://issuer.example.invalid', ?, 'Placeholder coordinator')").run(subject).lastInsertRowid);
  const ownerId = identity('owner-placeholder'), recipientId = identity('recipient-placeholder');
  const snapshot = { nodes: [{ id: 'service', parentId: null, kind: 'section', label: 'Service', detail: '', startTime: null, endTime: null, date: null, blockLabel: '' }, { id: 'opening', parentId: 'service', kind: 'item', label: 'Opening', detail: 'Placeholder detail', startTime: null, endTime: null, date: null, blockLabel: '' }], parts: [{ id: 'leader', targetId: 'opening', targetKind: 'item', kind: 'role', value: '', role: 'Speaker', name: '', extraInfo: 'Music note', intentionallyNotListed: false }], footer: [{ id: 'pianist', title: 'Pianist' }] };
  const templateId = Number(db.prepare('INSERT INTO program_templates (owner_id, name, snapshot) VALUES (?, ?, ?)').run(ownerId, 'Owner Placeholder Template', JSON.stringify(snapshot)).lastInsertRowid);
  const coordinator: RequestHandler = (req, res, next) => { res.locals.user = { id: Number(req.get('x-test-identity')), coordinator: true }; next(); };
  const app = express();
  app.use(express.json());
  app.use(templateRoutes(db, coordinator));
  const server = await listen(app);
  const as = (user: number, path: string, method = 'GET', body?: unknown) => fetch(`${server.origin}${path}`, { method, headers: { 'x-test-identity': String(user), ...(body === undefined ? {} : { 'content-type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  try {
    expect((await (await as(recipientId, '/api/templates')).json()).sharedTemplates).toEqual([]);
    expect((await as(recipientId, `/api/templates/shared/${templateId}`)).status).toBe(404);
    expect((await as(recipientId, `/api/templates/shared/${templateId}/import`, 'POST', {})).status).toBe(404);
    expect((await as(recipientId, `/api/templates/${templateId}/sharing`, 'PATCH', { shared: true })).status).toBe(404);
    expect((await as(ownerId, `/api/templates/${templateId}/sharing`, 'PATCH', { shared: 'yes' })).status).toBe(400);

    const shared = await as(ownerId, `/api/templates/${templateId}/sharing`, 'PATCH', { shared: true });
    expect(shared.status).toBe(200);
    expect(await shared.json()).toEqual({ shared: true });
    expect((await (await as(ownerId, '/api/templates')).json()).sharedTemplates).toEqual([]);
    expect((await as(ownerId, `/api/templates/shared/${templateId}`)).status).toBe(404);
    expect((await (await as(recipientId, '/api/templates')).json()).sharedTemplates).toEqual([{ id: templateId, name: 'Owner Placeholder Template' }]);
    const preview = await as(recipientId, `/api/templates/shared/${templateId}`);
    expect(preview.status).toBe(200);
    expect(await preview.json()).toEqual({ template: { id: templateId, name: 'Owner Placeholder Template' }, ...snapshot });
    expect((await as(recipientId, `/api/templates/${templateId}`)).status).toBe(404);
    expect((await as(recipientId, `/api/templates/${templateId}/programs`, 'POST', { title: 'Forbidden Copy' })).status).toBe(404);

    const imported = await as(recipientId, `/api/templates/shared/${templateId}/import`, 'POST', {});
    expect(imported.status).toBe(201);
    const copy = (await imported.json()).template;
    expect(copy).toEqual({ id: expect.any(Number), name: 'Owner Placeholder Template' });
    expect(copy.id).not.toBe(templateId);
    expect((await (await as(recipientId, '/api/templates')).json()).templates).toEqual([{ id: copy.id, name: 'Owner Placeholder Template', shared: 0 }]);
    expect(await (await as(recipientId, `/api/templates/${copy.id}`)).json()).toEqual({ template: copy, ...snapshot });
    expect((await as(ownerId, `/api/templates/${copy.id}`)).status).toBe(404);
    expect((await (await as(ownerId, '/api/templates')).json()).sharedTemplates).toEqual([]);
    expect((await as(recipientId, `/api/templates/${copy.id}/programs`, 'POST', { title: 'Imported Placeholder Draft' })).status).toBe(201);

    expect((await as(ownerId, `/api/templates/${templateId}/sharing`, 'PATCH', { shared: false })).status).toBe(200);
    expect((await (await as(recipientId, '/api/templates')).json()).sharedTemplates).toEqual([]);
    expect((await as(recipientId, `/api/templates/shared/${templateId}`)).status).toBe(404);
    expect((await as(recipientId, `/api/templates/shared/${templateId}/import`, 'POST', {})).status).toBe(404);
    expect(await (await as(recipientId, `/api/templates/${copy.id}`)).json()).toEqual({ template: copy, ...snapshot });
    expect(db.prepare('SELECT owner_id, shared FROM program_templates WHERE id = ?').get(copy.id)).toEqual({ owner_id: recipientId, shared: 0 });
  } finally { await server.close(); db.close(); rmSync(dir, { recursive: true, force: true }); }
});
