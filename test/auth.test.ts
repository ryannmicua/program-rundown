import { expect, it } from 'vitest';
import { fixture } from './support.js';

it('verifies real OIDC code exchange, rejects forged state and replay, grants only the mapped tester, and logs out', async () => {
  const f = await fixture();
  try {
    expect((await fetch(`${f.origin}/api/programs`)).status).toBe(401);
    const start = await fetch(`${f.origin}/auth/login`, { redirect: 'manual' });
    const cookie = start.headers.getSetCookie().at(-1)!.split(';')[0];
    expect(start.headers.get('set-cookie')).toContain('HttpOnly'); expect(start.headers.get('set-cookie')).toContain('SameSite=Lax');
    const authorization = new URL(start.headers.get('location')!);
    expect(authorization.searchParams.get('code_challenge_method')).toBe('S256');
    const redirect = await fetch(authorization, { redirect: 'manual' });
    const callback = new URL(redirect.headers.get('location')!);
    const bad = new URL(callback); bad.searchParams.set('state', 'forged');
    expect((await fetch(bad, { headers: { cookie }, redirect: 'manual' })).status).toBe(400);
    expect((await fetch(callback, { headers: { cookie }, redirect: 'manual' })).status).toBe(400);
    const tester = await f.signIn();
    expect((await (await fetch(`${f.origin}/api/session`, { headers: { cookie: tester } })).json()).user.coordinator).toBe(true);
    expect((await (await fetch(`${f.origin}/api/programs`, { headers: { cookie: tester } })).json()).programs).toEqual([]);
    f.issuer.setSubject('unmapped-placeholder');
    const other = await f.signIn();
    expect((await fetch(`${f.origin}/api/feedback`, { headers: { cookie: other } })).status).toBe(403);
    expect((await fetch(`${f.origin}/api/programs`, { headers: { cookie: other } })).status).toBe(403);
    expect((await fetch(`${f.origin}/auth/logout`, { method: 'POST', headers: { cookie: tester, origin: f.origin, 'content-type': 'application/json' }, body: '{}' })).status).toBe(204);
    expect((await fetch(`${f.origin}/api/programs`, { headers: { cookie: tester } })).status).toBe(401);
  } finally { await f.close(); }
});
