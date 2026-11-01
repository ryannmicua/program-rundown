import express from 'express';
import type { Server } from 'node:http';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import { createApp } from '../src/app.js';
import { readConfig } from '../src/config.js';

export async function listen(app: ReturnType<typeof express>) {
  const server = await new Promise<Server>(resolve => { const server = app.listen(0, '127.0.0.1', () => resolve(server)); });
  const address = server.address() as { port: number };
  return { server, origin: `http://127.0.0.1:${address.port}`, close: () => new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
    server.closeAllConnections();
  }) };
}
export async function mockIssuer() {
  const app = express();
  const keys = await generateKeyPair('RS256');
  const jwk = await exportJWK(keys.publicKey);
  const codes = new Map<string, { challenge: string; nonce: string; redirect: string; subject: string }>();
  let subject = 'tester-placeholder';
  app.use(express.urlencoded({ extended: false }));
  const runtime = await listen(app);
  app.get('/.well-known/openid-configuration', (_req, res) => res.json({
    issuer: runtime.origin, authorization_endpoint: `${runtime.origin}/authorize`, token_endpoint: `${runtime.origin}/token`, jwks_uri: `${runtime.origin}/jwks`,
    response_types_supported: ['code'], subject_types_supported: ['public'], id_token_signing_alg_values_supported: ['RS256'], token_endpoint_auth_methods_supported: ['none'], code_challenge_methods_supported: ['S256'],
  }));
  app.get('/jwks', (_req, res) => res.json({ keys: [{ ...jwk, kid: 'test-key', alg: 'RS256', use: 'sig' }] }));
  app.get('/authorize', (req, res) => {
    if (req.query.code_challenge_method !== 'S256' || req.query.client_id !== 'placeholder-client') return res.sendStatus(400);
    const code = randomUUID();
    codes.set(code, { challenge: String(req.query.code_challenge), nonce: String(req.query.nonce), redirect: String(req.query.redirect_uri), subject });
    const destination = new URL(String(req.query.redirect_uri));
    destination.searchParams.set('code', code); destination.searchParams.set('state', String(req.query.state));
    res.redirect(destination.href);
  });
  app.post('/token', async (req, res) => {
    const code = codes.get(req.body.code); codes.delete(req.body.code);
    if (!code || code.redirect !== req.body.redirect_uri || code.challenge !== createHash('sha256').update(req.body.code_verifier || '').digest('base64url')) return res.status(400).json({ error: 'invalid_grant' });
    const idToken = await new SignJWT({ nonce: code.nonce }).setProtectedHeader({ alg: 'RS256', kid: 'test-key' }).setIssuer(runtime.origin).setSubject(code.subject).setAudience('placeholder-client').setIssuedAt().setExpirationTime('5m').sign(keys.privateKey);
    return res.json({ access_token: 'test-access-token', token_type: 'Bearer', expires_in: 300, id_token: idToken });
  });
  return { ...runtime, setSubject: (value: string) => { subject = value; } };
}
export async function fixture(options: { appEnv?: string; enabled?: string } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'rundown-'));
  const issuer = await mockIssuer();
  // Bind first to establish a dynamic origin, then mount the app.
  const holder = express();
  const server = await listen(holder);
  const config = readConfig({ APP_ENV: options.appEnv || 'dev', FEEDBACK_ENABLED: options.enabled ?? 'true', APP_ORIGIN: options.appEnv === 'production' ? 'https://app.example.invalid' : server.origin, SESSION_SECRET: 'test-only-placeholder-session-secret-12345', OIDC_ISSUER: issuer.origin, OIDC_CLIENT_ID: 'placeholder-client', DEV_COORDINATOR_ISSUER: issuer.origin, DEV_COORDINATOR_SUBJECT: 'tester-placeholder', PRODUCT_DB_PATH: join(dir, 'product.sqlite'), FEEDBACK_DB_PATH: join(dir, 'feedback.sqlite') });
  let runtime = await createApp(config);
  holder.use((req, res, next) => runtime.app(req, res, next));
  async function signIn() {
    const start = await fetch(`${server.origin}/auth/login`, { redirect: 'manual' });
    const pendingCookie = start.headers.getSetCookie().at(-1)!.split(';')[0];
    const authorize = await fetch(start.headers.get('location')!, { redirect: 'manual' });
    const callback = await fetch(authorize.headers.get('location')!, { redirect: 'manual', headers: { cookie: pendingCookie } });
    if (callback.status !== 302) throw Error(`Mock sign-in failed: ${callback.status} ${await callback.text()}`);
    return callback.headers.getSetCookie().at(-1)!.split(';')[0];
  }
  return { ...server, dir, config, issuer, signIn,
    restart: async () => { runtime.close(); runtime = await createApp(config); },
    close: async () => { await server.close(); runtime.close(); await issuer.close(); rmSync(dir, { recursive: true, force: true }); },
  };
}
