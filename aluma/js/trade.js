// Card trading between classmates.
// Rules (shown to the student): only with classmates who share their collection with the class, only cards
// (no XP, no points, nothing bought), up to 3 cards on each side, up to 5 open offers, an offer can be
// cancelled until it is accepted and expires after 7 days. The cards you offer are put aside ("escrow")
// until the other side answers, so the same card can't be promised twice. Aluma warns when a trade is
// not fair (by rarity), so younger students aren't talked into bad trades.
// Demo accounts: everything stays in the browser; demo classmates answer by a simple fairness rule.
// Google accounts: offers go through Aluma's server (/game/trade…), between members of one Classroom course.
import { db, save, audit } from './store.js';
import * as Game from './game.js';
import { cardById, RARITY } from './cards.js';
import { STUDENTS } from './data.js';
import * as Cloud from './cloud.js';

export const MAX_SIDE = 3, MAX_OPEN = 5, EXPIRE_DAYS = 7;
export const VALUE = { common: 1, uncommon: 2, rare: 4, epic: 8, legendary: 20 };
export const value = ids => ids.reduce((a, id) => a + (VALUE[(cardById(id) || {}).rarity] || 0), 0);
// how fair is it for ME: what I give vs. what I get
export function fairness(give, want) {
  const g = value(give), w = value(want);
  const verdict = !g || !w ? 'empty' : g > w * 1.6 ? 'you-give-more' : w > g * 1.6 ? 'you-get-more' : 'fair';
  return { g, w, verdict };
}
export const FAIR_TEXT = { fair: 'החלפה הוגנת', 'you-give-more': 'את/ה נותן/ת הרבה יותר ממה שמקבל/ת', 'you-get-more': 'את/ה מקבל/ת יותר ממה שנותן/ת', empty: '' };

// ---------- the collection: take / add cards (one copy per id occurrence) ----------
const owned = uid => (Game.state(uid).owned = Game.state(uid).owned || []);
export function hasAll(uid, ids) { const left = [...owned(uid)]; return ids.every(id => { const i = left.indexOf(+id); if (i < 0) return false; left.splice(i, 1); return true; }); }
function take(uid, ids) { const o = owned(uid); for (const id of ids) { const i = o.lastIndexOf(+id); if (i >= 0) o.splice(i, 1); } }
function add(uid, ids) { owned(uid).push(...ids.map(Number)); }
function check(give, want) {
  give = [...new Set(give.map(Number))]; want = [...new Set(want.map(Number))];
  if (!give.length || !want.length) throw new Error('בחרו לפחות קלף אחד לתת וקלף אחד לקבל.');
  if (give.length > MAX_SIDE || want.length > MAX_SIDE) throw new Error(`אפשר עד ${MAX_SIDE} קלפים בכל צד.`);
  if (![...give, ...want].every(id => cardById(id))) throw new Error('קלף לא מוכר.');
  return { give, want };
}

// ---------- demo (local) ----------
const trades = () => (db().trades = db().trades || []);
const expired = t => t.status === 'pending' && Date.now() - new Date(t.at).getTime() > EXPIRE_DAYS * 864e5;
const isDemoMate = id => /^u-s-/.test(id);
export function classmatesForTrade(ctx) { return Game.classmates(ctx).filter(m => m.share); }
export function offer(ctx, to, giveIds, wantIds) {
  const { give, want } = check(giveIds, wantIds);
  const me = ctx.userId;
  if (!Game.state(me).share) throw new Error('כדי להחליף קלפים צריך קודם לשתף את האוסף עם הכיתה.');
  const mate = classmatesForTrade(ctx).find(m => m.id === to); if (!mate) throw new Error('אפשר להחליף רק עם חברים מהכיתה ששיתפו את האוסף.');
  if (trades().filter(t => t.from === me && t.status === 'pending' && !expired(t)).length >= MAX_OPEN) throw new Error(`יש לך כבר ${MAX_OPEN} הצעות פתוחות. חכו לתשובה או בטלו אחת.`);
  if (!hasAll(me, give)) throw new Error('אחד הקלפים שבחרת כבר לא באוסף שלך.');
  if (!hasAll(to, want)) throw new Error('אחד הקלפים שביקשת כבר לא אצל החבר/ה.');
  take(me, give);                                                  // escrow
  const t = { id: 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), from: me, to, give, want, status: 'pending', at: new Date().toISOString() };
  trades().push(t); save(); audit(me, 'trade_offer', {});
  return t;
}
export function respond(ctx, id, action) {
  const t = trades().find(x => x.id === id); if (!t) throw new Error('ההצעה לא נמצאה.');
  if (t.status !== 'pending' || expired(t)) throw new Error('ההצעה כבר לא פתוחה.');
  const me = ctx.userId;
  if (action === 'cancel') { if (t.from !== me) throw new Error('רק מי ששלח/ה יכול/ה לבטל.'); add(t.from, t.give); t.status = 'cancelled'; }
  else if (action === 'decline') { if (t.to !== me) throw new Error('רק מי שקיבל/ה את ההצעה יכול/ה לסרב.'); add(t.from, t.give); t.status = 'declined'; }
  else if (action === 'accept') {
    if (t.to !== me) throw new Error('רק מי שקיבל/ה את ההצעה יכול/ה לאשר.');
    if (!hasAll(me, t.want)) throw new Error('כבר אין לך את כל הקלפים שביקשו ממך.');
    take(me, t.want); add(me, t.give); add(t.from, t.want); t.status = 'accepted';
  } else throw new Error('פעולה לא מוכרת');
  t.doneAt = new Date().toISOString(); save(); audit(me, `trade_${action}`, {});
  return t;
}
function settleExpired() { let ch = false; for (const t of trades()) if (expired(t)) { add(t.from, t.give); t.status = 'expired'; t.doneAt = new Date().toISOString(); ch = true; } if (ch) save(); }
export function myTrades(ctx) {
  settleExpired();
  const me = ctx.userId, mine = trades().filter(t => t.from === me || t.to === me).sort((a, b) => b.at.localeCompare(a.at));
  const name = id => (classmatesForTrade(ctx).find(m => m.id === id) || {}).first || (STUDENTS.find(s => s.id === id) || {}).name || 'חבר/ה';
  const view = t => ({ ...t, dir: t.from === me ? 'out' : 'in', other: name(t.from === me ? t.to : t.from) });
  return { incoming: mine.filter(t => t.to === me && t.status === 'pending').map(view), outgoing: mine.filter(t => t.from === me && t.status === 'pending').map(view), history: mine.filter(t => t.status !== 'pending').slice(0, 12).map(view) };
}
// demo classmates: answer offers after a few seconds (fair → yes), and sometimes offer a trade themselves
export function demoTick(ctx, now = Date.now()) {
  let changed = false;
  for (const t of trades()) {
    if (t.status !== 'pending' || !isDemoMate(t.to) || t.from !== ctx.userId || now - new Date(t.at).getTime() < 3000) continue;
    const { g, w } = fairness(t.give, t.want);            // from the classmate's side: gets t.give, gives t.want
    const ok = hasAll(t.to, t.want) && g >= w * 0.75;
    if (ok) { take(t.to, t.want); add(t.to, t.give); add(t.from, t.want); t.status = 'accepted'; }
    else { add(t.from, t.give); t.status = 'declined'; t.note = hasAll(t.to, t.want) ? 'not_fair' : 'gone'; }
    t.doneAt = new Date(now).toISOString(); changed = true;
  }
  const st = Game.state(ctx.userId);
  if (st.share && !st.demoOffered && owned(ctx.userId).length >= 3) {
    // one classmate offers a fair trade for a card Noa has twice (or any card)
    const mates = classmatesForTrade(ctx).filter(m => m.cards.length);
    const counts = Game.counts(ctx.userId);
    const wantId = +(Object.keys(counts).find(id => counts[id] > 1) || owned(ctx.userId)[0]);
    const mate = mates.find(m => m.cards.some(id => !counts[id] && Math.abs(value([id]) - value([wantId])) <= 1));
    if (mate && wantId) {
      const giveId = mate.cards.find(id => !counts[id] && Math.abs(value([id]) - value([wantId])) <= 1);
      take(mate.id, [giveId]);
      trades().push({ id: 't' + now.toString(36) + 'd', from: mate.id, to: ctx.userId, give: [giveId], want: [wantId], status: 'pending', at: new Date(now).toISOString() });
      st.demoOffered = true; changed = true;
    }
  }
  if (changed) save();
  return changed;
}

// ---------- Google accounts (through the server) ----------
// The server keeps the offers; each side applies the result to its own collection exactly once
// (state.tradeApplied), so a trade is never applied twice even if a page is refreshed mid-way.
export async function liveOffer(ctx, courseId, toHandle, giveIds, wantIds, api = Cloud) {
  const { give, want } = check(giveIds, wantIds);
  const st = Game.state(ctx.userId);
  if (!st.share) throw new Error('כדי להחליף קלפים צריך קודם לשתף את האוסף עם הכיתה.');
  if (!hasAll(ctx.userId, give)) throw new Error('אחד הקלפים שבחרת כבר לא באוסף שלך.');
  const r = await api.tradeOffer(courseId, toHandle, give, want);
  take(ctx.userId, give); st.escrow = { ...(st.escrow || {}), [r.id]: give }; save(); audit(ctx.userId, 'trade_offer', {});
  return r;
}
export async function liveRespond(ctx, courseId, id, action, t, api = Cloud) {
  if (action === 'accept' && !hasAll(ctx.userId, t.want)) throw new Error('כבר אין לך את כל הקלפים שביקשו ממך.');
  await api.tradeAct(courseId, id, action);
  return liveSync(ctx, courseId, api);
}
export async function liveSync(ctx, courseId, api = Cloud) {
  const list = await api.tradeList(courseId); if (!list) return null;
  const st = Game.state(ctx.userId); const applied = new Set(st.tradeApplied || []); const esc = st.escrow || {};
  let ch = false;
  for (const t of list) {
    if (t.status === 'pending' || applied.has(t.id)) continue;
    if (t.dir === 'out') {
      if (t.status === 'accepted') add(ctx.userId, t.want);
      else add(ctx.userId, esc[t.id] || t.give);                        // declined / cancelled / expired → the cards come back
    } else if (t.status === 'accepted') { take(ctx.userId, t.want); add(ctx.userId, t.give); }
    applied.add(t.id); delete esc[t.id]; ch = true;
  }
  if (ch) { st.tradeApplied = [...applied].slice(-300); st.escrow = esc; save(); }
  return { incoming: list.filter(t => t.dir === 'in' && t.status === 'pending'), outgoing: list.filter(t => t.dir === 'out' && t.status === 'pending'), history: list.filter(t => t.status !== 'pending').slice(0, 12) };
}
export const rarityName = id => RARITY[(cardById(id) || {}).rarity].he;
