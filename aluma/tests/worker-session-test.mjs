// Staying signed in (aluma/server/worker.js /auth/*): a Google code becomes a session; the refresh token is stored
// encrypted, the session id only as a hash; refresh gives a new access token; logout / revoke end it.
// Usage: node --no-warnings aluma/tests/worker-session-test.mjs
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
const W = new URL('../server/', import.meta.url).pathname;
const sql = new DatabaseSync(':memory:'); sql.exec(readFileSync(W + 'schema.sql', 'utf8'));
const stmt = q => { const st = sql.prepare(q); let args = []; const o = {
  bind(...a) { args = a; return o; },
  async first() { return st.get(...args) ?? null; },
  async all() { return { results: st.all(...args) }; },
  async run() { const r = /^\s*(SELECT|INSERT[\s\S]*RETURNING)/i.test(q) ? st.all(...args) : st.run(...args); return { meta: { changes: r.changes ?? 0 } }; } }; return o; };
const DB = { prepare: stmt, async batch(list) { for (const s of list) await s.run(); } };
const CID = '1054746371715-vpsff7knc52n61rmhgrgotf0ag3t90u2.apps.googleusercontent.com';
let revoked = [], rtValid = true, n = 0;
globalThis.fetch = async (u, o = {}) => { u = String(u); const form = o.body instanceof URLSearchParams ? Object.fromEntries(o.body) : {};
  if (u.includes('tokeninfo')) return new Response(JSON.stringify({ sub: 'subA', azp: CID, expires_in: 3599 }));
  if (u.endsWith('/token')) {
    if (form.client_secret !== 'S3CRET') return new Response(JSON.stringify({ error: 'invalid_client' }), { status: 401 });
    if (form.grant_type === 'authorization_code') return form.code === 'bad' ? new Response('{"error":"invalid_grant"}', { status: 400 })
      : new Response(JSON.stringify({ access_token: 'at' + (++n), expires_in: 3599, scope: 'openid email', ...(form.code === 'withRT' ? { refresh_token: 'RT-SECRET-1' } : {}) }));
    if (form.grant_type === 'refresh_token') return rtValid && form.refresh_token === 'RT-SECRET-1' ? new Response(JSON.stringify({ access_token: 'at' + (++n), expires_in: 3599 })) : new Response('{"error":"invalid_grant"}', { status: 400 });
  }
  if (u.includes('tokeninfo')) return new Response(JSON.stringify({ sub: 'subA', azp: CID, expires_in: 3599 }));
  if (u.includes('/revoke')) { revoked.push(form.token); return new Response('{}'); }
  throw new Error('unexpected fetch ' + u); };
const worker = (await import(W + 'worker.js')).default;
let env = { DB, GEMINI_API_KEY: 'k' };
const call = async (path, body) => { const r = await worker.fetch(new Request('https://w' + path, { method: 'POST', headers: { Origin: 'https://coolschooliltamar-bit.github.io', 'Content-Type': 'application/json', 'CF-Connecting-IP': '1.1.1.1' }, body: JSON.stringify(body) }), env); return { s: r.status, j: await r.json() }; };
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };

ok((await call('/auth/exchange', { code: 'withRT' })).s === 503, 'without the GOOGLE_CLIENT_SECRET secret the server says it is not set up');
env = { ...env, GOOGLE_CLIENT_SECRET: 'S3CRET' };
const h = await worker.fetch(new Request('https://w/health'), env); ok((await h.json()).stay === true, '/health tells the site that staying signed in is available');
const a = (await call('/auth/exchange', { code: 'withRT' })).j;
ok(a.session && a.session.length === 64 && a.access_token, 'a code becomes a session and an access token');
const row = sql.prepare('SELECT * FROM sessions').get(), g = sql.prepare('SELECT * FROM google_grants').get();
ok(row && g && !g.rt.includes('RT-SECRET') && row.id !== a.session && row.sub === 'subA', 'the refresh token is stored encrypted and the session id only as a hash');
const r1 = await call('/auth/refresh', { session: a.session });
ok(r1.s === 200 && r1.j.access_token && r1.j.access_token !== a.access_token, 'refresh gives a new access token');
ok((await call('/auth/refresh', { session: 'x'.repeat(64) })).s === 401, 'an unknown session is refused');
ok((await call('/auth/exchange', { code: 'bad' })).s === 401, 'a bad code is refused');
// a second device: Google sends no refresh token again – the user's stored one is reused
const b = (await call('/auth/exchange', { code: 'noRT' })).j;
ok(b.session && b.session !== a.session && (await call('/auth/refresh', { session: b.session })).s === 200, 'a second device gets its own session (reusing the stored refresh token)');
ok((await call('/auth/logout', { session: b.session })).j.ok && (await call('/auth/refresh', { session: b.session })).s === 401 && (await call('/auth/refresh', { session: a.session })).s === 200, 'logout ends only that device');
// upgrading the session (a new Google service connected) replaces it
const c = (await call('/auth/exchange', { code: 'withRT', session: a.session })).j;
ok(c.session && (await call('/auth/refresh', { session: a.session })).s === 401 && (await call('/auth/refresh', { session: c.session })).s === 200, 'connecting a service replaces the old session');
// sessions expire after 30 days without use – but the user's grant stays, so signing in again on that device just works
sql.prepare("UPDATE sessions SET expires = '2000-01-01'").run();
ok((await call('/auth/refresh', { session: c.session })).s === 401, 'a session unused for 30 days has ended');
ok((await call('/auth/exchange', { code: 'noRT' })).j.session, 'after a session expired, signing in again starts a new one without a new consent');
// access removed at Google → the session ends
const d = (await call('/auth/exchange', { code: 'withRT' })).j; rtValid = false;
ok((await call('/auth/refresh', { session: d.session })).s === 401 && !sql.prepare('SELECT 1 FROM sessions WHERE sub = ?').get('subA') && !sql.prepare('SELECT 1 FROM google_grants').get(), 'when Google access is removed, the sessions are deleted');
rtValid = true; const e = (await call('/auth/exchange', { code: 'withRT' })).j;
await call('/auth/logout', { session: e.session, revoke: true });
ok(revoked.includes('RT-SECRET-1') && !sql.prepare('SELECT 1 FROM sessions').get() && !sql.prepare('SELECT 1 FROM google_grants').get(), '"disconnect all" revokes at Google and signs out every device');
// a first-time user without consent for offline access
sql.exec('DELETE FROM sessions; DELETE FROM google_grants'); const f = (await call('/auth/exchange', { code: 'noRT' })).j;
ok(f.session === null && f.need_consent && f.access_token, 'without a refresh token the site is told to ask for consent');
const bad = await worker.fetch(new Request('https://w/auth/exchange', { method: 'POST', headers: { Origin: 'https://evil.example' }, body: '{}' }), env);
ok(bad.status === 403, 'other sites cannot use the auth routes');
console.log(fails ? `${fails} FAILED` : 'ALL PASSED'); process.exit(fails ? 1 : 0);
