import * as oidc from 'openid-client';
import { Router } from 'express';
import type { DatabaseSync } from 'node:sqlite';
import type { Config } from '../config.js';
import type { sessions } from './session.js';

export function authRoutes(db: DatabaseSync, config: Config, store: ReturnType<typeof sessions>) {
  const router = Router();
  let client: Promise<oidc.Configuration> | undefined;
  function getClient() {
    if (!config.issuer || !config.clientId) throw new Error('OIDC is not configured');
    return client ??= oidc.discovery(new URL(config.issuer), config.clientId, { token_endpoint_auth_method: 'none' }, oidc.None(), {
      // Only local test issuers may use HTTP. Deployment always uses HTTPS.
      execute: config.appEnv !== 'production' && /^http:\/\/(127\.0\.0\.1|localhost):\d+\/?$/.test(config.issuer) ? [oidc.allowInsecureRequests] : [],
    }).then(client => { oidc.enableNonRepudiationChecks(client); return client; }).catch(error => { client = undefined; throw error; });
  }
  router.get('/auth/login', async (req, res) => {
    const client = await getClient();
    const verifier = oidc.randomPKCECodeVerifier();
    const state = oidc.randomState();
    const nonce = oidc.randomNonce();
    store.create(req, res, null, { verifier, state, nonce });
    res.set('Cache-Control', 'no-store').redirect(oidc.buildAuthorizationUrl(client, {
      redirect_uri: `${config.origin}/auth/callback`, scope: 'openid profile',
      code_challenge: await oidc.calculatePKCECodeChallenge(verifier), code_challenge_method: 'S256', state, nonce,
    }).href);
  });
  router.get('/auth/callback', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const pending = store.get(req);
    // Consume before exchange: callbacks cannot replay a transaction.
    store.remove(req, res);
    if (!pending?.verifier || !pending.state || !pending.nonce) return res.status(400).send('Sign-in expired. Start again at /signin.');
    try {
      const client = await getClient();
      const tokens = await oidc.authorizationCodeGrant(client, new URL(req.originalUrl, config.origin), {
        pkceCodeVerifier: pending.verifier, expectedState: pending.state, expectedNonce: pending.nonce, idTokenExpected: true,
      });
      const claims = tokens.claims()!;
      db.exec('BEGIN IMMEDIATE');
      let id: number;
      try {
        db.prepare('INSERT INTO identities (issuer, subject, label) VALUES (?, ?, ?) ON CONFLICT(issuer, subject) DO UPDATE SET label=excluded.label').run(claims.iss, claims.sub, 'Dev tester');
        id = (db.prepare('SELECT id FROM identities WHERE issuer = ? AND subject = ?').get(claims.iss, claims.sub) as { id: number }).id;
        if (config.appEnv === 'dev' && claims.iss === config.testerIssuer && claims.sub === config.testerSubject) db.prepare("INSERT OR IGNORE INTO coordinator_grants VALUES (?, 'dev')").run(id);
        db.exec('COMMIT');
      } catch (error) { db.exec('ROLLBACK'); throw error; }
      store.create(req, res, id);
      return res.redirect('/');
    } catch {
      return res.status(400).send('Sign-in could not be verified. Start again at /signin.');
    }
  });
  router.post('/auth/logout', (req, res) => { store.remove(req, res); res.status(204).end(); });
  return router;
}
