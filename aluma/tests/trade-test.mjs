// Card trading, client side: demo trades in the browser store, and the Google-account flow (escrow, apply once,
// refunds) against the real worker code with an in-memory D1. Usage: node --no-warnings aluma/tests/trade-test.mjs
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.sessionStorage = globalThis.localStorage;
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
const T = await import('../js/trade.js');
const Game = await import('../js/game.js');
const { db } = await import('../js/store.js');
const { buildContext } = await import('../js/auth.js');
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const own = id => [...(Game.state(id).owned || [])].sort((a, b) => a - b).join(',');

// ---------- demo ----------
const noa = buildContext('u-noa');
Game.state('u-noa').owned = [41, 41, 45, 80]; Game.state('u-noa').share = true;
const mates = T.classmatesForTrade(noa);
ok(mates.length > 0, `${mates.length} classmates share (demo)`);
const mate = mates.find(m => m.cards.length);
const want = mate.cards[0];
let err = ''; try { T.offer(noa, mate.id, [999], [want]); } catch (e) { err = e.message; } ok(/כבר לא באוסף/.test(err), 'cannot offer a card you do not have');
err = ''; try { T.offer(noa, mate.id, [41, 45, 80, 99], [want]); } catch (e) { err = e.message; } ok(/עד 3/.test(err), 'max 3 a side');
const t = T.offer(noa, mate.id, [41], [want]);
ok(own('u-noa') === '41,45,80', 'escrow: the offered copy is put aside');
T.respond(noa, t.id, 'cancel'); ok(own('u-noa') === '41,41,45,80' && t.status === 'cancelled', 'cancel returns the card');
Game.state('u-noa').share = false; try { T.offer(noa, mate.id, [41], [want]); } catch (e) { err = e.message; } ok(/לשתף/.test(err), 'must share to trade'); Game.state('u-noa').share = true;
const t2 = T.offer(noa, mate.id, [80], [want]);           // a legendary-ish offer → fair for the classmate
T.demoTick(noa, Date.now() + 5000);
ok(t2.status === 'accepted' && Game.state('u-noa').owned.includes(want) && !Game.state('u-noa').owned.includes(80) && Game.state(mate.id).owned.includes(80), `demo classmate accepted a generous offer (${t2.status})`);
ok(T.fairness([41], [80]).verdict === 'you-give-more' === false && T.fairness([80], [41]).verdict === 'you-give-more', 'fairness: giving a legendary for a common is flagged');

// ---------- Google accounts against the real worker ----------
const sql = new DatabaseSync(':memory:'); sql.exec(readFileSync(new URL('../server/schema.sql', import.meta.url), 'utf8'));
const DB = { prepare(q) { const st = sql.prepare(q); let a = []; const o = { bind(...x) { a = x; return o; }, async first() { return st.get(...a) ?? null; }, async all() { return { results: st.all(...a) }; },
  async run() { const r = /^\s*(SELECT|INSERT[\s\S]*RETURNING)/i.test(q) ? st.all(...a) : st.run(...a); return { meta: { changes: r.changes ?? 0 } }; } }; return o; } };
const SUBS = { tA: 'subA', tB: 'subB' };
globalThis.fetch = async (u, opt = {}) => { u = String(u);
  if (u.includes('tokeninfo')) { const t = decodeURIComponent(u.split('access_token=')[1]); return new Response(JSON.stringify({ sub: SUBS[t], azp: '1054746371715-vpsff7knc52n61rmhgrgotf0ag3t90u2.apps.googleusercontent.com' })); }
  if (u.includes('classroom.googleapis.com')) return new Response('{}');
  throw new Error('unexpected ' + u); };
const worker = (await import('../server/worker.js')).default; const env = { DB, GEMINI_API_KEY: 'k' };
const call = async (tok, method, path, body) => { const r = await worker.fetch(new Request('https://w' + path, { method, headers: { Origin: 'https://coolschooliltamar-bit.github.io', Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }), env); const j = await r.json(); if (!r.ok) throw new Error(j.error.message); return j; };
const api = tok => ({ tradeOffer: (c, to, give, want) => call(tok, 'POST', '/game/trade', { courseId: c, to, give, want }), tradeAct: (c, id, action) => call(tok, 'POST', `/game/trade/${id}`, { courseId: c, action }), tradeList: async c => (await call(tok, 'GET', `/game/trades/${c}`)).trades });
const A = { userId: 'g-A', live: true, role: 'student' }, B = { userId: 'g-B', live: true, role: 'student' }, C = 'c1';
Object.assign(Game.state('g-A'), { owned: [100, 200, 200], share: true }); Object.assign(Game.state('g-B'), { owned: [300, 400], share: true });
await call('tA', 'POST', '/game/share', { courseId: C, profile: { first: 'A', level: 1, cards: [100, 200], badges: [] } });
await call('tB', 'POST', '/game/share', { courseId: C, profile: { first: 'B', level: 1, cards: [300, 400], badges: [] } });
const hB = (await call('tA', 'GET', `/game/class/${C}`)).members.find(m => !m.me).handle;
const o1 = await T.liveOffer(A, C, hB, [200], [300], api('tA'));
ok(own('g-A') === '100,200', 'live: offered copy put aside');
let lb = await T.liveSync(B, C, api('tB'));
ok(lb.incoming.length === 1, 'live: B sees the offer');
await T.liveRespond(B, C, o1.id, 'accept', lb.incoming[0], api('tB'));
ok(own('g-B') === '200,400', 'live: B gave 300 and got 200');
await T.liveSync(A, C, api('tA')); ok(own('g-A') === '100,200,300', 'live: A got 300 after syncing');
await T.liveSync(A, C, api('tA')); await T.liveSync(B, C, api('tB'));
ok(own('g-A') === '100,200,300' && own('g-B') === '200,400', 'live: syncing again changes nothing (applied once)');
const o2 = await T.liveOffer(A, C, hB, [100], [400], api('tA'));
ok(own('g-A') === '200,300', 'live: second offer escrowed');
await T.liveRespond(B, C, o2.id, 'decline', { want: [400] }, api('tB'));
await T.liveSync(A, C, api('tA')); ok(own('g-A') === '100,200,300', 'live: declined → the card comes back');
const o3 = await T.liveOffer(A, C, hB, [100], [400], api('tA'));
await T.liveRespond(A, C, o3.id, 'cancel', {}, api('tA')); ok(own('g-A') === '100,200,300', 'live: cancelled → the card comes back');
console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exitCode = fails ? 1 : 0;
