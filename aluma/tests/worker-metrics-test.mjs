// Pilot metrics on the server (aluma/server/worker.js): daily counters only – no Google id, IP or text is stored,
// and an active user is a hash that changes every day. Usage: node --no-warnings aluma/tests/worker-metrics-test.mjs
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
globalThis.fetch = async u => { u = String(u);
  if (u.includes('tokeninfo')) return u.includes('tA') ? new Response(JSON.stringify({ sub: 'subA', azp: '1054746371715-vpsff7knc52n61rmhgrgotf0ag3t90u2.apps.googleusercontent.com' })) : new Response('{}', { status: 400 });
  throw new Error('unexpected fetch ' + u); };
const worker = (await import(W + 'worker.js')).default;
const env = { DB, GEMINI_API_KEY: 'k' };
const call = async (tok, method, path, body, ip = '1.2.3.4') => { const h = { Origin: 'https://coolschooliltamar-bit.github.io', 'Content-Type': 'application/json', 'CF-Connecting-IP': ip }; if (tok) h.Authorization = 'Bearer ' + tok;
  const r = await worker.fetch(new Request('https://w' + path, { method, headers: h, body: body ? JSON.stringify(body) : undefined }), env); return { s: r.status, j: await r.json() }; };
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };

ok((await call(null, 'POST', '/metrics/event', { e: 'question_fast' })).j.counted, 'a demo visitor event is counted');
await call(null, 'POST', '/metrics/event', { e: 'question_fast' });
await call(null, 'POST', '/metrics/event', { e: 'question_ai' }, '5.6.7.8');
await call('tA', 'POST', '/metrics/event', { e: 'lesson_done' });
await call('tA', 'POST', '/metrics/event', { e: 'visit' });
ok((await call(null, 'POST', '/metrics/event', { e: 'my name is Dana' })).s === 400, 'unknown events are refused');
const m = (await call(null, 'GET', '/metrics?days=7')).j;
const ev = (e, mode) => (m.events.find(x => x.event === e && x.mode === mode) || {}).count || 0;
ok(ev('question_fast', 'demo') === 2 && ev('question_ai', 'demo') === 1 && ev('lesson_done', 'live') === 1, 'daily counters per event and mode');
const users = mode => (m.users.find(x => x.mode === mode) || {}).n || 0;
ok(users('demo') === 2 && users('live') === 1, 'active users per day: 2 demo networks, 1 Google account');
const dump = JSON.stringify(sql.prepare('SELECT * FROM metrics').all()) + JSON.stringify(sql.prepare('SELECT * FROM metrics_users').all());
ok(!/subA|1\.2\.3\.4|5\.6\.7\.8/.test(dump), 'nothing stored can identify a person (no Google id, no IP)');
const day = new Date().toISOString().slice(0, 10);
ok(sql.prepare('SELECT uh FROM metrics_users WHERE mode = ?').all('live').every(r => /^[0-9a-f]{20}$/.test(r.uh)), 'a user is only a short daily hash');
console.log(fails ? `${fails} FAILED` : 'ALL PASSED'); process.exit(fails ? 1 : 0);
