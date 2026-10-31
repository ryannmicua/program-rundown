import { expect, it } from 'vitest';
import { sessions } from '../src/auth/session.js';
import { openProduct } from '../src/db/product.js';
import { readConfig } from '../src/config.js';
import type { Request, Response } from 'express';

it('uses a secure host-only cookie for HTTPS and rejects expired sessions', () => {
  const config = readConfig({ APP_ENV: 'dev', APP_ORIGIN: 'https://app.example.invalid', SESSION_SECRET: 'x'.repeat(40) });
  const db = openProduct(':memory:');
  try {
    const store = sessions(db, config);
    let token = '';
    let options: unknown;
    const request = { signedCookies: {} } as Request;
    const response = { clearCookie() {}, cookie(name: string, value: string, settings: unknown) { expect(name).toBe('__Host-rundown'); token = value; options = settings; } } as unknown as Response;
    store.create(request, response, null, { verifier: 'test-verifier', state: 'test-state', nonce: 'test-nonce' });
    expect(options).toMatchObject({ secure: true, httpOnly: true, path: '/', sameSite: 'lax', signed: true });
    expect(options).not.toHaveProperty('domain');
    const authenticated = { signedCookies: { '__Host-rundown': token } } as unknown as Request;
    expect(store.get(authenticated)?.state).toBe('test-state');
    db.exec('UPDATE sessions SET expires_at = 0');
    expect(store.get(authenticated)).toBeUndefined();
  } finally { db.close(); }
});
