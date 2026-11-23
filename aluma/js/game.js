// Gamification (spec א). XP is a MEASURE of learning effort – not the goal:
//   40% submissions (on time and well done) · 20% exam grades · 40% Aluma's learning tools.
// The weights are the maximum each source can give in a semester (400 / 200 / 400 = 1,000 XP),
// so no single source can carry the whole score. Every rule is shown to the student.
// Rewards: every 100 XP earns a card box. The odds inside a box are fixed and always shown
// (50 / 25 / 15 / 7.5 / 2.5 %, the same as each rarity's share of the collection). Boxes are earned by
// learning only – no money, nothing to buy, no countdowns, boxes never expire. Duplicates happen:
// 4 copies of one card can be combined into a new box (3 copies go, 1 stays).
import { db, save } from './store.js';
import * as T from './tools.js';
import * as L from './learn.js';
import { CARDS, RARITY, cardById } from './cards.js';
import { STUDENTS, CLASSES, NOW } from './data.js';
import { buildContext } from './auth.js';

export const CAPS = { submissions: 400, exams: 200, learning: 400 };
export const SEMESTER_MAX = CAPS.submissions + CAPS.exams + CAPS.learning;
export const RULES = {
  onTime: 30, late: 12, quality85: 10, quality70: 5,      // per assignment
  examMax: 10, quizMax: 5, improve: 10,                    // per exam / quiz (score% × max), +10 for improving by 5+
};
export const LEVELS = ['ניצוץ', 'גחלת', 'להבה', 'קרן', 'זוהר', 'שביט', 'כוכב', 'מזל', 'גלקסיה', 'אלומה', 'אלומה ✦'];
export const levelOf = xp => Math.min(LEVELS.length - 1, Math.floor(xp / 100));

export const ACHIEVEMENTS = {
  first_lesson: { name: 'צעד ראשון', desc: 'סיימת שיעור תרגול ראשון', sticker: '👣' },
  ontime3: { name: 'תמיד בזמן', desc: '3 הגשות בזמן', sticker: '⏰' },
  exam85: { name: 'מבחן מצוין', desc: 'ציון 85 ומעלה במבחן', sticker: '🏅' },
  improver: { name: 'בעלייה', desc: 'שיפור של 5 נקודות ומעלה במבחן באותו מקצוע', sticker: '📈' },
  unit_done: { name: 'יחידה שלמה', desc: 'סיימת יחידה שלמה במסלול', sticker: '🧩' },
  streak3: { name: 'רצף של 3', desc: 'תרגול 3 ימים ברצף', sticker: '🔥' },
  cards30: { name: 'זיכרון של פיל', desc: '30 חזרות בכרטיסיות זיכרון', sticker: '🐘' },
  project_sent: { name: 'יוזמה', desc: 'שלחת למורה הצעה לפרויקט אישי', sticker: '💡' },
  project_done: { name: 'פרויקט אישי', desc: 'פרויקט אישי הוגש וקיבל ניקוד', sticker: '🎓' },
  team_week: { name: 'רוח צוות', desc: 'הכיתה עמדה באתגר השבועי', sticker: '🤝' },
};
export const achName = id => (ACHIEVEMENTS[id] || {}).name || id;

const pct = g => (g.max ? (g.score / g.max) * 100 : g.score);

// ---------- the score: computed from the platforms, always explainable ----------
export function score(ctx, sid) {
  const asg = T.getAssignments(ctx, { studentId: sid, quiet: true }).data;
  const grades = T.getGrades(ctx, { studentId: sid, quiet: true }).data;
  let sub = 0, onTime = 0, late = 0, missing = 0, quality = 0;
  for (const a of asg) {
    if (a.status === 'submitted') { if (a.late) { sub += RULES.late; late++; } else { sub += RULES.onTime; onTime++; } }
    else if (a.due && new Date(a.due) < NOW) missing++;
  }
  for (const g of grades.filter(g => g.type === 'assignment')) { const q = pct(g) >= 85 ? RULES.quality85 : pct(g) >= 70 ? RULES.quality70 : 0; sub += q; quality += q; }
  let ex = 0, improved = false, best = 0, examsN = 0;
  const bySub = {};
  for (const g of grades.filter(g => g.type === 'exam' || g.type === 'quiz').sort((a, b) => new Date(a.date) - new Date(b.date))) {
    examsN++; best = Math.max(best, g.type === 'exam' ? pct(g) : 0);
    ex += Math.round((pct(g) / 100) * (g.type === 'exam' ? RULES.examMax : RULES.quizMax));
    const prev = bySub[g.subject];
    if (prev != null && pct(g) >= prev + 5) { ex += RULES.improve; improved = true; }
    bySub[g.subject] = pct(g);
  }
  const p = L.progress(sid);
  const parts = { submissions: Math.min(CAPS.submissions, sub), exams: Math.min(CAPS.exams, ex), learning: Math.min(CAPS.learning, p.xp) };
  const xp = parts.submissions + parts.exams + parts.learning;
  const st = state(sid);
  const unitDone = Object.keys(p.done).some(k => { const m = k.match(/^([a-z]+):(\d+):\d$/); return m && L.unitState(sid, m[1], +m[2]).every(Boolean); }) || Object.keys(p.done).some(k => { const m = k.match(/^P:([^:]+):(\d+)$/); const path = m && L.getPath(m[1]); return path ? L.pathUnitDone(sid, path, +m[2]) : !!m; });
  const ach = {
    first_lesson: Object.keys(p.done).length > 0 || p.week.lessons > 0,
    ontime3: onTime >= 3, exam85: best >= 85, improver: improved, unit_done: unitDone,
    streak3: p.streak >= 3, cards30: p.reviews >= 30,
    project_sent: (db().projects || []).some(x => x.studentId === sid && x.status !== 'draft'), project_done: (db().projects || []).some(x => x.studentId === sid && x.status === 'graded'), team_week: !!st.teamWeek,
  };
  return { xp, parts, level: levelOf(xp), facts: { onTime, late, missing, quality, examsN, lessons: Object.keys(p.done).length, reviews: p.reviews, streak: p.streak, today: p.xpDay.day === new Date().toDateString() ? p.xpDay.n : 0 }, ach };
}

// ---------- card boxes ----------
export const BOX_EVERY = 100;
export const ODDS = Object.fromEntries(Object.entries(RARITY).map(([k, r]) => [k, r.odds]));
const ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
// pure: a number in [0,1) → a rarity, by the published odds
export function drawRarity(u) {
  let acc = 0;
  for (const r of ORDER) { acc += ODDS[r] / 100; if (u < acc) return r; }
  return ORDER[ORDER.length - 1];
}
const fairRandom = () => { try { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] / 4294967296; } catch { return Math.random(); } };
// one card from a box: the rarity by the published odds, then any card of that rarity (duplicates happen)
export function pickCard(rand = fairRandom) {
  const drawn = drawRarity(rand());
  const list = CARDS.filter(c => c.rarity === drawn);
  return { card: list[Math.floor(rand() * list.length)], drawn };
}
// 4 copies of the same card → combine: 3 copies go away, 1 stays, and you get a new box
export const COMBINE_NEED = 4, COMBINE_TAKES = 3;
// boxes earned so far never go away, even if a later recalculation of XP is lower
export function boxInfo(userId, s) {
  const st = state(userId);
  const fromXp = Math.max(st.boxesEarned || 0, Math.floor(s.xp / BOX_EVERY));
  if (fromXp !== st.boxesEarned) { st.boxesEarned = fromXp; save(); }
  const bonus = st.bonusBoxes || 0, earned = fromXp + bonus;
  const opened = (st.opened || []).length;
  return { earned, fromXp, bonus, opened, ready: Math.max(0, earned - opened), toNext: BOX_EVERY - (s.xp % BOX_EVERY), complete: ownedCards(userId).length >= CARDS.length };
}
export function openBox(userId, s) {
  if (!boxInfo(userId, s).ready) throw new Error('אין תיבות לפתיחה כרגע.');
  const st = state(userId);
  const res = pickCard();
  res.copies = count(userId, res.card.id) + 1;
  res.isNew = res.copies === 1;
  st.owned = [...(st.owned || []), res.card.id];
  st.opened = [...(st.opened || []), { at: new Date().toISOString(), card: res.card.id, drawn: res.drawn }];
  save();
  return res;
}
export const count = (userId, id) => (state(userId).owned || []).filter(x => x === +id).length;
export const counts = userId => (state(userId).owned || []).reduce((a, id) => (a[id] = (a[id] || 0) + 1, a), {});
export const canCombine = userId => CARDS.filter(c => count(userId, c.id) >= COMBINE_NEED);
export function combine(userId, id) {
  id = +id;
  if (count(userId, id) < COMBINE_NEED) throw new Error(`צריך ${COMBINE_NEED} עותקים של אותו קלף כדי לשלב.`);
  const st = state(userId);
  let left = COMBINE_TAKES;
  // remove the 3 most recent copies; the first copy (and the avatar) stays
  const rev = [...st.owned].reverse().filter(x => !(x === id && left > 0 && left--));
  st.owned = rev.reverse();
  st.bonusBoxes = (st.bonusBoxes || 0) + 1;
  st.combined = [...(st.combined || []), { at: new Date().toISOString(), card: id }];
  save();
  return { card: cardById(id), copies: count(userId, id) };
}
export const ownedCards = userId => { const o = new Set(state(userId).owned || []); return CARDS.filter(c => o.has(c.id)); };
export const owns = (userId, c) => (state(userId).owned || []).includes(c.id);

// ---------- per-student game settings (kept in the browser; synced for real accounts) ----------
export function state(userId) {
  const G = (db().game = db().game || {});
  const st = (G[userId] = G[userId] || { avatar: null, share: false, race: false, projectSent: false, projectDone: false, teamWeek: false, seen: [] });
  if (userId === DEMO_COLLECTOR && !st.demoCollection) seedDemoCollection(st);
  return st;
}
// The demo student Noa starts with a big collection (all rarities, a few cards ×4 so "combine" can be tried,
// some ×2–3) – so the album, combining and trading can be shown right away. Demo accounts only.
const DEMO_COLLECTOR = 'u-noa';
function seedDemoCollection(st) {
  const R = seeded(20261123);
  const take = (rarity, n) => { const list = CARDS.filter(c => c.rarity === rarity).map(c => c.id); for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; } return list.slice(0, n); };
  const ids = [...take('common', 160), ...take('uncommon', 80), ...take('rare', 45), ...take('epic', 22), ...take('legendary', 8)];
  const four = [ids[0], ids[1], ids[160], ids[240], ids[285], ids[307]];          // common ×2, uncommon, rare, epic, legendary
  const extra = [...four.flatMap(id => [id, id, id]), ...[ids[5], ids[9], ids[170], ids[250]].flatMap(id => [id, id]), ids[12], ids[180]];
  st.owned = [...(st.owned || []), ...ids, ...extra];
  st.seen = [...new Set(st.owned)];
  st.demoCollection = true;
  save();
}
export function setState(userId, patch) { Object.assign(state(userId), patch); save(); }
export function avatarOf(userId) {
  const st = state(userId); const list = ownedCards(userId);
  return (st.avatar && list.find(c => c.id === st.avatar)) || list[list.length - 1] || null;
}
// cards received since the student last looked at the album (a small "new!" badge – never a countdown)
export function newCards(userId) { const seen = new Set(state(userId).seen); return ownedCards(userId).filter(c => !seen.has(c.id)); }
export function markSeen(userId) { setState(userId, { seen: ownedCards(userId).map(c => c.id) }); }

// ---------- classmates (demo) ----------
// Only what a classmate CHOSE to share: first name, level, avatar, cards and badges.
// Never XP numbers, grades, submissions or anything from the platforms.
// In the real product each student publishes this small profile to the server (see /game in the worker);
// in the demo the classmates' profiles are derived here from the demo data.
const shortName = n => { const [f, l] = String(n).split(' '); return l ? `${f} ${l[0]}׳` : f; };   // "יונתן ש׳" – first names repeat in a class
const seeded = seed => { let a = seed || 1; return () => { a = (a * 16807) % 2147483647; return (a - 1) / 2147483646; }; };
const hash = s => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
export function classmates(ctx) {
  if (ctx.live || ctx.role !== 'student') return [];
  const me = STUDENTS.find(s => s.id === ctx.userId); if (!me) return [];
  return STUDENTS.filter(s => s.classId === me.classId && s.id !== me.id).map(s => {
    const h = hash(s.id);
    const st = state(s.id);
    if (!st.init) { st.init = true; st.share = h % 10 < 7; st.race = h % 10 < 5; st.demoWeek = h % 6; st.demoReviews = h % 40; }
    if (!st.share) return { id: s.id, first: shortName(s.name), share: false };
    const sctx = buildContext(s.id);
    const sc = score(sctx, s.id);
    // demo classmates also "practised" a little, so the class view is lively
    sc.xp = Math.min(SEMESTER_MAX, sc.xp + (h % 180)); sc.level = levelOf(sc.xp);
    // their boxes, opened with a fixed seed so the demo stays the same
    if (!st.owned) { const R = seeded(h); st.owned = []; for (let i = 0; i < Math.floor(sc.xp / BOX_EVERY); i++) st.owned.push(pickCard(R).card.id); }
    const cards = ownedCards(s.id);
    return { id: s.id, first: shortName(s.name), share: true, race: st.race, level: sc.level, levelName: LEVELS[sc.level], cards: cards.map(c => c.id),
      avatar: cards[cards.length - 1] || null, badges: Object.keys(sc.ach).filter(k => sc.ach[k]), week: st.demoWeek };
  });
}
export const classOf = ctx => { const me = STUDENTS.find(s => s.id === ctx.userId); return me ? CLASSES.find(c => c.id === me.classId) : null; };

// ---------- weekly class challenge (cooperative) and the opt-in practice race ----------
export const TEAM_GOAL = 30;     // practice lessons for the whole class in a week
export function teamWeek(ctx) {
  const mates = classmates(ctx);
  const mine = L.weekLessons(ctx.userId);
  const others = mates.reduce((a, m) => a + (state(m.id).demoWeek || 0), 0);
  const done = Math.min(TEAM_GOAL, mine + others);
  if (done >= TEAM_GOAL && !state(ctx.userId).teamWeek) setState(ctx.userId, { teamWeek: true });
  return { goal: TEAM_GOAL, done, mine };
}
export function race(ctx) {
  const rows = classmates(ctx).filter(m => m.share && m.race).map(m => ({ first: m.first, lessons: m.week, me: false }));
  if (state(ctx.userId).race) rows.push({ first: 'אני', lessons: L.weekLessons(ctx.userId), me: true });
  return rows.sort((a, b) => b.lessons - a.lessons).slice(0, 8);
}

export { CARDS, RARITY, cardById };
