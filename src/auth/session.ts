import { createHash, randomBytes } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type { Request, Response } from 'express';
import type { Config } from '../config.js';

export type Session = { id: string; identity_id: number | null; expires_at: number; verifier: string | null; state: string | null; nonce: string | null };
export const sessionKey = (token: string) => createHash('sha256').update(token).digest('hex');
export function sessions(db: DatabaseSync, config: Config) {
  const cookieName = config.secureCookies ? '__Host-rundown' : 'rundown-local';
  const options = { httpOnly: true, secure: config.secureCookies, sameSite: 'lax' as const, path: '/', signed: true };
  const remove = (req: Request, res: Response) => {
    const token = req.signedCookies[cookieName];
    if (typeof token === 'string') db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionKey(token));
    res.clearCookie(cookieName, options);
  };
  return {
    remove,
    get(req: Request): Session | undefined {
      const token = req.signedCookies[cookieName];
      if (typeof token !== 'string') return;
      return db.prepare('SELECT * FROM sessions WHERE id = ? AND expires_at > ?').get(sessionKey(token), Date.now()) as Session | undefined;
    },
    create(req: Request, res: Response, identityId: number | null, pending?: { verifier: string; state: string; nonce: string }) {
      remove(req, res);
      db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now());
      const token = randomBytes(32).toString('base64url');
      const maxAge = pending ? 10 * 60_000 : 8 * 60 * 60_000;
      db.prepare('INSERT INTO sessions VALUES (?, ?, ?, ?, ?, ?)').run(sessionKey(token), identityId, Date.now() + maxAge, pending?.verifier ?? null, pending?.state ?? null, pending?.nonce ?? null);
      res.cookie(cookieName, token, { ...options, maxAge });
    },
    user(req: Request) {
      const session = this.get(req);
      if (!session?.identity_id) return null;
      const identity = db.prepare('SELECT * FROM identities WHERE id = ?').get(session.identity_id) as { id: number; issuer: string; subject: string; label: string };
      const coordinator = config.appEnv === 'dev' && identity.issuer === config.testerIssuer && identity.subject === config.testerSubject
        && Boolean(db.prepare('SELECT 1 FROM coordinator_grants WHERE identity_id = ?').get(identity.id));
      return { id: identity.id, label: identity.label, coordinator };
    },
  };
}
