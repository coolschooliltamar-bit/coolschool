// Proactive reminders: Aluma tells you before you ask – "מחר בוחן באנגלית", "הגשה מתקרבת", "שיעור בוטל מחר".
// Built from the same permission-checked tools as the answers (a parent sees only their own children).
// Shown under a bell in the top bar; a reminder can be dismissed. With permission, new reminders also appear
// as browser notifications while Aluma is open (true push to a closed app needs a push server – not yet).
import * as T from './tools.js';
import { db, save } from './store.js';
import { NOW, subjectName, STUDENTS } from './data.js';

const DAY = 864e5;
const dayStart = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
// "היום" / "מחר" / "ביום שלישי" / "בעוד 5 ימים"
export function whenText(date, now = NOW) {
  const days = Math.round((dayStart(date) - dayStart(now)) / DAY);
  if (days === 0) return 'היום';
  if (days === 1) return 'מחר';
  if (days === -1) return 'אתמול';
  if (days > 1 && days < 7) return `ביום ${['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'][new Date(date).getDay()]}`;
  return days > 0 ? `בעוד ${days} ימים` : `לפני ${-days} ימים`;
}
const first = id => ((STUDENTS.find(s => s.id === id) || {}).name || '').split(' ')[0];
const sub = s => (s ? subjectName(s) : '');

// every reminder: { key, kind, level ('urgent'|'soon'|'info'), icon, text, studentId, at }
// the next school day (Friday and Saturday are skipped), as days from today
export function nextSchoolDay(now = NOW) { let d = 1; while ([5, 6].includes(new Date(dayStart(now).getTime() + d * DAY).getDay())) d++; return d; }
export function compute(ctx, { now = NOW } = {}) {
  const next = nextSchoolDay(now), horizon = dayStart(now).getTime() + (next + 1) * DAY;   // until the end of the next school day
  const kids = ctx.role === 'parent' ? ctx.allowedStudentIds : ctx.role === 'student' ? [ctx.userId] : [];
  const out = [];
  for (const sid of kids) {
    const who = ctx.role === 'parent' && kids.length > 1 ? `${first(sid)}: ` : ctx.role === 'parent' ? `${first(sid)} – ` : '';
    const safe = f => { try { return f(); } catch { return null; } };
    // tests in the next 3 days
    for (const x of (safe(() => T.getUpcomingTests(ctx, { studentId: sid, days: next + 3 })) || { data: [] }).data) {
      const d = Math.round((dayStart(x.date) - dayStart(now)) / DAY);
      out.push({ key: `t:${sid}:${x.id || x.title}:${x.date}`, kind: 'test', level: d <= next ? 'urgent' : 'soon', icon: 'calendar', studentId: sid, at: x.date,
        text: `${who}${whenText(x.date, now)} ${x.title}${x.subject ? ` ב${sub(x.subject)}` : ''}` });
    }
    // work due by the end of the next school day, not handed in
    const asg = (safe(() => T.getAssignments(ctx, { studentId: sid, quiet: true })) || { data: [] }).data;
    for (const a of asg.filter(a => a.status !== 'submitted' && a.due && new Date(a.due) > now && new Date(a.due) < horizon)) {
      out.push({ key: `d:${sid}:${a.id || a.title}`, kind: 'due', level: new Date(a.due) - now < DAY ? 'urgent' : 'soon', icon: 'task', studentId: sid, at: a.due,
        text: `${who}הגשה ${whenText(a.due, now)}: ${a.title}${a.subject ? ` (${sub(a.subject)})` : ''}` });
    }
    // late work from the last week
    for (const a of asg.filter(a => a.status !== 'submitted' && a.due && new Date(a.due) < now && now - new Date(a.due) < 7 * DAY)) {
      out.push({ key: `l:${sid}:${a.id || a.title}`, kind: 'late', level: 'urgent', icon: 'alert', studentId: sid, at: a.due,
        text: `${who}באיחור: ${a.title}${a.subject ? ` (${sub(a.subject)})` : ''}` });
    }
    // changes in the next school day's timetable
    for (const c of safe(() => T.scheduleChanges(ctx, { studentId: sid, dayOffsetN: next })) || []) {
      out.push({ key: `c:${sid}:${c.subject}:${c.date}:${c.kind}`, kind: 'change', level: 'info', icon: 'calendar', studentId: sid, at: c.date,
        text: `${who}${whenText(c.date, now)} ב${sub(c.subject)}: ${c.note}` });
    }
  }
  const rank = { urgent: 0, soon: 1, info: 2 };
  return out.sort((a, b) => rank[a.level] - rank[b.level] || new Date(a.at) - new Date(b.at));
}

// ---------- dismissed / already notified (per user, in this browser) ----------
const store = userId => { const r = (db().reminders = db().reminders || {}); return (r[userId] = r[userId] || { dismissed: {}, notified: {} }); };
export const active = (ctx, opts) => compute(ctx, opts).filter(r => !store(ctx.userId).dismissed[r.key]);
export function dismiss(ctx, key) { store(ctx.userId).dismissed[key] = Date.now(); save(); }
export function restoreAll(ctx) { store(ctx.userId).dismissed = {}; save(); }

// browser notifications while the app is open: only reminders that were not shown before
export const notifyOn = ctx => !!((db().settings[ctx.userId] || {}).notify) && typeof Notification !== 'undefined' && Notification.permission === 'granted';
export async function enableNotify(ctx) {
  if (typeof Notification === 'undefined') throw new Error('הדפדפן הזה לא תומך בהתראות.');
  const p = await Notification.requestPermission();
  db().settings[ctx.userId] = { ...(db().settings[ctx.userId] || {}), notify: p === 'granted' }; save();
  if (p !== 'granted') throw new Error('ההתראות לא אושרו בדפדפן. אפשר לאשר אותן בהגדרות האתר.');
}
export function disableNotify(ctx) { db().settings[ctx.userId] = { ...(db().settings[ctx.userId] || {}), notify: false }; save(); }
export function notifyNew(ctx, list = active(ctx)) {
  if (!notifyOn(ctx)) return 0;
  const st = store(ctx.userId); let n = 0;
  for (const r of list.filter(r => r.level !== 'info' && !st.notified[r.key]).slice(0, 3)) {
    try { new Notification('אלומה', { body: r.text, tag: r.key, icon: 'img/aluma-icon.webp', lang: 'he', dir: 'rtl' }); st.notified[r.key] = Date.now(); n++; } catch { /* ignore */ }
  }
  if (n) save();
  return n;
}
