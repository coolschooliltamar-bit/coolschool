// Gamification (spec א). XP is a MEASURE of learning effort – not the goal:
//   40% submissions (on time and well done) · 20% exam grades · 40% Aluma's learning tools.
// The weights are the maximum each source can give in a semester (400 / 200 / 400 = 1,000 XP),
// so no single source can carry the whole score. Every rule is shown to the student.
// Rewards are earned only: fixed, visible unlock rules – no money, no random packs, no countdowns.
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
  const unitDone = Object.keys(p.done).some(k => { const m = k.match(/^([a-z]+):(\d+):\d$/); return m && L.unitState(sid, m[1], +m[2]).every(Boolean); }) || Object.keys(p.done).some(k => k.startsWith('P:'));
  const ach = {
    first_lesson: Object.keys(p.done).length > 0 || p.week.lessons > 0,
    ontime3: onTime >= 3, exam85: best >= 85, improver: improved, unit_done: unitDone,
    streak3: p.streak >= 3, cards30: p.reviews >= 30,
    project_sent: (db().projects || []).some(x => x.studentId === sid && x.status !== 'draft'), project_done: (db().projects || []).some(x => x.studentId === sid && x.status === 'graded'), team_week: !!st.teamWeek,
  };
  return { xp, parts, level: levelOf(xp), facts: { onTime, late, missing, quality, examsN, lessons: Object.keys(p.done).length, reviews: p.reviews, streak: p.streak, today: p.xpDay.day === new Date().toDateString() ? p.xpDay.n : 0 }, ach };
}
export const unlocked = (s, c) => (c.unlock.xp != null ? s.xp >= c.unlock.xp : !!s.ach[c.unlock.ach]);
export const unlockedCards = s => CARDS.filter(c => unlocked(s, c));
export function nextRewards(s, n = 3) { return CARDS.filter(c => c.unlock.xp != null && !unlocked(s, c)).sort((a, b) => a.unlock.xp - b.unlock.xp).slice(0, n); }

// ---------- per-student game settings (kept in the browser; synced for real accounts) ----------
export function state(userId) {
  const G = (db().game = db().game || {});
  return (G[userId] = G[userId] || { avatar: null, share: false, race: false, projectSent: false, projectDone: false, teamWeek: false, seen: [] });
}
export function setState(userId, patch) { Object.assign(state(userId), patch); save(); }
export function avatarOf(userId, s) {
  const st = state(userId); const list = unlockedCards(s);
  return (st.avatar && list.find(c => c.id === st.avatar)) || list[list.length - 1] || null;
}
// cards unlocked since the student last looked (for a small "new!" badge, never a pop-up countdown)
export function newCards(userId, s) { const seen = new Set(state(userId).seen); return unlockedCards(s).filter(c => !seen.has(c.id)); }
export function markSeen(userId, s) { setState(userId, { seen: unlockedCards(s).map(c => c.id) }); }

// ---------- classmates (demo) ----------
// Only what a classmate CHOSE to share: first name, level, avatar, cards and badges.
// Never XP numbers, grades, submissions or anything from the platforms.
// In the real product each student publishes this small profile to the server (see /game in the worker);
// in the demo the classmates' profiles are derived here from the demo data.
const shortName = n => { const [f, l] = String(n).split(' '); return l ? `${f} ${l[0]}׳` : f; };   // "יונתן ש׳" – first names repeat in a class
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
    const cards = unlockedCards(sc);
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
