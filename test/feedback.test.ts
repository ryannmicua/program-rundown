import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { fixture } from './support.js';
import { readConfig } from '../src/config.js';
import { seedProduct } from '../src/demo/seed.js';
import { openProduct } from '../src/db/product.js';

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => { for (const close of cleanup.splice(0)) await close(); });
async function setup(options = {}) { const f = await fixture(options); cleanup.push(f.close); return f; }
describe('isolated dev feedback', () => {
  it('creates anonymously, restricts readback, stores safe context, and survives restart and seeding', async () => {
    const f = await setup();
    const send = (path: string, method: string, body: unknown, cookie = '') => fetch(`${f.origin}${path}`, { method, headers: { origin: f.origin, 'content-type': 'application/json', cookie }, body: JSON.stringify(body) });
    expect((await fetch(`${f.origin}/health`)).status).toBe(200);
    const response = await send('/api/feedback', 'POST', { note: '<script>alert(1)</script>', route: 'https://user:password@example.invalid/auth/callback?code=secret#token', title: 'token=secret', element: { selector: 'body > a', tag: 'a', text: 'token=secret https://example.invalid?password=secret', box: { x: 1, y: 2, width: 3, height: 4 } }, viewport: { width: 800, height: 600 } });
    expect(response.status).toBe(201);
    const { id } = await response.json();
    expect((await fetch(`${f.origin}/api/feedback`)).status).toBe(401);
    expect((await fetch(`${f.origin}/api/feedback/${id}`)).status).toBe(401);
    expect((await send(`/api/feedback/${id}`, 'PATCH', { done: true })).status).toBe(401);
    const cookie = await f.signIn();
    const get = (path: string) => fetch(`${f.origin}${path}`, { headers: { cookie } });
    const data = await (await get(`/api/feedback/${id}`)).json();
    expect(data.feedback).toMatchObject({ route: '/', reporter: null, done: false, element: { selector: 'body > a' } });
    expect(JSON.stringify(data)).not.toContain('secret');
    for (const done of [true, false]) expect((await (await send(`/api/feedback/${id}`, 'PATCH', { done }, cookie)).json()).feedback.done).toBe(done);
    expect((await (await get(`/api/feedback?after=${id}`)).json()).feedback).toEqual([]);
    expect((await get('/api/feedback?after=no')).status).toBe(400);
    expect((await get('/api/feedback/9999')).status).toBe(404);
    for (const note of ['', '   ', 'x'.repeat(4001)]) expect((await send('/api/feedback', 'POST', { note })).status).toBe(400);
    expect((await fetch(`${f.origin}/api/feedback`, { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://evil.invalid' }, body: '{"note":"bad"}' })).status).toBe(403);
    const before = readFileSync(f.config.feedbackPath);
    seedProduct({ APP_ENV: 'dev', PRODUCT_DB_PATH: f.config.productPath, DEV_COORDINATOR_ISSUER: f.config.testerIssuer, DEV_COORDINATOR_SUBJECT: f.config.testerSubject });
    openProduct(f.config.productPath).close();
    expect(readFileSync(f.config.feedbackPath)).toEqual(before);
    await f.restart();
    expect((await (await get(`/api/feedback/${id}`)).json()).feedback.note).toBe('<script>alert(1)</script>');
    const db = new DatabaseSync(f.config.productPath); expect(db.prepare('PRAGMA foreign_keys').get()).toBeDefined(); expect(db.prepare('SELECT * FROM schema_migrations').all()).toHaveLength(2); db.close();
  });
  it.each([{ appEnv: 'dev', enabled: 'false' }, { appEnv: 'test', enabled: 'true' }, { appEnv: 'production', enabled: 'true' }])('never opens disabled feedback storage: %j', async options => {
    const f = await setup(options);
    expect(existsSync(f.config.feedbackPath)).toBe(false);
    for (const path of ['/feedback', '/api/feedback', '/api/feedback/1']) {
      for (const method of ['GET', 'POST', 'PATCH']) expect((await fetch(`${f.origin}${path}`, { method })).status).toBe(404);
    }
    expect((await (await fetch(`${f.origin}/api/session`)).json()).feedbackEnabled).toBe(false);
    expect(existsSync(f.config.feedbackPath)).toBe(false);
  });
  it('defaults off, production refuses feedback regardless of NODE_ENV, and seed requires dev', () => {
    const base = { APP_ORIGIN: 'https://app.example.invalid', SESSION_SECRET: 'x'.repeat(40), FEEDBACK_ENABLED: 'true', NODE_ENV: 'production' };
    expect(readConfig(base).feedbackEnabled).toBe(false);
    expect(readConfig({ ...base, APP_ENV: 'production' }).feedbackEnabled).toBe(false);
    expect(readConfig({ ...base, APP_ENV: 'dev' }).feedbackEnabled).toBe(true);
    expect(readConfig({ ...base, APP_ENV: 'dev', FEEDBACK_ENABLED: undefined }).feedbackEnabled).toBe(false);
    expect(() => seedProduct({ APP_ENV: 'production' })).toThrow();
    expect(() => readConfig({ ...base, PRODUCT_DB_PATH: '/tmp/same', FEEDBACK_DB_PATH: '/tmp/same' })).toThrow();
  });
});
