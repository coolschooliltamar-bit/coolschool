// Server side of card trading (aluma/server/worker.js) against an in-memory SQLite D1 and mocked Google APIs.
// Usage: node --no-warnings aluma/tests/worker-trade-test.mjs
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
const W = new URL('../server/', import.meta.url).pathname;
const sql = new DatabaseSync(':memory:'); sql.exec(readFileSync(W + 'schema.sql', 'utf8'));
const DB = { prepare(q) { const st = sql.prepare(q); let args = []; const o = {
  bind(...a) { args = a; return o; },
  async first() { return st.get(...args) ?? null; },
  async all() { return { results: st.all(...args) }; },
  async run() { const r = /^\s*(SELECT|INSERT[\s\S]*RETURNING)/i.test(q) ? st.all(...args) : st.run(...args); return { meta: { changes: r.changes ?? 0 } }; } }; return o; } };
// tokens: tA → sub A, tB → sub B, tC → sub C (C not in the course)
const SUBS = { tA: 'subA', tB: 'subB', tC: 'subC' };
globalThis.fetch = async (u, opt = {}) => { u = String(u);
  if (u.includes('tokeninfo')) { const t = decodeURIComponent(u.split('access_token=')[1]); return SUBS[t] ? new Response(JSON.stringify({ sub: SUBS[t], azp: '1054746371715-vpsff7knc52n61rmhgrgotf0ag3t90u2.apps.googleusercontent.com' })) : new Response('{}', { status: 400 }); }
  if (u.includes('classroom.googleapis.com')) { const t = opt.headers.Authorization.slice(7); return new Response('{}', { status: t === 'tC' ? 404 : 200 }); }
  throw new Error('unexpected fetch ' + u); };
const worker = (await import(W + 'worker.js')).default;
const env = { DB, GEMINI_API_KEY: 'k' };
const call = async (tok, method, path, body) => { const r = await worker.fetch(new Request('https://w' + path, { method, headers: { Origin: 'https://coolschooliltamar-bit.github.io', Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }), env); return { s: r.status, j: await r.json() }; };
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const C = 'course1';
await call('tA', 'POST', '/game/share', { courseId: C, profile: { first: 'Noa', level: 2, cards: [41, 42, 900, 1000], badges: [] } });
await call('tB', 'POST', '/game/share', { courseId: C, profile: { first: 'Yoav', level: 1, cards: [50, 60], badges: [] } });
const cl = await call('tA', 'GET', `/game/class/${C}`);
const bHandle = cl.j.members.find(m => !m.me).handle;
ok(cl.s === 200 && cl.j.members.length === 2 && /^[0-9a-f]{16}$/.test(bHandle) && !JSON.stringify(cl.j).includes('subB'), 'class list gives a handle, never the Google id');
ok(cl.j.members.find(m => m.me).cards.includes(1000), 'card ids up to 1000 are kept');
let r = await call('tA', 'POST', '/game/trade', { courseId: C, to: bHandle, give: [41], want: [50] });
ok(r.s === 200 && r.j.id, 'offer created');
const id = r.j.id;
ok((await call('tA', 'POST', '/game/trade', { courseId: C, to: bHandle, give: [77], want: [50] })).s === 409, 'cannot offer a card not in your shared collection');
ok((await call('tA', 'POST', '/game/trade', { courseId: C, to: bHandle, give: [41], want: [99] })).s === 409, 'cannot ask for a card they do not have');
ok((await call('tA', 'POST', '/game/trade', { courseId: C, to: bHandle, give: [41, 42, 900, 1000], want: [50] })).s === 400, 'max 3 cards a side');
ok((await call('tA', 'POST', '/game/trade', { courseId: C, to: 'ffffffffffffffff', give: [41], want: [50] })).s === 404, 'unknown handle refused');
ok((await call('tC', 'GET', `/game/trades/${C}`)).s === 403, 'a non-member cannot read the course trades');
ok((await call('tC', 'POST', '/game/trade', { courseId: C, to: bHandle, give: [41], want: [50] })).s === 403, 'a non-member cannot offer');
const lb = await call('tB', 'GET', `/game/trades/${C}`);
ok(lb.j.trades.length === 1 && lb.j.trades[0].dir === 'in' && lb.j.trades[0].other === 'Noa', 'recipient sees the incoming offer');
ok((await call('tA', 'POST', `/game/trade/${id}`, { courseId: C, action: 'accept' })).s === 409, 'the sender cannot accept their own offer');
ok((await call('tB', 'POST', `/game/trade/${id}`, { courseId: C, action: 'cancel' })).s === 409, 'the recipient cannot cancel');
ok((await call('tB', 'POST', `/game/trade/${id}`, { courseId: C, action: 'accept' })).j.status === 'accepted', 'recipient accepts');
ok((await call('tB', 'POST', `/game/trade/${id}`, { courseId: C, action: 'decline' })).s === 409, 'an answered offer cannot change');
ok((await call('tA', 'GET', `/game/trades/${C}`)).j.trades[0].status === 'accepted', 'sender sees it accepted');
for (let i = 0; i < 5; i++) await call('tA', 'POST', '/game/trade', { courseId: C, to: bHandle, give: [42], want: [60] });
ok((await call('tA', 'POST', '/game/trade', { courseId: C, to: bHandle, give: [42], want: [60] })).s === 429, 'max 5 open offers');
sql.exec("UPDATE card_trades SET created_at = '2000-01-01T00:00:00Z' WHERE status = 'pending'");
await call('tA', 'GET', `/game/trades/${C}`);
ok(sql.prepare("SELECT COUNT(*) n FROM card_trades WHERE status='expired'").get().n === 5, 'pending offers older than 7 days are expired');
ok((await call('tA', 'GET', '/health')).s === 200, 'health ok');
console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
