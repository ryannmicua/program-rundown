import { afterEach, expect, it } from 'vitest';
import { fixture } from './support.js';
import { openProduct } from '../src/db/product.js';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => { for (const close of cleanup.splice(0)) await close(); });
async function setup() { const f = await fixture(); cleanup.push(f.close); return f; }

it('saves independent optional Header fields, reopens after restart and sign-in, and detects stale edits atomically', async () => {
  const f = await setup();
  let cookie = await f.signIn();
  const get = (path: string) => fetch(`${f.origin}/api/programs${path}`, { headers: { cookie } });
  const send = (path: string, method: string, body: unknown) => fetch(`${f.origin}/api/programs${path}`, { method, headers: { cookie, origin: f.origin, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  for (const times of [{}, { startTime: '09:00' }, { endTime: '12:00' }, { startTime: '23:00', endTime: '01:00' }]) {
    const created = await send('', 'POST', { title: 'Community Gathering', ...times });
    expect(created.status).toBe(201);
    const { program } = await created.json();
    expect(program).toMatchObject({ title: 'Community Gathering', status: 'Draft', date: null, startTime: null, endTime: null, version: 1, ...times });
    await f.restart();
    cookie = await f.signIn();
    expect((await (await get(`/${program.id}`)).json()).program).toEqual(program);
    const saved = await send(`/${program.id}`, 'PATCH', { title: 'Updated Gathering', date: '2028-02-29', startTime: null, endTime: null, version: 1 });
    expect(saved.status).toBe(200);
    const current = (await saved.json()).program;
    expect(current).toMatchObject({ title: 'Updated Gathering', date: '2028-02-29', startTime: null, endTime: null, version: 2 });
    expect((await send(`/${program.id}`, 'PATCH', { title: 'Lost edit', version: 1 })).status).toBe(409);
    expect((await (await get(`/${program.id}`)).json()).program).toEqual(current);
    for (const invalid of [{ title: '  ' }, { title: 'x'.repeat(201) }, { title: 123 }, { date: '2026-02-29' }, { date: '2026-04-31' }, { date: '2026-1-01' }, { date: '0000-01-01' }, { startTime: '24:00' }, { endTime: '9:30' }, { endTime: false }, { status: 'Published' }, { ownerId: 999 }]) {
      const rejected = await send(`/${program.id}`, 'PATCH', { version: 2, ...invalid });
      expect(rejected.status).toBe(400);
      expect((await rejected.json()).error).toEqual(expect.any(String));
      expect((await (await get(`/${program.id}`)).json()).program).toEqual(current);
    }
    expect((await send(`/${program.id}`, 'PATCH', { title: 'Missing revision' })).status).toBe(400);
  }
  expect((await (await get('')).json()).programs).toHaveLength(4);
  for (const body of [null, [], {}, { title: '' }, { title: 'Valid', date: 'bad' }]) expect((await send('', 'POST', body)).status).toBe(400);
  expect((await (await get('')).json()).programs).toHaveLength(4);
});

it('enforces owner access for list, detail and edits; unauthenticated and other identities cannot mutate a Draft', async () => {
  const f = await setup();
  const cookie = await f.signIn();
  const send = (path: string, method: string, body: unknown, auth = '') => fetch(`${f.origin}/api/programs${path}`, { method, headers: { cookie: auth, origin: f.origin, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const created = await send('', 'POST', { title: 'Private Draft' }, cookie);
  expect(created.status).toBe(201);
  const { program } = await created.json();
  const db = openProduct(f.config.productPath);
  let foreignId: number;
  try {
    const owner = db.prepare('INSERT INTO identities (issuer, subject, label) VALUES (?, ?, ?)').run(f.config.testerIssuer, 'other-coordinator-placeholder', 'Other coordinator');
    foreignId = Number(db.prepare('INSERT INTO programs (owner_id, title) VALUES (?, ?)').run(owner.lastInsertRowid, 'Another coordinator Draft').lastInsertRowid);
  } finally { db.close(); }
  expect((await fetch(`${f.origin}/api/programs`, { headers: { cookie } }).then(r => r.json())).programs).toEqual([program]);
  expect((await fetch(`${f.origin}/api/programs/${foreignId}`, { headers: { cookie } })).status).toBe(404);
  expect((await send(`/${foreignId}`, 'PATCH', { title: 'Denied', version: 1 }, cookie)).status).toBe(404);
  for (const path of ['', `/${program.id}`]) expect((await fetch(`${f.origin}/api/programs${path}`)).status).toBe(401);
  expect((await send('', 'POST', { title: 'Denied' })).status).toBe(401);
  expect((await send(`/${program.id}`, 'PATCH', { title: 'Denied', version: 1 })).status).toBe(401);
  f.issuer.setSubject('another-placeholder');
  const stranger = await f.signIn();
  expect((await fetch(`${f.origin}/api/programs`, { headers: { cookie: stranger } })).status).toBe(403);
  expect((await fetch(`${f.origin}/api/programs/${program.id}`, { headers: { cookie: stranger } })).status).toBe(403);
  expect((await send(`/${program.id}`, 'PATCH', { title: 'Denied', version: 1 }, stranger)).status).toBe(403);
  expect((await send('', 'POST', { title: 'Denied' }, stranger)).status).toBe(403);
  expect((await fetch(`${f.origin}/api/programs/${program.id}`, { headers: { cookie } }).then(r => r.json())).program).toEqual(program);
  expect((await fetch(`${f.origin}/api/programs/not-an-id`, { headers: { cookie } })).status).toBe(404);
  expect((await fetch(`${f.origin}/api/programs/999999`, { headers: { cookie } })).status).toBe(404);
  expect((await fetch(`${f.origin}/api/programs`, { method: 'POST', headers: { cookie, origin: 'https://other.invalid', 'content-type': 'application/json' }, body: '{"title":"Denied"}' })).status).toBe(403);
  const unchanged = openProduct(f.config.productPath);
  try { expect(unchanged.prepare('SELECT title, version FROM programs WHERE id = ?').get(foreignId)).toEqual({ title: 'Another coordinator Draft', version: 1 }); }
  finally { unchanged.close(); }
});

it('reopens a saved Draft after replacing the actual server process', async () => {
  const f = await setup();
  const cookie = await f.signIn();
  const created = await fetch(`${f.origin}/api/programs`, { method: 'POST', headers: { cookie, origin: f.origin, 'content-type': 'application/json' }, body: JSON.stringify({ title: 'Persistent Gathering' }) });
  const { program } = await created.json();
  async function startProcess() {
    const code = `
      import { createApp } from './src/app.ts';
      const runtime = await createApp(JSON.parse(process.env.RUNDOWN_TEST_CONFIG));
      const server = runtime.app.listen(0, '127.0.0.1', () => console.log('http://127.0.0.1:' + server.address().port));
      process.once('SIGTERM', () => server.close(() => { runtime.close(); process.exit(0); }));
    `;
    const child = spawn(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', code], { env: { ...process.env, RUNDOWN_TEST_CONFIG: JSON.stringify(f.config) }, stdio: ['ignore', 'pipe', 'pipe'] });
    async function close() {
      if (child.exitCode !== null || child.signalCode !== null) return;
      const exited = once(child, 'exit');
      child.kill('SIGTERM');
      await exited;
    }
    try {
      const origin = await new Promise<string>((resolve, reject) => {
        const timeout = setTimeout(() => reject(Error('Child server startup timed out')), 5000);
        let output = '';
        let diagnostic = '';
        child.stderr.on('data', chunk => { diagnostic += chunk.toString(); });
        child.stdout.on('data', chunk => {
          output += chunk.toString();
          const match = /http:\/\/127\.0\.0\.1:\d+/.exec(output);
          if (match) { clearTimeout(timeout); resolve(match[0]); }
        });
        child.once('error', error => { clearTimeout(timeout); reject(error); });
        child.once('exit', () => { clearTimeout(timeout); reject(Error(`Child server exited: ${diagnostic}`)); });
      });
      return { origin, close };
    } catch (error) { await close(); throw error; }
  }
  const first = await startProcess();
  try {
    const edit = await fetch(`${first.origin}/api/programs/${program.id}`, { method: 'PATCH', headers: { cookie, origin: f.origin, 'content-type': 'application/json' }, body: JSON.stringify({ title: 'Saved by first process', version: program.version }) });
    expect(edit.status).toBe(200);
  } finally { await first.close(); }
  const second = await startProcess();
  try {
    const reopened = await fetch(`${second.origin}/api/programs/${program.id}`, { headers: { cookie } }).then(response => response.json());
    expect(reopened.program).toMatchObject({ id: program.id, title: 'Saved by first process', date: null, startTime: null, endTime: null, version: 2 });
  } finally { await second.close(); }
});
