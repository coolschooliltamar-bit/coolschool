// Local answering engine – stands in for the AI orchestrator (spec 04) until the Claude API is connected.
// It understands Hebrew questions with simple patterns, calls the SAME permission-checked tools the AI
// would call, and builds every fact in the answer from tool results (spec 04 "grounding").
// Behaviour rules follow spec 18.
import { SUBJECTS, STUDENTS, TEACHERS, CLASSES, subjectName, NOW, dayOffset } from './data.js';
import * as T from './tools.js';
import { g, Forbidden } from './auth.js';
import { db, save, audit } from './store.js';
import { LIVE } from './google.js';
import * as Game from './game.js';
import { SEED as SEED_LIST } from './router-seed.js';
let liveMode = false;

const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const fmtDate = d => { d = new Date(d); return `${d.getDate()}.${d.getMonth() + 1}`; };
const dayName = d => DAYS[new Date(d).getDay()];
const firstName = n => n.split(' ')[0];
const norm = s => s.replace(/[֑-ׇ]/g, '').replace(/[״"׳']/g, '').replace(/\s+/g, ' ').trim();

// school subjects that are not in this student's data – recognised so the fast engine can answer
// "you don't have chemistry" instead of sending the question to the language model
export const OTHER_SUBJECTS = [['כימיה'], ['ערבית'], ['צרפתית'], ['ספרדית'], ['רוסית'], ['אמהרית'], ['גיאוגרפיה', 'גאוגרפיה', 'ידיעת הארץ'], ['אזרחות'], ['מדעי המחשב', 'מחשבים', 'תכנות'],
  ['אמנות', 'אומנות'], ['מוזיקה', 'מוסיקה'], ['תיאטרון'], ['קולנוע'], ['תקשורת'], ['פסיכולוגיה'], ['סוציולוגיה'], ['כלכלה'], ['מחשבת ישראל'], ['תורה שבעל פה', 'תושבע״פ', 'תושבעפ'], ['משפטים'],
  ['רובוטיקה'], ['הנדסה'], ['חקלאות'], ['דרמה'], ['מחול'], ['של״ח', 'שלח'], ['גמרא', 'תלמוד'], ['ביוטכנולוגיה'], ['מדעי החברה'], ['חשבונאות'], ['ניהול'], ['תרבות ישראל'], ['אסטרונומיה']]
  .map(a => ({ id: 'x:' + a[0], name: a[0], aliases: a.map(norm) }));
export const subjName = id => (String(id).startsWith('x:') ? id.slice(2) : subjectName(id));
// Classroom courses are often named in English ("History 9B"): the Hebrew subject → its English names
const EN = { history: ['history'], math: ['math', 'maths', 'mathematics', 'algebra', 'geometry'], english: ['english', 'esl', 'efl'], science: ['science', 'biology', 'physics'],
  literature: ['literature'], hebrew: ['hebrew', 'lashon'], bible: ['bible', 'tanakh', 'tanach', 'tanah'], pe: ['physical education', 'sport', 'sports', 'gym'],
  'x:כימיה': ['chemistry'], 'x:ערבית': ['arabic'], 'x:צרפתית': ['french'], 'x:ספרדית': ['spanish'], 'x:רוסית': ['russian'], 'x:גיאוגרפיה': ['geography'], 'x:אזרחות': ['civics'],
  'x:מדעי המחשב': ['computer', 'computers', 'programming', 'coding', 'cs'], 'x:אמנות': ['art', 'arts'], 'x:מוזיקה': ['music'], 'x:כלכלה': ['economics'], 'x:פסיכולוגיה': ['psychology'],
  'x:סוציולוגיה': ['sociology'], 'x:תיאטרון': ['theatre', 'theater', 'drama'], 'x:רובוטיקה': ['robotics'], 'x:אסטרונומיה': ['astronomy'] };
let titleWords = new Set();                 // exact words of this user's exam / assignment titles ("הצרפתית")
function findSubject(t) {
  if (liveMode) {
    const lc = t.toLowerCase();
    const c = LIVE.courses.find(c => { const n = norm(c.name).toLowerCase(); return lc.includes(n) || n.split(/\s+/).some(w => w.length > 2 && !/^\d/.test(w) && lc.split(/\s+/).some(x => x === w || x.replace(/^[ובהלמשכ]{1,2}/, '') === w)); });
    if (c) return c.name;
    const s = findSubjectId(t);
    if (s) { const names = [...(EN[s] || []), ...[...SUBJECTS, ...OTHER_SUBJECTS].filter(x => x.id === s).flatMap(x => x.aliases)]; const c2 = LIVE.courses.find(c => names.some(n => norm(c.name).toLowerCase().split(/[\s\-–]+/).includes(n) || norm(c.name).toLowerCase().includes(n + ' ') || norm(c.name).toLowerCase() === n)); if (c2) return c2.name; }
    return s;
  }
  return findSubjectId(t);
}
function findSubjectId(t) {
  // the longest alias wins ("מדעי המחשב" is not "מדעים"); a word that is part of a title is a title, not a subject
  let best = null, len = 0;
  const words = t.replace(/[?!.,:;()]/g, ' ').split(/\s+/);
  for (const s of [...SUBJECTS, ...OTHER_SUBJECTS]) for (const a0 of s.aliases) {
    const a = norm(a0); if (a.length <= len || !t.includes(a)) continue;
    const w = words.find(x => x.includes(a.split(' ')[0]));
    if (s.id.startsWith('x:') && w && titleWords.has(w)) continue;
    best = s.id; len = a.length;
  }
  if (best) return best;
  for (const w of words) {                    // a misspelled subject name: ONE letter missing, same skeleton ("אנגלת" = "אנגלית"; but "כמה" ≠ "כימיה")
    if (titleWords.has(w)) continue;
    for (const core of [w, w.slice(1), w.slice(2)]) {
      if (core.length < 4) continue;
      for (const s of [...SUBJECTS, ...OTHER_SUBJECTS]) for (const a0 of s.aliases) { const a = norm(a0); if (!a.includes(' ') && a.length >= 5 && a.length - core.length === 1 && skel(core) === skel(a)) return s.id; }
    }
  }
  return null;
}
function setTitles(ctx) {
  titleWords = new Set();
  for (const sid of ctx.allowedStudentIds || []) {
    try { T.getGrades(ctx, { studentId: sid, quiet: true }).data.forEach(g => norm(g.title || '').split(/[\s–-]+/).forEach(w => titleWords.add(w))); } catch { /* no access */ }
    try { T.getAssignments(ctx, { studentId: sid, quiet: true }).data.forEach(a => norm(a.title || '').split(/[\s–-]+/).forEach(w => titleWords.add(w))); } catch { /* no access */ }
  }
}
// the subjects a student actually has (grades, assignments, timetable / Classroom courses)
function mySubjects(ctx, sid) {
  const out = new Set();
  if (ctx.live) { (LIVE.courses || []).forEach(c => out.add(c.name)); return out; }
  try { T.getGrades(ctx, { studentId: sid, quiet: true }).data.forEach(g => out.add(g.subject)); } catch { /* no access */ }
  try { T.getAssignments(ctx, { studentId: sid, quiet: true }).data.forEach(a => out.add(a.subject)); } catch { /* no access */ }
  return out;
}
function findClass(t) {
  const m = t.match(/(ז|ח|ט|י|יא|יב)\s?(\d)/);
  if (!m) return null;
  const key = { 'ז': 'ז׳', 'ט': 'ט׳', 'יא': 'י״א' }[m[1]];
  const c = CLASSES.find(c => c.name === `${key}${m[2]}`);
  return c ? c.id : null;
}
function findDay(t) {
  if (/מחרתיים/.test(t)) return 2;
  if (/מחר/.test(t)) return 1;
  if (/היום|עכשיו/.test(t)) return 0;
  for (let i = 0; i < 5; i++) if (t.includes(`יום ${DAYS[i]}`) || t.includes(`ב${DAYS[i]}`)) {
    let d = 0; while (dayOffset(d).getDay() !== i) d++; return d;
  }
  return null;
}
// a student mentioned by first name (to test permission enforcement)
function mentionedStudent(t, ctx) {
  for (const s of STUDENTS) {
    const fn = firstName(s.name);
    if (new RegExp(`(^|\\s|ל|של\\s)${fn}(\\s|$|\\?)`).test(t) && s.id !== ctx.userId) return s;
  }
  return null;
}

const prefs = ctx => (db().memories[ctx.userId] || []).map(m => m.text).join(' ');
const wantsShort = ctx => /קצר/.test(prefs(ctx));
const noEmoji = ctx => /בלי אימוג/.test(prefs(ctx));
const emoji = (ctx, e) => (noEmoji(ctx) ? '' : ' ' + e);

// a Hebrew prefix glued to an English name gets a hyphen: "בHistory" → "ב-History"
const reply = (text, extra = {}) => ({ text: String(text).replace(/([\u05D0-\u05EA])([A-Za-z])/g, '$1-$2'), cards: [], chips: [], ...extra });
const DEFAULT_CHIPS = {
  student: ['מה יש לי מחר?', 'ציונים אחרונים', 'מה להגיש השבוע?', 'בואי נתרגל', 'תנסחי למורה שאני חולה היום'],
  parent: ['מה המצב השבוע?', 'ציונים אחרונים', 'יש הגשות פתוחות?', 'היעדרויות החודש'],
  teacher: ['מי לא הגיש בט׳2?', 'מה הממוצע במבחן האחרון בט׳2?', 'מי בט׳2 עם יותר מ-3 היעדרויות?', 'הודעות חדשות'],
};

export function welcome(ctx, activeStudent) {
  const u = ctx.user;
  if (ctx.live) return reply(`היי ${firstName(u.name)}! מחוברת ל-Google Classroom שלך (${LIVE.courses.length} כיתות).`, { chips: ['מה להגיש השבוע?', 'ציונים אחרונים', 'מה ההודעות?'] });
  if (ctx.role === 'parent' && !ctx.allowedStudentIds.length)
    return reply(`שלום ${firstName(u.name)}! עדיין אין ילדים מקושרים לחשבון. אפשר להזין קוד הזמנה מבית הספר בהגדרות (⚙️).`);
  const who = ctx.role === 'parent' ? `על ${firstName(activeStudent.name)}` : '';
  return reply(`היי ${firstName(u.name)}, אני אלומה${emoji(ctx, '👋')} אפשר לשאול אותי ${who} על ציונים, מטלות, מערכת שעות והודעות – ואני יכולה לנסח הודעה למורה (היא נשלחת רק אחרי שתאשר${g(u, '', 'י')}).`,
    { chips: DEFAULT_CHIPS[ctx.role] });
}

export function answer(ctx, rawText, { activeStudentId, convo, intent: forced, routed } = {}) {
  db().stats.questions++; save();
  audit(ctx.userId, 'question', {});
  const t = applyPhrases(norm(rawText));      // "איך הלך לי במבחן" → "מה קיבלתי במבחן"
  const tt = routed || t;      // the router's corrected text ("קבלתי בהסטוריה" → "קיבלתי בהיסטוריה")
  try {
    if (forced && TALK.has(forced)) return smallTalk(ctx, canonical(rawText));
    if (forced && DISPATCH[forced] && ctx.role !== 'teacher' && ctx.allowedStudentIds.length) return dispatch(ctx, forced, tt, activeStudentId);
    return route(ctx, tt, rawText, activeStudentId, convo || {});
  }
  catch (e) {
    if (e instanceof Forbidden) return reply(e.message);
    console.error(e);
    return reply('משהו השתבש אצלי. אפשר לנסות לנסח אחרת?');
  }
}

function route(ctx, t, raw, activeStudentId, convo) {
  const u = ctx.user;
  liveMode = !!ctx.live;
  if (ctx.live) {
    if (/(היעדר|נוכחות|איחור)/.test(t) || (!LIVE.events && /(מערכת|מחר|היום|שיעור)/.test(t) && !/(להגיש|מטל|ציון|ממוצע|הודע)/.test(t)))
      return reply('הנוכחות ומערכת השעות מגיעות ממשוב, שעוד לא מחובר. אפשר לחבר את Google Calendar בהגדרות כדי לראות את היומן.', { chips: ['מה להגיש השבוע?', 'ציונים אחרונים', 'מה ההודעות?'] });
    if (/(תנסח|תכתוב|תכתבי|תשלח|תשלחי|למורה|למחנ[כך])/.test(t) && !LIVE.teachers.length)
      return reply('כדי לשלוח הודעות למורים מהחשבון האמיתי, חברו את Gmail בהגדרות. ההודעה תמיד תחכה לאישור שלך.');
  }

  // ---- safety first (spec 18) ----
  if (/(להתאבד|לפגוע בעצמי|רוצה למות|אין לי טעם לחיות|מרביצים לי|מאיימים עליי|פוגעים בי|מציקים לי ברשת|מפיצים עליי)/.test(t)) {
    return reply('אני ממש מצטערת שזה מה שקורה. את זה לא כדאי לעבור לבד. אפשר לדבר עם מישהו עכשיו:', {
      cards: [{ type: 'help', lines: [
        ['ער״ן – עזרה ראשונה נפשית, 24/7', '1201'],
        ['המוקד הלאומי להגנה על ילדים ברשת', '105'],
        ['בסכנה מיידית: משטרה / מד״א', '100 / 101'],
        ['ביה״ס: היועצת או המחנך/ת', ''],
      ] }],
    });
  }
  if (/(התעלמ|תתעלמי|את עכשיו|מעכשיו את מנהל|מצב מפתח|system prompt|הוראות המערכת)/.test(t)) {
    return reply('אני ממשיכה לעבוד לפי אותם כללים, וההרשאות שלך לא משתנות. במה אפשר לעזור – ציונים, מטלות, מערכת שעות או הודעה למורה?', { chips: DEFAULT_CHIPS[ctx.role] });
  }

  // ---- memory (spec 11) ----
  if (/^(תזכרי|זכרי|מעכשיו|תמיד)/.test(t) || /תזכרי ש/.test(t)) {
    if (/(בריא|מחל|גירוש|הורים שלי|דיכאון|כסף)/.test(t)) return reply('את זה אני לא שומרת – זה מידע אישי ורגיש. אפשר להגיד לי בכל פעם שצריך.');
    const text = raw.replace(/^(תזכרי|זכרי)\s*(ש)?/, '').trim().slice(0, 140);
    const list = db().memories[ctx.userId] = db().memories[ctx.userId] || [];
    list.push({ id: crypto.randomUUID().slice(0, 8), text, at: new Date().toISOString() });
    save(); audit(ctx.userId, 'memory_saved', {});
    return reply(`שמרתי: "${text}". אפשר לראות ולמחוק את מה שאני זוכרת בהגדרות (⚙️).`);
  }

  if (ctx.role === 'teacher') return teacherRoute(ctx, t);

  // ---- student / parent ----
  if (!ctx.allowedStudentIds.length) return reply('עדיין אין ילדים מקושרים לחשבון. אפשר להזין קוד הזמנה מבית הספר בהגדרות (⚙️).');
  const other = ctx.live ? null : mentionedStudent(t, ctx);
  let studentIds = [activeStudentId || ctx.allowedStudentIds[0]];
  if (other) {
    if (!ctx.allowedStudentIds.includes(other.id)) {
      // still call the tool: the permission check lives there, not here
      try { T.getGrades(ctx, { studentId: other.id }); } catch (e) { return reply(ctx.role === 'parent' ? 'אני יכולה לעזור רק לגבי הילדים שמקושרים לחשבון שלך.' : 'אני יכולה לעזור רק עם המידע שלך.'); }
    }
    studentIds = [other.id];
  }
  if (ctx.role === 'parent' && /(כל הילדים|הילדים|שניהם|שתיהן)/.test(t)) studentIds = ctx.allowedStudentIds;

  if (/(xp|באיזו רמה|הרמה שלי|הרמה של|כמה נקודות|הקלפים שלי|כמה קלפים|ההישגים|הישגים|פרסים)/i.test(t)) return perStudent(ctx, studentIds, sid => progressAnswer(ctx, sid));
  if (/(תכתבי לי (את )?ה?עבודה|תכתוב לי (את )?ה?עבודה|תפתרי|פתרון ל|תעשי לי (את )?ה?ש(יעורי|"?ב)|תכיני לי חיבור)/.test(t)) {
    return reply('עבודות להגשה אני לא כותבת – זה צריך להיות שלך. אבל אני יכולה להגיד לך מתי צריך להגיש ומה כתוב בהנחיות.', { chips: ['מה להגיש השבוע?'] });
  }
  if (ctx.role === 'student' && /(תרגל|תרגול|לתרגל|תבחני|חידון|להתכונן|תוכנית למידה|תכנית למידה|כרטיסי|ללמוד למבחן)/.test(t)) {
    const sub = findSubject(t);
    const known = ['history', 'english', 'science', 'math'];
    const subject = known.includes(sub) ? sub : null;
    if (/כרטיסי/.test(t)) return reply('אפשר לחזור על מושגים בכרטיסיות זיכרון:', { cards: [{ type: 'tool', tool: 'cards', subject, icon: '🃏', title: 'כרטיסיות זיכרון' + (subject ? ` · ${subjectName(subject)}` : ''), desc: 'כרטיסים שלא ידעת חוזרים מהר יותר', cta: 'פתיחה' }] });
    if (/(להתכונן|תוכנית|תכנית|ללמוד למבחן)/.test(t)) return reply('בואו נבנה תוכנית למידה לפי תאריך המבחן:', { cards: [{ type: 'tool', tool: 'planner', icon: '🗓️', title: 'תוכנית למידה', desc: 'יום אחרי יום, עד המבחן', cta: 'בניית תוכנית' }] });
    return reply(`מעולה, בואו נתרגל${subject ? ` ${subjectName(subject)}` : ''}! שיעורים קצרים של 5 שאלות, עם XP ורצף ימים.`, { cards: [{ type: 'tool', tool: 'path', subject, icon: '🧩', title: 'מסלול תרגול' + (subject ? ` · ${subjectName(subject)}` : ''), desc: 'אני ממליצה להתחיל מהמקצוע שהציונים בו נמוכים יותר', cta: 'להתחיל' }] });
  }
  if (/(תנסח|תכתוב|תכתבי|תשלח|תשלחי|נסחי|כתבי|שלחי|תודיע|תודיעי).*(מורה|מחנ[כך]|ל(רינה|משה|שירן|אלון|מיכל|יוסי))/.test(t) || /^(הודעה|תגידי) למורה/.test(t)) {
    return draftRoute(ctx, t, raw, studentIds[0], convo);
  }
  const subject = findSubject(t);
  if (ctx.role === 'parent' && /(מה המצב|איך (הוא|היא|הילד|הבן|הבת|הם)|לדעת השבוע|משהו שאני צריך|בלימודים|סיכום)/.test(t)) return perStudent(ctx, studentIds, sid => weeklySummary(ctx, sid));
  if (/(היעדר|נוכחות|איחור|חיסור|חיסורים|נעדר)/.test(t)) return perStudent(ctx, studentIds, sid => attendanceAnswer(ctx, sid));
  if (/(ממוצע)/.test(t)) return perStudent(ctx, studentIds, sid => averageAnswer(ctx, sid, subject));
  if (/(ציון|ציונים|קיבלתי|קיבל|קיבלה|מבחן|בוחן|בגרות)/.test(t) && !/(מתי המבחן|מתי יש מבחן)/.test(t)) {
    const plural = /(ציונים|כל ה)/.test(t);
    return perStudent(ctx, studentIds, sid => gradesAnswer(ctx, sid, subject, plural, t));
  }
  if (/(להגיש|הגשה|הגשות|מטלה|מטלות|עבודה|עבודות|שיעורי בית|(^|\s)שב(\s|$|\?))/.test(t)) return perStudent(ctx, studentIds, sid => assignmentsAnswer(ctx, sid, subject, t));
  if (/(הודע|כתב|כתבה|עדכון|עדכונים|מה חדש)/.test(t)) return perStudent(ctx, studentIds, sid => announcementsAnswer(ctx, sid));
  const day = findDay(t);
  if (day != null || /(מערכת|שיעור|שיעורים|מתי|ללמוד מחר|יש לי)/.test(t)) return perStudent(ctx, studentIds, sid => scheduleAnswer(ctx, sid, day == null ? 0 : day));
  if (/(שלום|היי|הי|בוקר טוב|ערב טוב|מה את יודעת|עזרה|מה אפשר|מי את)/.test(t)) {
    return reply(`אני אלומה, עוזרת AI של בית הספר. אני יכולה לענות על ציונים, מטלות, מערכת שעות, נוכחות והודעות, ולנסח הודעה למורה.`, { chips: DEFAULT_CHIPS[ctx.role] });
  }
  return reply('לא בטוחה שהבנתי. אני כאן בשביל הלימודים – ציונים, מטלות, מערכת שעות, נוכחות והודעות. אפשר לנסות אחת מאלה:', { chips: DEFAULT_CHIPS[ctx.role] });
}

function progressAnswer(ctx, sid) {
  const s = Game.score(ctx, sid);
  const who = ctx.role === 'parent' ? `ל${nameOf(sid)} יש` : 'יש לך';
  const box = Game.boxInfo(sid, s);
  const cards = Game.ownedCards(sid).length, badges = Object.values(s.ach).filter(Boolean).length;
  return reply(`${who} **${s.xp} XP** – רמה ${s.level} (${Game.LEVELS[s.level]}): הגשות ${s.parts.submissions}/${Game.CAPS.submissions}, מבחנים ${s.parts.exams}/${Game.CAPS.exams}, תרגול ${s.parts.learning}/${Game.CAPS.learning}. ${cards} קלפים מתוך ${Game.CARDS.length} ו-${badges} הישגים.${box.ready ? ` ${ctx.role === 'parent' ? 'מחכות' : 'מחכות לך'} ${box.ready === 1 ? 'תיבת קלפים אחת' : `${box.ready} תיבות קלפים`} לפתיחה.` : ''}${` התיבה הבאה בעוד ${box.toNext} XP.`}${Game.canCombine(sid).length ? ' יש קלף עם 4 עותקים – אפשר לשלב אותו לתיבה חדשה.' : ''}`,
    { cards: [{ type: 'tool', tool: 'game', icon: '🏆', title: 'פרסים והישגים', desc: 'פירוט ה-XP, האלבום והכיתה', cta: 'פתיחה' }], chips: ctx.role === 'student' ? ['תיצרי לי מסלול מותאם', 'מה להגיש השבוע?'] : [] });
}

// ---------- extra fast answers (no language model needed) ----------
const pctOf = g => (g.max ? Math.round(g.score / g.max * 100) : g.score);
function teachersAnswer(ctx, sid, t, sub) {
  const list = T.listMyTeachers(ctx, { studentId: sid });
  if (!list.length) return reply(ctx.live ? 'כדי לראות את המורים צריך לחבר את Gmail בהגדרות.' : 'לא מצאתי מורים.');
  const whose = ctx.role === 'parent' ? `של ${nameOf(sid)}` : 'שלך';
  if (/מחנ[כך]/.test(t)) { const h = list.find(x => x.homeroom); return h ? reply(`${g(h, 'המחנך', 'המחנכת')} ${whose} ${g(h, 'הוא', 'היא')} **${h.name}**.`, { chips: [ctx.role === 'parent' ? 'תכתוב למחנכת ש' : 'תנסחי למחנכת ש'] }) : reply('לא מצאתי מחנך/ת לכיתה.'); }
  if (sub) { const tt = list.filter(x => (x.subjectIds || []).includes(sub) || (x.subjects || []).includes(sub)); if (tt.length) return reply(`${tt.length > 1 ? 'מלמדים' : g(tt[0], 'המורה', 'המורה')} ל${subjectName(sub)} ${whose}: **${tt.map(x => x.name).join(', ')}**.`); return reply(`לא מצאתי מורה ל${subjectName(sub)} ${whose}.`); }
  return reply(`המורים ${whose}:`, { cards: [{ type: 'list', title: 'מורים', rows: list.map(x => [x.name, (x.homeroom ? g(x, 'מחנך · ', 'מחנכת · ') : '') + (x.subjects || []).join(', ')]) }] });
}
function smallTalk(ctx, t) {
  if (/^(תודה|אוקיי|אוקי|סבבה|מעולה|יופי|אחלה|הבנתי|מגניב|נהדר|פצצה|טוב תודה|תודה רבה|תודה אלומה|סבבה תודה|אוקיי תודה)( רבה| אלומה| לך)?$/.test(t)) return reply(`בשמחה!${emoji(ctx, ' 😊')} אם צריך עוד משהו – אני כאן.`, { chips: DEFAULT_CHIPS[ctx.role] });
  if (/^(מה נשמע|מה שלומך|מה קורה|מה המצב)$/.test(t) && ctx.role !== 'parent') return reply(`הכול טוב, תודה ששאלת! במה אפשר לעזור – ציונים, מטלות או המערכת?`, { chips: DEFAULT_CHIPS[ctx.role] });
  return reply(`אני אלומה, עוזרת AI של בית הספר. אני יכולה לענות על ציונים, מטלות, מערכת שעות, נוכחות והודעות, ולנסח הודעה למורה.`, { chips: DEFAULT_CHIPS[ctx.role] });
}
function rankAnswer(ctx, sid, t) {   // best / weakest subject, by the simple average
  const r = T.getGrades(ctx, { studentId: sid });
  const by = {}; r.data.forEach(x => (by[x.subject] = by[x.subject] || []).push(pctOf(x)));
  const rows = Object.entries(by).map(([sub, a]) => [sub, Math.round(a.reduce((x, y) => x + y, 0) / a.length)]).sort((a, b) => b[1] - a[1]);
  if (!rows.length) return reply('עוד אין ציונים במערכת.');
  const worst = /(חלש|נמוך|גרוע|רע|קשה|הכי פחות)/.test(t);
  const [sub, avg] = worst ? rows[rows.length - 1] : rows[0];
  const who = ctx.role === 'parent' ? `של ${nameOf(sid)}` : 'שלך';
  return reply(`המקצוע עם הממוצע ${worst ? 'הכי נמוך' : 'הכי גבוה'} ${who}: **${subjectName(sub)}** (${avg}).`, { cards: [{ type: 'list', title: 'ממוצע לפי מקצוע', rows: rows.map(([s2, a]) => [subjectName(s2), String(a)]) }] });
}
function extremeGrade(ctx, sid, t) {
  const r = T.getGrades(ctx, { studentId: sid });
  if (!r.data.length) return reply('עוד אין ציונים במערכת.');
  const low = /(נמוך|גרוע|רע|הכי פחות)/.test(t);
  const g0 = r.data.slice().sort((a, b) => (low ? pctOf(a) - pctOf(b) : pctOf(b) - pctOf(a)))[0];
  const who = ctx.role === 'parent' ? `של ${nameOf(sid)}` : 'שלך';
  return reply(`הציון ${low ? 'הכי נמוך' : 'הכי גבוה'} ${who}: **${g0.score}** ב${typeName(g0.type)} "${g0.title}" ב${subjectName(g0.subject)} (${fmtDate(g0.date)}).`, { cards: [{ ...g0, gtype: g0.type, type: 'grade' }] });
}
const nowHM = () => `${String(NOW.getHours()).padStart(2, '0')}:${String(NOW.getMinutes()).padStart(2, '0')}`;
function scheduleSmart(ctx, sid, t, sub) {
  const day = findDay(t);
  const whose = ctx.role === 'parent' ? `ל${nameOf(sid)} ` : '';
  const live = l => !(l.change && l.change.kind === 'cancelled');
  if (/(שינוי|שינויים|ביטול|מבוטל|בוטל|החלפה)/.test(t)) {
    const found = []; for (let d = day ?? 0; d < (day ?? 0) + (day == null ? 7 : 1); d++) { const r = T.getSchedule(ctx, { studentId: sid, dayOffsetN: d }); if (r.data) r.data.filter(l => l.change).forEach(l => found.push([d, r.date, l])); }
    if (!found.length) return reply(`אין ${whose}שינויים במערכת${day == null ? ' השבוע' : ''}.${emoji(ctx, ' ✅')}`);
    return reply(`יש ${whose}${found.length === 1 ? 'שינוי אחד' : `${found.length} שינויים`} במערכת:`, { cards: [{ type: 'list', title: 'שינויים במערכת', rows: found.map(([d, date, l]) => [`${d === 0 ? 'היום' : d === 1 ? 'מחר' : 'יום ' + dayName(date)} · ${l.start} · ${subjectName(l.subject)}`, l.change.note]) }] });
  }
  // next lesson (in a subject, or at all)
  if (sub || /(הבא|הבאה|עכשיו|כרגע)/.test(t)) {
    for (let d = day ?? 0; d < (day ?? 0) + 8; d++) {
      const r = T.getSchedule(ctx, { studentId: sid, dayOffsetN: d });
      if (r.calendar || r.notConnected) break;
      const l = (r.data || []).filter(live).find(x => (!sub || x.subject === sub) && (d > 0 || day != null || (/(עכשיו|כרגע)/.test(t) ? x.end > nowHM() : x.start > nowHM())));
      if (l) {
        const when = d === 0 ? (l.start <= nowHM() && l.end > nowHM() ? 'עכשיו' : 'היום') : d === 1 ? 'מחר' : `ביום ${dayName(r.date)}`;
        return reply(`${sub ? `השיעור הבא ב${subjectName(sub)}` : when === 'עכשיו' ? 'השיעור עכשיו' : 'השיעור הבא'} ${whose}: **${when} ב-${l.start}** – ${subjectName(l.subject)}, חדר ${l.room}${l.change ? ` (${l.change.note})` : ''}.`, { cards: [{ type: 'schedule', studentId: sid, date: r.date, lessons: r.data, source: r.source, fetchedAt: r.fetchedAt }] });
      }
    }
    if (sub) return reply(`לא מצאתי שיעור ב${subjectName(sub)} בשבוע הקרוב.`);
  }
  const d0 = day ?? 0;
  if (/(מסיים|מסיימת|מסיימים|נגמר|נגמרים|נגמרת|עד מתי|סוף)/.test(t) || /(מתחיל|מתחילה|מתחילים|באיזה שעה|באיזו שעה)/.test(t)) {
    const r = T.getSchedule(ctx, { studentId: sid, dayOffsetN: d0 });
    const ls = (r.data || []).filter(live);
    if (r.weekend || !ls.length) return scheduleAnswer(ctx, sid, d0);
    const label = d0 === 0 ? 'היום' : d0 === 1 ? 'מחר' : `ביום ${dayName(r.date)}`;
    const end = /(מסיים|נגמר|עד מתי|סוף)/.test(t);
    return reply(end ? `${label} ${whose}הלימודים נגמרים ב-**${ls[ls.length - 1].end}** (${subjectName(ls[ls.length - 1].subject)}).` : `${label} ${whose}הלימודים מתחילים ב-**${ls[0].start}** (${subjectName(ls[0].subject)}).`, { cards: [{ type: 'schedule', studentId: sid, date: r.date, lessons: r.data, source: r.source, fetchedAt: r.fetchedAt }] });
  }
  return scheduleAnswer(ctx, sid, d0);
}

// the router already decided the topic → answer exactly that topic (no second guess by other keywords:
// "מטלות באיחור" is about assignments, even though "איחור" also means being late to class)
const EXTREME = /(הכי|ביותר)/;
const DISPATCH = {
  grades: (ctx, sid, t, sub) => EXTREME.test(t) && !sub ? (/מקצוע/.test(t) ? rankAnswer(ctx, sid, t) : extremeGrade(ctx, sid, t)) : gradesAnswer(ctx, sid, sub, /(ציונים|כל ה)/.test(t), t),
  average: (ctx, sid, t, sub) => EXTREME.test(t) || (/באיזה מקצוע/.test(t) && !sub) ? rankAnswer(ctx, sid, t) : averageAnswer(ctx, sid, sub),
  assignments: (ctx, sid, t, sub) => assignmentsAnswer(ctx, sid, sub, t),
  attendance: (ctx, sid) => attendanceAnswer(ctx, sid),
  announcements: (ctx, sid) => announcementsAnswer(ctx, sid),
  schedule: (ctx, sid, t, sub) => scheduleSmart(ctx, sid, t, sub),
  teachers: (ctx, sid, t, sub) => teachersAnswer(ctx, sid, t, sub),
  progress: (ctx, sid) => progressAnswer(ctx, sid),
  weekly: (ctx, sid) => weeklySummary(ctx, sid),
};
function dispatch(ctx, it, t, activeStudentId) {
  liveMode = !!ctx.live;
  let ids = [activeStudentId || ctx.allowedStudentIds[0]];
  if (ctx.role === 'parent') {
    const named = ctx.allowedStudentIds.filter(id => t.includes(firstName(STUDENTS.find(s => s.id === id).name)));
    if (named.length) ids = named;
    if (/(כל הילדים|הילדים|שניהם|שתיהן)/.test(t)) ids = ctx.allowedStudentIds;
  }
  setTitles(ctx);
  const sub = findSubject(t);
  const WHAT = { grades: 'ציונים', average: 'ציונים', assignments: 'מטלות', schedule: 'שיעורים', teachers: 'מורה', attendance: 'נוכחות', announcements: 'הודעות' };
  const res = perStudent(ctx, ids, sid => {
    if (sub && WHAT[it] && !mySubjects(ctx, sid).has(sub)) {    // a subject this student doesn't have: say so, fast
      const mine = [...mySubjects(ctx, sid)].map(subjName);
      const who = ctx.role === 'parent' ? `ל${nameOf(sid)} אין` : 'אין לך';
      if (ctx.live) return reply(`לא מצאתי ב-Classroom כיתה של ${subjName(sub)}.${mine.length ? ` הכיתות שלך: ${mine.join(', ')}.` : ''}`, { chips: mine.slice(0, 3).map(m => it === 'assignments' ? `יש מטלות ב${m}?` : `מה הציון ב${m}?`) });
      return reply(`${who} ${subjName(sub)} במערכת, אז אין ${WHAT[it]} ${it === 'teachers' ? 'ל' : 'ב'}${subjName(sub)}.${mine.length ? ` המקצועות ${ctx.role === 'parent' ? `של ${nameOf(sid)}` : 'שלך'}: ${mine.join(', ')}.` : ''}`, { chips: mine.slice(0, 3).map(m => it === 'assignments' ? `יש מטלות ב${m}?` : `מה הציון ב${m}?`) });
    }
    return DISPATCH[it](ctx, sid, t, sub);
  });
  // parents always see which child an answer is about
  if (ctx.role === 'parent' && ids.length === 1) { const fn = nameOf(ids[0]); if (!res.text.includes(fn)) res.text = `**${fn}:** ${res.text}`; }
  return res;
}
const TALK = new Set(['thanks', 'hello']);

function perStudent(ctx, ids, fn) {
  if (ids.length === 1) return fn(ids[0]);
  const parts = ids.map(fn);
  return { text: parts.map((p, i) => `**${firstName(STUDENTS.find(s => s.id === ids[i]).name)}:** ${p.text}`).join('\n\n'), cards: parts.flatMap(p => p.cards), chips: [] };
}
const nameOf = id => firstName(STUDENTS.find(s => s.id === id).name);
const childPrefix = (ctx, sid) => (ctx.role === 'parent' ? `ל${nameOf(sid)} ` : 'לך ');

// ---- answers (every fact comes from a tool result) ----
// items whose title is named in the question ("המבחן על המהפכה הצרפתית" → that exam)
const TITLE_STOP = new Set('מבחן מבחנים בוחן עבודה עבודות מטלה מטלות ציון ציונים דף תרגיל שאלות על של את עם הגשה הגשתי להגיש צריך צריכה מתי כבר קיבלתי מה כמה יש לי שלי האחרון האחרונה'.split(' '));
function byTitle(list, t) {
  const words = t.replace(/[?!.,:;()]/g, ' ').split(' ').map(w => w.replace(/^(ו|ה|ב|ל|מ|ש|כ|וה|וב|ול|שה|שב|בה|לה)(?=[\u0590-\u05FF]{3,})/, '')).filter(w => (w.length > 2 || /^\d+$/.test(w)) && !TITLE_STOP.has(w) && !VOCAB.common.has(w) && !findSubject(w));
  if (!words.length) return [];
  const score = x => words.filter(w => norm(x.title).split(' ').some(tw => tw === w || tw.replace(/^(ה|ו|ב|ל)/, '') === w)).length;
  const best = Math.max(0, ...list.map(score));
  return best ? list.filter(x => score(x) === best) : [];
}
function gradesAnswer(ctx, sid, subject, plural, t) {
  let r = T.getGrades(ctx, { studentId: sid, subject });
  if (!r.data.length) return reply(subject ? `עוד אין ציונים ב${subjectName(subject)} במערכת.` : 'עוד אין ציונים במערכת.');
  const named = byTitle(r.data, t);
  if (named.length) { r = { ...r, data: named }; subject = subject || named[0].subject; }
  if (!subject && !plural && /(מבחן|קיבלתי|קיבל|הציון)/.test(t)) {
    const recent = r.data.slice(0, 3);
    const subs = [...new Set(recent.map(g => g.subject))];
    if (subs.length > 1) return reply('על איזה מקצוע? הציונים האחרונים הם ב:', { chips: subs.map(s => ctx.role === 'parent' ? `מה הציון האחרון ב${subjectName(s)}?` : `כמה קיבלתי ב${subjectName(s)}?`) });
  }
  const list = plural ? r.data.slice(0, 5) : r.data.slice(0, 1);
  const g0 = list[0];
  const who = ctx.role === 'parent' ? `${nameOf(sid)} ${g(STUDENTS.find(s => s.id === sid), 'קיבל', 'קיבלה')}` : 'קיבלת';
  let text;
  if (!plural) {
    text = `${who} **${g0.score}** ב${typeName(g0.type)} "${g0.title}" ב${subjectName(g0.subject)} (${fmtDate(g0.date)}).`;
    if (ctx.role === 'student' && g0.score >= 85) text += ` כל הכבוד!${emoji(ctx, '🎉')}`;
  } else {
    text = subject ? `הציונים האחרונים ב${subjectName(subject)}:` : 'הציונים האחרונים:';
  }
  return reply(text, { cards: list.map(gr => ({ ...gr, gtype: gr.type, type: 'grade' })) });
}
const typeName = t => ({ exam: 'מבחן', quiz: 'בוחן', assignment: 'עבודה' }[t] || 'מבחן');

function averageAnswer(ctx, sid, subject) {
  const r = T.getGrades(ctx, { studentId: sid, subject });
  if (!r.data.length) return reply('אין מספיק ציונים לחישוב ממוצע.');
  const avg = Math.round(r.data.reduce((a, b) => a + b.score, 0) / r.data.length);
  const scope = subject ? `ב${subjectName(subject)}` : 'בכל המקצועות';
  const text = `${ctx.role === 'parent' ? `${nameOf(sid)}: ` : ''}הממוצע הפשוט ${scope} הוא **${avg}** (${r.data.length} ציונים: ${r.data.slice(0, 6).map(x => x.score).join(', ')}${r.data.length > 6 ? '…' : ''}).` +
    (wantsShort(ctx) ? '' : ' הממוצע הרשמי בתעודה עשוי להיות משוקלל אחרת.');
  return reply(text, { cards: [{ type: 'stat', label: `ממוצע ${scope}`, value: avg, source: r.source, fetchedAt: r.fetchedAt }] });
}

function assignmentsAnswer(ctx, sid, subject, t) {
  const week = /(השבוע|הקרוב|מחר|היום)/.test(t) || !/(כל)/.test(t);
  const all = T.getAssignments(ctx, { studentId: sid, subject });
  const named = byTitle(all.data, t);
  if (named.length) {   // a specific assignment was named – answer about it, submitted or not
    const a = named[0];
    const st = a.status === 'submitted' ? 'כבר הוגשה ✓' : a.due && new Date(a.due) < NOW ? 'לא הוגשה ועבר מועד ההגשה' : a.due ? `צריך להגיש עד ${dayName(a.due)} ${fmtDate(a.due)}` : 'אין לה תאריך הגשה';
    return reply(`"${a.title}" (${subjectName(a.subject)}): ${st}.`, { cards: named.slice(0, 3).map(x => ({ type: 'assignment', ...x })) });
  }
  if (subject && !all.data.length) return reply(`אין ${childPrefix(ctx, sid)}מטלות ב${subjName(subject)}.${emoji(ctx, '✅')}`);
  if (subject && !all.data.some(a => a.status !== 'submitted') && all.data.length) {
    const a = all.data[0];
    return reply(`ב${subjectName(subject)} אין ${childPrefix(ctx, sid)}מטלות פתוחות – "${a.title}" ${a.status === 'submitted' ? 'כבר הוגשה ✓' : 'פתוחה'}.`, { cards: all.data.slice(0, 3).map(x => ({ type: 'assignment', ...x })) });
  }
  if (/(לא הגשתי|שלא הגשתי|לא הוגש|לא הגיש)/.test(t)) {
    const miss = all.data.filter(a => a.status !== 'submitted');
    return reply(miss.length ? `${miss.length === 1 ? 'מטלה אחת' : `${miss.length} מטלות`} ${ctx.role === 'parent' ? `ש${nameOf(sid)} עוד לא ${g(STUDENTS.find(s => s.id === sid), 'הגיש', 'הגישה')}` : 'שעוד לא הגשת'}:` : `${ctx.role === 'parent' ? nameOf(sid) + ' ' + g(STUDENTS.find(s => s.id === sid), 'הגיש', 'הגישה') : 'הגשת'} הכול.${emoji(ctx, ' ✅')}`, { cards: miss.map(x => ({ type: 'assignment', ...x })) });
  }
  if (/(מחר|למחר)/.test(t)) {
    const tm = all.data.filter(a => a.status !== 'submitted' && a.due && new Date(a.due).toDateString() === dayOffset(1).toDateString());
    const inSub = subject ? ` ב${subjName(subject)}` : '';
    return reply(tm.length ? `למחר ${ctx.role === 'parent' ? `יש ל${nameOf(sid)}` : 'יש לך'} ${tm.length === 1 ? 'מטלה אחת' : `${tm.length} מטלות`}${inSub} להגשה:` : `אין ${childPrefix(ctx, sid)}מטלות${inSub} להגשה מחר.${emoji(ctx, '✅')}`, { cards: tm.map(x => ({ type: 'assignment', ...x })) });
  }
  const r = { ...all, data: all.data.filter(a => a.status !== 'submitted') };
  const late = r.data.filter(a => a.due && new Date(a.due) < NOW);
  const upcoming = r.data.filter(a => !a.due || (new Date(a.due) >= NOW && (!week || new Date(a.due) - NOW < 7 * 864e5)));
  if (/איחור/.test(t)) {   // "יש לי מטלות באיחור?" – answer exactly that
    const txt = late.length ? `יש ${childPrefix(ctx, sid)}${late.length === 1 ? 'מטלה אחת' : `${late.length} מטלות`} באיחור – עבר מועד ההגשה ולא ${late.length === 1 ? 'הוגשה' : 'הוגשו'}.` : `אין ${childPrefix(ctx, sid)}מטלות באיחור.${emoji(ctx, '✅')}${upcoming.length ? ` יש ${upcoming.length} מטלות פתוחות השבוע.` : ''}`;
    return reply(txt, { cards: [...late, ...upcoming].slice(0, 6).map(a => ({ type: 'assignment', ...a })) });
  }
  if (!late.length && !upcoming.length) return reply(`אין ${childPrefix(ctx, sid)}מטלות פתוחות${week ? ' השבוע' : ''}.${emoji(ctx, '✅')}`);
  const inSub = subject ? ` ב${subjName(subject)}` : '';
  let text = upcoming.length ? `יש ${childPrefix(ctx, sid)}${upcoming.length === 1 ? 'מטלה אחת' : `${upcoming.length} מטלות`}${inSub} להגשה${week ? ' השבוע' : ''}.` : '';
  if (late.length) text += `${text ? ' ' : ''}שימו לב: ${late.length === 1 ? 'מטלה אחת עברה' : late.length + ' מטלות עברו'} את מועד ההגשה ולא ${late.length === 1 ? 'הוגשה' : 'הוגשו'}.`;
  return reply(text, { cards: [...late, ...upcoming].map(a => ({ type: 'assignment', ...a })) });
}

function scheduleAnswer(ctx, sid, d) {
  const r = T.getSchedule(ctx, { studentId: sid, dayOffsetN: d });
  const label = d === 0 ? 'היום' : d === 1 ? 'מחר' : `ביום ${dayName(r.date)}`;
  if (r.calendar) return r.events.length
    ? reply(`${label} (${fmtDate(r.date)}) יש ביומן שלך ${r.events.length} אירועים.`, { cards: [{ type: 'events', date: r.date, events: r.events }] })
    : reply(`${label} (${fmtDate(r.date)}) אין אירועים ביומן שלך.`);
  if (r.weekend) return reply(`${label} (${dayName(r.date)}) אין${ctx.role === 'parent' ? ` ל${nameOf(sid)}` : ''} לימודים.`, { chips: ['מה יש ביום ראשון?'] });
  const changes = r.data.filter(l => l.change);
  let text = `${label} (יום ${dayName(r.date)}, ${fmtDate(r.date)}) ${ctx.role === 'parent' ? `יש ל${nameOf(sid)}` : 'יש לך'} ${r.data.length} שיעורים, ${r.data[0].start}–${r.data[r.data.length - 1].end}.`;
  if (changes.length) text += ` ${changes.length === 1 ? 'יש שינוי אחד' : `יש ${changes.length} שינויים`} – מסומן בכתום.`;
  return reply(text, { cards: [{ type: 'schedule', studentId: sid, date: r.date, lessons: r.data, source: r.source, fetchedAt: r.fetchedAt }] });
}

function attendanceAnswer(ctx, sid) {
  const r = T.getAttendance(ctx, { studentId: sid, days: 30 });
  const abs = r.data.filter(a => a.status === 'absent').length, late = r.data.filter(a => a.status === 'late').length;
  const who = ctx.role === 'parent' ? ` ל${nameOf(sid)}` : '';
  if (!r.data.length) return reply(`ב-30 הימים האחרונים אין${who} היעדרויות או איחורים.${emoji(ctx, '👍')}`);
  return reply(`ב-30 הימים האחרונים${who ? ` היו${who}` : ''}: **${abs}** היעדרויות ו-**${late}** איחורים.`, { cards: r.data.map(a => ({ type: 'attendance', ...a })) });
}

function announcementsAnswer(ctx, sid) {
  const r = T.getAnnouncements(ctx, { studentId: sid });
  if (!r.data.length) return reply('אין הודעות חדשות מהמורים.');
  // external text is shown as data, never followed as an instruction (spec 02, T5)
  return reply(`יש ${r.data.length} הודעות אחרונות מהמורים${ctx.role === 'parent' ? ` בכיתה של ${nameOf(sid)}` : ''}:`, { cards: r.data.slice(0, 4).map(m => ({ type: 'announcement', ...m, teacherName: m.teacherName || (TEACHERS.find(t => t.id === m.teacherId) || {}).name || '' })) });
}

function weeklySummary(ctx, sid) {
  const name = nameOf(sid);
  const grades = T.getGrades(ctx, { studentId: sid }).data.filter(x => NOW - new Date(x.date) < 21 * 864e5);
  const asg = T.getAssignments(ctx, { studentId: sid, status: 'pending' }).data;
  const late = asg.filter(a => new Date(a.due) < NOW);
  const att = T.getAttendance(ctx, { studentId: sid, days: 30 }).data.filter(a => a.status === 'absent');
  const low = grades.filter(x => x.score < 70);
  const parts = [`ציונים חדשים (3 שבועות): ${grades.length}${low.length ? `, מתוכם ${low.length} מתחת ל-70` : ''}`,
    `מטלות פתוחות: ${asg.length}${late.length ? ` (${late.length} באיחור)` : ''}`,
    `היעדרויות בחודש האחרון: ${att.length}`];
  return reply(`סיכום ל${name}:\n• ${parts.join('\n• ')}`, { cards: [...low.map(x => ({ ...x, gtype: x.type, type: 'grade' })), ...late.map(a => ({ type: 'assignment', ...a }))] });
}

// ---- drafting a message (spec 04/18): creates a pending action, never sends ----
function draftRoute(ctx, t, raw, sid, convo) {
  const u = ctx.user, stu = STUDENTS.find(s => s.id === sid);
  if (/(מטומטמ|טיפש|שונא|דביל|מגעיל|סתום|אידיוט|תמות)/.test(t)) {
    return reply('את זה אני לא אנסח – הודעה פוגענית לא תעזור לך. רוצה שאעזור לנסח את מה שמפריע לך בצורה שתעבוד יותר טוב?', { chips: ['תנסחי למורה בנימוס שאני לא מסכים עם הציון'] });
  }
  const teachers = T.listMyTeachers(ctx, { studentId: sid });
  const subject = findSubject(t);
  let teacher = null;
  if (/מחנ[כך]/.test(t)) teacher = teachers.find(x => x.homeroom);
  if (!teacher && subject) teacher = teachers.find(x => x.subjectIds.includes(subject));
  if (!teacher) teacher = teachers.find(x => t.includes(firstName(x.name)));
  if (!teacher && teachers.length === 1) teacher = teachers[0];
  if (!teacher) {
    return reply('לאיזה מורה לשלוח?', { chips: teachers.slice(0, 6).map(x => `${raw.replace(/למורה( שלי)?/, '')} ל${x.homeroom ? 'מחנכת' : 'מורה ל' + x.subjects[0]}`.replace(/\s+/g, ' ').trim()) });
  }
  const { body, subj } = composeBody(ctx, t, raw, stu, teacher);
  const { actionId, confirmToken } = T.draftMessage(ctx, { studentId: sid, teacherId: teacher.id, subject: subj, body });
  return reply('הנה טיוטה – אפשר לערוך לפני השליחה. שום דבר לא נשלח בלי אישור שלך.', {
    cards: [{ type: 'action', actionId, confirmToken, to: teacher, subject: subj, body }],
  });
}

function composeBody(ctx, t, raw, stu, teacher) {
  const u = ctx.user, parent = ctx.role === 'parent';
  const greet = /היי המורה/.test(prefs(ctx)) ? 'היי המורה,' : parent ? `שלום ${teacher.name},` : `שלום ${g(teacher, 'המורה', 'המורה')},`;
  const sign = parent ? `תודה,\n${u.name} (${g(u, 'אבא', 'אמא')} של ${firstName(stu.name)})` : `תודה,\n${firstName(u.name)}`;
  const because = (raw.match(/בגלל ([^,.!?]+)/) || [])[1];
  const when = /מחר/.test(t) ? 'מחר' : 'היום';
  let line, subj;
  if (/(חול|לא מרגיש)/.test(t)) {
    subj = 'היעדרות';
    line = parent ? `${firstName(stu.name)} ${g(stu, 'חולה', 'חולה')} ${when} ולא ${g(stu, 'יגיע', 'תגיע')} לבית הספר.` : `אני חולה ${when} ולא אוכל להגיע לשיעור. אשלים את החומר בהקדם.`;
  } else if (/(לא אגיע|לא יגיע|לא תגיע|אעדר|יעדר|תיעדר|היעדר)/.test(t)) {
    subj = 'היעדרות';
    line = parent ? `${firstName(stu.name)} ${g(stu, 'ייעדר', 'תיעדר')} ${when}${because ? ` בגלל ${because}` : ''}.` : `לא אוכל להגיע ${when}${because ? ` בגלל ${because}` : ''}. אשלים את החומר בהקדם.`;
  } else if (/תודה/.test(t)) {
    subj = 'תודה';
    const what = (raw.match(/תודה על ([^,.!?]+)/) || [])[1];
    line = `רציתי להגיד תודה${what ? ` על ${what}` : ''}.`;
  } else if (/(הארכה|לדחות|יותר זמן)/.test(t)) {
    subj = 'בקשת הארכה';
    line = `${parent ? `רציתי לבקש עבור ${firstName(stu.name)}` : 'רציתי לבקש'} הארכה קצרה להגשת המטלה${teacher.subjects[0] ? ` ב${teacher.subjects[0]}` : ''}. אשמח לדעת אם זה אפשרי.`;
  } else if (/(לא מסכים|לא מסכימה|ציון)/.test(t)) {
    subj = 'שאלה על ציון';
    line = 'רציתי לשאול לגבי הציון שלי במבחן האחרון. אשמח אם נוכל לעבור עליו יחד כדי שאבין מה פספסתי.';
  } else {
    subj = 'פנייה';
    const content = (raw.match(/ש(.{4,})$/) || [])[1];
    line = content ? `רציתי לעדכן ש${content.trim().replace(/[.!]*$/, '')}.` : 'רציתי לשאול שאלה קצרה.';
  }
  return { body: `${greet}\n${line}\n${sign}`, subj };
}

// ---- teacher (spec 08) ----
function teacherRoute(ctx, t) {
  const classId = findClass(t) || (ctx.homeroom || 'c-9-2');
  const subject = findSubject(t);
  if (/(הודעות|תיבה|פניות)/.test(t) && !/(מי|ממוצע)/.test(t)) {
    const msgs = db().inbox.filter(m => m.teacherId === ctx.userId);
    const unread = msgs.filter(m => !m.read).length;
    return reply(msgs.length ? `יש לך ${msgs.length} הודעות, ${unread} לא נקראו. אפשר לראות אותן בלשונית "הודעות".` : 'עוד אין הודעות דרך אלומה.');
  }
  if (/(היעדר|נוכחות|חיסור)/.test(t)) {
    const n = +(t.match(/(\d+)\s*היעדר/) || t.match(/מ-?(\d+)/) || [])[1] || 3;
    const r = T.classAttendance(ctx, { classId, threshold: n });
    return reply(r.rows.length ? `ב${r.className}, ${r.rows.length} תלמידים עם ${n} היעדרויות ומעלה ב-30 הימים האחרונים:` : `אין ב${r.className} תלמידים עם ${n} היעדרויות ומעלה.`, { cards: r.rows.length ? [{ type: 'list', title: `היעדרויות – ${r.className}`, rows: r.rows.map(x => [x.name, `${x.count}`]) }] : [] });
  }
  if (/(ממוצע|מבחן)/.test(t)) {
    const r = T.classSummary(ctx, { classId, subject });
    if (!r.exam) return reply('אין מבחנים במערכת.');
    return reply(`במבחן האחרון ב${subjectName(r.subject)} ב${r.className} ("${r.exam.title}"): ממוצע **${r.exam.avg}**, טווח ${r.exam.min}–${r.exam.max}, ${r.exam.n} נבחנים.`, { cards: [{ type: 'stat', label: `ממוצע – ${r.className}`, value: r.exam.avg, source: 'משוב', fetchedAt: NOW.toISOString() }] });
  }
  if (/(לא הגיש|הגישו|הגשות|מטלה|עבודה)/.test(t)) {
    const r = T.classSummary(ctx, { classId, subject });
    if (!r.assignment) return reply('לא מצאתי מטלה במקצוע הזה.');
    return reply(`"${r.assignment.title}" (${subjectName(r.subject)}, ${r.className}): ${r.total - r.missing.length} מתוך ${r.total} הגישו.`, { cards: r.missing.length ? [{ type: 'list', title: 'עוד לא הגישו', rows: r.missing.map(n => [n, '']) }] : [] });
  }
  if (/(שלום|היי|עזרה|מה את יודעת)/.test(t)) return reply('אני יכולה לעזור עם הכיתות שלך: מי לא הגיש, ממוצעים במבחנים, היעדרויות (למחנכים) וסיכום ההודעות.', { chips: DEFAULT_CHIPS.teacher });
  return reply('אפשר לשאול אותי על הכיתות שלך, למשל:', { chips: DEFAULT_CHIPS.teacher });
}

// fixed safety answers run before any AI model (spec 18)
answer.safety = (ctx, raw) => /(להתאבד|לפגוע בעצמי|רוצה למות|אין לי טעם לחיות|מרביצים לי|מאיימים עליי|פוגעים בי|מציקים לי ברשת|מפיצים עליי)/.test(norm(raw));

// ---------- hybrid routing (ה): which questions the fast local engine answers by itself ----------
// A keyword alone is not enough (it caused wrong fast answers, e.g. "איזה ציון צריך כדי לעבור?" got a grades
// list). A question goes to the fast engine only when ALL of these hold – each check is pure and takes <1ms:
//   1. keyword  – a known data intent matches;
//   2. coverage – EVERY word of the question is explained by that intent's vocabulary (plus question words,
//      time words, subject / course / child / class names). One unexplained word → the language model answers;
//   3. question word – "מתי" needs a date intent, "מי" a people intent, "כמה" a counting intent;
//   4. memory   – phrasings the user marked "not what I asked" never go to the fast engine again.
// No side effects (never creates drafts or saves memories).
// questions that need the language model – matched as WHOLE words (with an optional prefix), never inside
// another word ("אלמה" is not "למה", "השלמה" is not "למה")
const COMPLEX_WORDS = 'למה מדוע איך כיצד איפה לאן תסביר הסבר תסבירי תכנן תתכנני רעיון רעיונות תיצור תיצרי צור צרי תנסח תכתוב תכתבי תשלח תשלחי נסחי כתבי השווי השוואה ההבדל תעזרי תעזור עזרה תמליצי תמליץ המלצה המלצות דעתך תסכמי תסכם סכמי קובץ מסמך drive מסלול כרטיסיות כרטיסייה כרטיסים פרויקט פרוייקט כדאי תפתרי תפתור תכיני תכין טיפים טיפ לשפר להתכונן דורש דורשת לדחות לעשות אומר אם';
const COMPLEX_SET = new Set(COMPLEX_WORDS.split(' '));
const COMPLEX = { test: t => t.split(/\s+/).some(w => COMPLEX_SET.has(w) || (w.length > 3 && /^[ושהבלכמ]/.test(w) && COMPLEX_SET.has(w.slice(1)))) };
// everyday phrasings of simple questions → the template the fast engine knows ("איך הלך לי במבחן" = "מה קיבלתי במבחן")
const PHRASES = [
  [/(^| )איך (הלך|היה|יצא) (לי|לו|לה) /g, '$1מה קיבלתי '], [/(^| )איך (יצאתי|יצא|יצאה) /g, '$1מה קיבלתי '], [/(^| )מה (יצא|הוצאתי|השגתי)( לי)? /g, '$1מה קיבלתי '], [/(^| )(הוצאתי|השגתי|יצא לי) /g, '$1קיבלתי '],
  [/(^| )מה (עם|לגבי) /g, '$1מה '], [/(^| )(תגידי לי|תגיד לי|תראי לי|תראה לי|אפשר לראות|אני רוצה לדעת|רציתי לדעת|רק רציתי לשאול|שאלה|רגע|בבקשה|אלומה) /g, '$1'],
  [/(^| )(מה אני צריך|מה אני צריכה|מה צריך|יש משהו|יש לי משהו) להגיש /g, '$1מה להגיש '], [/(^| )(מה המצב עם|מה קורה עם) /g, '$1מה המצב של '],
  [/(^| )איך קוראים ל/g, '$1מי ה'], [/(^| )איך ([^ ]+) (בלימודים|בבית הספר|בבית ספר) /g, '$1מה המצב של $2 '], [/(^| )מה שלום ([^ ]+) (בלימודים|בבית הספר|בבית ספר) /g, '$1מה המצב של $2 '],
  [/(^| )(תזכירי|תזכיר|תזכרי) לי (?=(מה|מתי|איזה|איזו|כמה|מי) )/g, '$1'],   // "תזכירי לי מה להגיש" = "מה להגיש" ("תזכרי ש…" stays a memory)
  [/(^| )שיעורי (ה)?בית /g, '$1מטלות '], [/(^| )(דדליין|הדדליין|דד ליין|דדלין|הדדלין) /g, '$1מועד ההגשה '],
  [/(^| )([בל]?)(ז|ח|ט|י|יא|יב) (\d)(?= )/g, '$1$2$3$4'], [/(^| )(היי|הי|אהלן|שלום) (?=[^ ]+ [^ ]+)/g, '$1'],
];
function applyPhrases(s) { let t = ' ' + s.replace(/([?!.,:;])/g, ' $1 ') + ' '; for (let i = 0; i < 2; i++) for (const [re, to] of PHRASES) t = t.replace(re, to); return t.replace(/\s+([?!.,:;])/g, '$1').replace(/\s+/g, ' ').trim(); }
const basic = raw => norm(String(raw || '').replace(/ש[.״"'׳]\s?ב(?=[\s?!.,]|$)/g, 'שב')).toLowerCase().replace(/[?!.,:;()״"׳'\-–]/g, ' ').replace(/\s+/g, ' ').trim();
export function canonical(raw) { return applyPhrases(basic(raw)); }
const W = s => new Set(s.split(' '));
const VOCAB = {
  common: W('אלומה הכול הכל היי הי אהלן אפשר תביאי תביא הביאי תני תן מצב המצב מה מתי כמה איזה איזו אילו יש אין לי שלי שלו שלה שלהם אני את אתה של על עם גם עוד כל תודה תגידי תגיד תראי תראה הראי הראה לראות רוצה לדעת תבדקי בדיקה היום מחר מחרתיים אתמול השבוע שבוע הבא הבאה הקרוב הקרובים החודש עכשיו אחרון אחרונה האחרון האחרונה אחרונים אחרונות האחרונים האחרונות לאחרונה חדש חדשה חדשות חדשים כרגע עד כבר עדיין ימים יום ראשון שני שלישי רביעי חמישי שישי שבת הוא היא הם הילד הבן הבת ילד בן בת ילדים הילדים שלנו שלהם אותי אותו אותה אצלי'),
  grades: W('הוצאתי השגתי ציון ציונים קיבלתי קיבל קיבלה קיבלו קיבלנו מבחן מבחנים בוחן בחנים בגרות עבודה עבודות תוצאות על במקצוע מקצוע הקודם הקודמת שעבר שעברה הראשון הראשונה השני חזר חזרו בדק בדקו כבר הכי גבוה נמוך הגבוה הנמוך ביותר טוב גרוע'),
  average: W('תחשבי חשבי תחשב ממוצע ממוצעים ציונים מבחנים כללי הכללי הכי גבוה נמוך חלש חלשה חזק חזקה טוב טובה גרוע מקצוע מקצועות באיזה ביותר אני'),
  assignments: W('מגיש מגישה מגישים להגיש הגשה הגשות מטלה מטלות שב באיחור איחור פתוחות פתוחה פתוחים הוגשו הגשתי הגיש הגישה אני צריך צריכה עבודה עבודות על עד מועד תאריך דף תרגיל בכלל לא שלא הוגש מחר למחר ההגשה'),
  attendance: W('לא הגעתי הגיע הגיעה הייתי היה שיעורים היעדרות היעדרויות נוכחות חיסור חיסורים איחורים איחרתי איחר איחרה נעדרתי נעדר נעדרה החסרתי חיסרתי חיסר פעמים פעם ימים'),
  announcements: W('הודעות הודעה עדכונים עדכון חדש מהמורים מורים המורה מורה מחנכת המחנכת מחנך המחנך שלחו בכיתות בכיתה כיתה מה כתבה כתב כתבו שלחה שלח מבית הספר ספר בית'),
  schedule: W('מערכת שעות שעה שיעורים שיעור ביומן יומן לוח אירועים אירוע חדר מתחיל מתחילה מתחילים נגמר נגמרים נגמרת מסיים מסיימת מסיימים סוף ראשון הבא לימודים שינויים שינוי ביטול מבוטל בוטל באיזה באיזו עכשיו כרגע'),
  teachers: W('נותן נותנת שיעור השיעור מי מורה המורה מורים המורים מחנכת המחנכת מחנך המחנך מלמד מלמדת מלמדים אותי שלי'),
  progress: W('אספתי אספתי קיבלתי יש xp רמה הרמה באיזו נקודות קלפים הקלפים הישגים ההישגים תיבות תיבה התקדמות ההתקדמות פרסים צברתי לפתוח לפתיחה פתוחות'),
  hello: W('שלום היי הי בוקר טוב ערב צהריים טובים מי יודעת יכולה לעשות אלומה נשמע שלומך קורה'),
  thanks: W('תודה רבה אוקיי אוקי סבבה מעולה יופי אחלה הבנתי לך'),
  weekly: W('מצב המצב סיכום שבועי שלומו שלומה שלום בלימודים לימודים בבית הספר ספר'),
  not_connected: W('היעדרות היעדרויות נוכחות איחור איחורים חיסורים חיסרתי נעדרתי מערכת שעות שיעורים שיעור יש מחר היום לוז'),
  inbox: W('הודעות תיבה פניות חדשות הודעה בתיבת'),
  class_attendance: W('היעדרויות היעדרות נוכחות חיסורים מעל יותר מ תלמידים מי עם'),
  class_exam: W('ממוצע מבחן אחרון במבחן הכיתה כיתה'),
  class_missing: W('לא הגיש הגישו הגשות מי המטלה מטלה תלמידים עבודה העבודה'),
};
// words that are never learned as "simple" – they change what a question means
const NEVER_LEARN = W('לא אל למה איך כדי אם צריך צריכה עצוב עצובה לחוץ לחוצה מפחד מפחדת הוגן הוגנת לשפר טיפים זה אומר דורש דורשת לעשות לדחות עזרה תעזרי מרגיש מרגישה כועס כועסת קשה');
// which intents can answer which question word
const QWORD = { 'מתי': ['schedule', 'assignments', 'not_connected'], 'מי': ['class_missing', 'class_attendance', 'hello', 'teachers'], 'כמה': ['schedule', 'not_connected', 'grades', 'average', 'attendance', 'assignments', 'progress', 'inbox', 'announcements', 'class_attendance', 'class_exam', 'class_missing'] };

// ---- light Hebrew stemming: prefixes ו ה ב ל מ ש כ, and common endings ----
const SUF = /(יות|ים|ות|תי|נו|תם|תן|ה|ת|ו|י)$/;
const FINALS = { 'ם': 'מ', 'ן': 'נ', 'ץ': 'צ', 'ף': 'פ', 'ך': 'כ' };
const finals = x => x.replace(/[םןץףך]/g, c => FINALS[c]);
// a word's "skeleton": no vowel letters ו/י after the first letter, normal (non-final) letters –
// פרסמו / פורסם / פרסמה all share the skeleton פרסמ
export const skel = x => finals(x[0] + x.slice(1).replace(/[וי]/g, ''));
function stems(w) {
  const out = new Set([w]); let cur = [w];
  for (let i = 0; i < 3; i++) { const next = []; for (const x of cur) if (/^(ו|ה|ב|ל|מ|ש|כ)/.test(x) && x.length > 3) { out.add(x.slice(1)); next.push(x.slice(1)); } cur = next; }
  if (/^(ו|ה|ב|ל|מ|ש|כ)/.test(w) && w.length === 3) out.add(w.slice(1));       // "בט2" → "ט2"
  for (const x of [...out]) { const m = x.match(SUF); if (m && x.length - m[0].length >= 3) out.add(x.slice(0, -m[0].length)); }
  for (const x of [...out]) out.add(finals(x));
  return out;
}
const skels = w => new Set([...stems(w)].filter(x => x.length >= 3).map(skel));
const mainStem = w => { const all = [...stems(w)]; return all.sort((a, b) => a.length - b.length)[0]; };
const stemSetCache = new WeakMap();
function stemSet(set) { let r = stemSetCache.get(set); if (!r) { r = new Set(); for (const w of set) for (const x of stems(w)) r.add(x); stemSetCache.set(set, r); } return r; }
const explainedBy = (w, ...sets) => /^\d+$/.test(w) || w.length < 2 || [...stems(w)].some(x => sets.some(st => st.has(x)));

// ---- typo tolerance, the Hebrew way ----
// Real Hebrew misspellings are mostly full/defective spelling (an extra or missing י ו א ה: קבלתי/קיבלתי,
// הסטוריה/היסטוריה) or letters that sound alike (ט/ת כ/ח ס/ש ק/כ א/ע). Only those are corrected –
// a random one-letter change would turn real words into keywords (חיבור ≠ חיסור).
const SOFT = new Set(['י', 'ו', 'א', 'ה']);
const ALIKE = new Set(['טת', 'תט', 'כח', 'חכ', 'סש', 'שס', 'קכ', 'כק', 'אע', 'עא', 'בו', 'וב']);
function lev1(a, b) {
  if (a === b) return true;
  if (a.length === b.length) { let k = -1; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) { if (k >= 0) return false; k = i; } return ALIKE.has(a[k] + b[k]); }
  if (Math.abs(a.length - b.length) !== 1) return false;
  const [L, S] = a.length > b.length ? [a, b] : [b, a];
  for (let i = 0; i < L.length; i++) if (L.slice(0, i) + L.slice(i + 1) === S) return SOFT.has(L[i]);
  return false;
}
let lexCache = null;
function lexicon(names) {
  if (lexCache && lexCache.names === names) return lexCache.words;
  const words = new Set(); for (const v of Object.values(VOCAB)) for (const w of v) if (w.length >= 4) words.add(w);
  for (const n of names) if (n.length >= 4) words.add(n);
  lexCache = { names, words: [...words] }; return lexCache.words;
}
// is `full` the same word as `short` with one ו / י added? (ממצע → ממוצע, עכשו → עכשיו, הום → היום)
const addsVowel = (short, full) => full.length === short.length + 1 && [...full].some((c, i) => (c === 'ו' || c === 'י') && full.slice(0, i) + full.slice(i + 1) === short);
// a word we know exactly (in a vocabulary or a name, possibly with 1–2 prefix letters) is never "corrected"
function knownExactly(w, names) {
  const forms = [w]; if (/^[ובהלמשכ]/.test(w)) { forms.push(w.slice(1)); if (/^[ובהלמשכ]/.test(w.slice(1))) forms.push(w.slice(2)); }   // only real prefix letters
  for (const f of forms) if (f.length >= 2 && (names.has(f) || Object.values(VOCAB).some(v => v.has(f)))) return true;
  return false;
}
function correct(t, names, extra) {
  const lex = lexicon(names), lexAll = lexAll3(names);
  return t.split(' ').map(w => {
    if (w.length < 3 || /\d/.test(w) || knownExactly(w, names) || [...stems(w)].some(x => extra.has(x))) return w;
    const pres = ['']; if (/^[ובהלמשכ]/.test(w)) { pres.push(w[0]); if (/^[ובהלמשכ]/.test(w[1])) pres.push(w.slice(0, 2)); }   // only real prefix letters ("יצאתי" ≠ יצ + "אותי")
    for (const pre of pres) {
      const core = w.slice(pre.length); if (core.length < 3) continue;
      const add = lexAll.find(L => addsVowel(core, L)); if (add) return pre + add;            // full spelling: safe from 3 letters
      if (core.length >= 5) { const hit = lex.find(L => lev1(core, L)); if (hit) return pre + hit; }   // other slips: 5+ letters only (איתי ≠ אותי)
    }
    return w;
  }).join(' ');
}
let lex3 = null;
function lexAll3(names) {
  if (lex3 && lex3.names === names) return lex3.words;
  const words = new Set(); for (const v of Object.values(VOCAB)) for (const w of v) if (w.length >= 3) words.add(w);
  for (const n of names) if (n.length >= 3) words.add(n);
  for (const d of ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'היום', 'השבוע', 'עכשיו', 'שיעור', 'השיעור', 'שיעורים', 'שיעורי', 'לימודים', 'ביטולים', 'קוראים', 'יצאתי', 'הגעתי']) words.add(d);
  lex3 = { names, words: [...words] }; return lex3.words;
}

// words that appear in the user's OWN data (exam and assignment titles, teachers) – the fast engine can answer about them
let dataWordsCache = { key: '', at: 0, grades: new Set(), assignments: new Set() };
function dataWords(ctx) {
  const key = ctx.userId + '|' + (ctx.allowedStudentIds || []).join(',');
  if (dataWordsCache.key === key && Date.now() - dataWordsCache.at < 60000) return dataWordsCache;
  const grades = new Set(), assignments = new Set();
  const add = (set, title) => norm(String(title || '')).toLowerCase().replace(/[?!.,:;()–\-"״׳']/g, ' ').split(' ').filter(w => w.length > 1).forEach(w => { set.add(w); set.add(w.replace(/^(ה|ו|ב|ל)/, '')); });
  for (const sid of ctx.allowedStudentIds || []) {
    try { T.getGrades(ctx, { studentId: sid, quiet: true }).data.forEach(g => add(grades, g.title)); } catch { /* no access */ }
    try { T.getAssignments(ctx, { studentId: sid, quiet: true }).data.forEach(a => add(assignments, a.title)); } catch { /* no access */ }
  }
  return (dataWordsCache = { key, at: Date.now(), grades: stemSet(grades), assignments: stemSet(assignments) });
}
let namesCache = { key: '', set: null };
function knownNames(ctx) {
  const key = ctx.userId + '|' + (LIVE.courses || []).length;
  if (namesCache.key === key) return namesCache.set;
  const n = new Set();
  for (const s of SUBJECTS) for (const a of s.aliases) norm(a).split(' ').forEach(x => n.add(x));
  for (const c of LIVE.courses || []) norm(c.name).toLowerCase().split(' ').forEach(x => n.add(x));
  for (const c of CLASSES) n.add(norm(c.name).replace(/\s/g, ''));
  for (const id of ctx.allowedStudentIds || []) { const s = STUDENTS.find(x => x.id === id); if (s) s.name.split(' ').forEach(x => n.add(x)); }
  for (const t of TEACHERS) t.name.split(' ').forEach(x => n.add(x));
  for (const s of OTHER_SUBJECTS) for (const a of s.aliases) if (!a.includes(' ')) n.add(a);     // multi-word names only as a whole phrase (see below)
  ['ט2', 'ז1', 'יא3', 'ט', 'ז', 'יא', 'כיתה'].forEach(x => n.add(x));
  return (namesCache = { key, set: n }).set;
}
export const phraseKey = raw => [...new Set(canonical(raw).split(' ').filter(w => w.length > 1))].sort().join(' ');

// ---- learning that generalises ----
// The slow model teaches the fast one. When Gemini answered a short question with exactly ONE data tool,
// the router learns the WORDS (their stems) that were missing for that topic – so next time any phrasing
// that uses them is answered fast, not just the same sentence. It also keeps the question as an example
// for questions with no keyword at all (nearest example by shared stems). "Not what I asked" / 👎 unlearns.
const TOOL_INTENT = { get_grades: ['grades', 'average'], get_assignments: ['assignments'], get_schedule: ['schedule'], get_attendance: ['attendance'], get_announcements: ['announcements'], get_my_progress: ['progress'], list_my_teachers: ['teachers'] };
const learnStore = () => { const L = (db().routerLearn = db().routerLearn || { vocab: {}, examples: [] }); L.blocked = L.blocked || {}; return L; };
// ---- shared learning (all users) ----
// Only single WORD stems + their topic are ever shared – never sentences, names or anything personal.
// The server publishes a word only after 3 different users taught it (and few marked it wrong), so one user
// can neither spread a private word nor "poison" the router. A user's own "not what I asked" blocks a shared
// word for them at once and votes against it.
const SENSITIVE = W('חולה חולים מחלה מחלות בריאות דיכאון חרדה תרופה תרופות טיפול פסיכולוג אבא אמא הורים גירושים גרושים כסף משכורת חוב כתובת טלפון מספר רחוב גר גרה דת דתי חילוני מוות מת נפטר אלימות מכות סמים אלכוהול סקס הריון משטרה עבירה עונש');
const SHAREABLE = new Set(['grades', 'average', 'assignments', 'attendance', 'announcements', 'schedule', 'progress', 'teachers']);
let SHARED = {}; let sink = null;
// seed knowledge shipped with the app (tools/train-router.mjs, from tests/teach-list.mjs) – trusted like the base vocabulary
const SEED = Object.fromEntries(Object.entries(SEED_LIST || {}).map(([it, keys]) => [it, Object.fromEntries(keys.map(k => [k, 1]))]));
export function setSharedVocab(v) {
  SHARED = {};
  for (const [it, words] of Object.entries(v || {})) if (SHAREABLE.has(it) && words && typeof words === 'object')
    SHARED[it] = Object.fromEntries(Object.keys(words).filter(k => /^~?[\u05D0-\u05EAa-z0-9]{2,20}$/.test(k)).slice(0, 2000).map(k => [k, 1]));
}
export const sharedSize = () => Object.values(SHARED).reduce((a, v) => a + Object.keys(v).filter(k => !k.startsWith('~')).length, 0);
export const setLearnSink = fn => { sink = fn; };
const shareable = (w, names) => w.length >= 3 && !/\d/.test(w) && ![...stems(w)].some(x => SENSITIVE.has(x) || NEVER_LEARN.has(x) || names.has(x));
const qStems = t => [...new Set(t.split(' ').filter(w => w.length > 1).map(w => skel(mainStem(w))))];
const jaccard = (a, b) => { const A = new Set(a), B = new Set(b); let i = 0; for (const x of A) if (B.has(x)) i++; return i / (A.size + B.size - i || 1); };
function learnedVocab(it) { const v = learnStore().vocab[it] || {}; return new Set(Object.keys(v).filter(k => v[k] > 0)); }
// learned words are stored as skeletons, so every form of the word matches
// a learned word is kept as its stem and as its skeleton; the skeleton only counts when it has 4+ letters
// (short roots collide: חיבור "essay" and חברים "friends" share חבר)
const hitIn = (v, w, blocked) => [...stems(w)].some(x => v[x] > 0 && !blocked[x]) || [...skels(w)].some(k => k.length >= 4 && v['~' + k] > 0 && !blocked['~' + k]);
const learnedHit = (w, it) => { const L = learnStore(); return hitIn(L.vocab[it] || {}, w, {}) || hitIn(SEED[it] || {}, w, L.blocked) || hitIn(SHARED[it] || {}, w, L.blocked); };
const learnedTopics = () => [...new Set([...Object.keys(learnStore().vocab), ...Object.keys(SEED), ...Object.keys(SHARED)])];
// what a lesson stores: a careful stem (only the prefixes ו ה ב ל ש כ – a leading מ is usually part of the
// word: מחברת ≠ חבר – and only plural endings) plus its skeleton for the other forms of the word
function learnStem(w) {
  // one prefix at most (two only after ו: "ובמבחן"), and only ו ה ב ל – ש כ מ are too often part of the word
  // (שכחתי, שיעור, כוכבים, מחברת); "בבחינה" keeps its second ב
  let x = w;
  if (/^ו[הבל]/.test(x) && x.length - 2 >= 3) x = x.slice(2); else if (/^[והבל]/.test(x) && x.length - 1 >= 3) x = x.slice(1);
  if (/(ים|ות)$/.test(x) && x.length - 2 >= 3) x = x.slice(0, -2);
  return finals(x);
}
const learnKeys = w => { const m = learnStem(w); const core = m.length - 1 >= 4 ? m.replace(/(ו|ה|ת|י)$/, '') : m; return [m, '~' + skel(core)]; };
function teach(ctx, raw, it) {
  const names = knownNames(ctx);
  const t = correct(canonical(raw), names, new Set());
  const words = t.split(' ');
  if (words.length > 12 || COMPLEX.test(t + ' ')) return false;
  const base = [stemSet(VOCAB[it] || new Set()), stemSet(VOCAB.common), stemSet(names)];
  const others = Object.entries(VOCAB).filter(([k]) => k !== it && SHAREABLE.has(k)).map(([, v]) => stemSet(v));   // real topics only
  const fresh = words.filter(w => w.length > 1 && !/^\d+$/.test(w) && !explainedBy(w, ...base) && !explainedBy(w, ...others));   // "שיעורים" is a timetable word – never learned as attendance
  if (fresh.some(w => [...stems(w)].some(x => NEVER_LEARN.has(x)))) return false;     // "לא", "למה", "הוגן"… change the meaning
  const L = learnStore(); const v = (L.vocab[it] = L.vocab[it] || {});
  for (const w of fresh) if (w.length >= 3) for (const k of learnKeys(w)) if (k.replace(/^~/, '').length >= 3) { v[k] = (v[k] || 0) + 1; delete L.blocked[k]; }
  const share = fresh.filter(w => shareable(w, names)).flatMap(learnKeys);
  if (sink && share.length && SHAREABLE.has(it)) try { sink({ intent: it, keys: share.slice(0, 12), vote: 1 }); } catch { /* offline */ }
  L.examples = L.examples.filter(e => jaccard(e.s, qStems(t)) < 0.95);
  L.examples.push({ s: qStems(t), it, ok: true }); if (L.examples.length > 400) L.examples.shift();
  save(); return true;
}
export function learnFromModel(ctx, raw, toolsUsed) {
  if (!toolsUsed || toolsUsed.length !== 1 || !TOOL_INTENT[toolsUsed[0]]) return false;
  const t = correct(canonical(raw), knownNames(ctx), new Set());
  const k = keywordIntent(ctx, t);
  return teach(ctx, raw, TOOL_INTENT[toolsUsed[0]].includes(k) ? k : TOOL_INTENT[toolsUsed[0]][0]);
}
export const rememberHit = (ctx, raw, it) => teach(ctx, raw, it);
export function rememberMiss(ctx, raw) {
  const L = learnStore(); const t = correct(canonical(raw), knownNames(ctx), new Set()); const st = qStems(t);
  for (const v of Object.values(L.vocab)) for (const w of t.split(' ')) { for (const k of stems(w)) if (v[k]) v[k] = 0; for (const k of skels(w)) if (v['~' + k]) v['~' + k] = 0; }   // unlearn these words
  // seed words in this question: blocked for this user (the seed ships with the app – no vote needed)
  for (const v of Object.values(SEED)) for (const w of t.split(' ')) { for (const k of stems(w)) if (v[k]) L.blocked[k] = 1; for (const k of skels(w)) if (v['~' + k]) L.blocked['~' + k] = 1; }
  // shared words in this question: blocked for this user now, and a vote against them
  for (const [it, v] of Object.entries(SHARED)) {
    const keys = [];
    for (const w of t.split(' ')) { for (const k of stems(w)) if (v[k]) { L.blocked[k] = 1; keys.push(k); } for (const k of skels(w)) if (v['~' + k]) { L.blocked['~' + k] = 1; keys.push('~' + k); } }
    if (sink && keys.length) try { sink({ intent: it, keys: [...new Set(keys)].slice(0, 12), vote: -1 }); } catch { /* offline */ }
  }
  L.examples = L.examples.filter(e => jaccard(e.s, st) < 0.95);
  L.examples.push({ s: st, it: null, ok: false }); if (L.examples.length > 400) L.examples.shift();
  save();
}

export function keywordIntent(ctx, t) {
  if (/^(תודה|אוקיי|אוקי|סבבה|מעולה|יופי|אחלה|הבנתי|מגניב|נהדר|טוב תודה)( רבה| אלומה| לך| תודה)?$/.test(t)) return 'thanks';
  if (/^(שלום|היי|הי|בוקר טוב|ערב טוב|צהריים טובים|לילה טוב|מה נשמע|מה שלומך|מה קורה|מה המצב)( אלומה)?$/.test(t) || /^(מי את|מה את יודעת( לעשות)?|מה את יכולה( לעשות)?|עזרה|מה אפשר לשאול)$/.test(t)) return 'hello';
  if (ctx.role === 'teacher') {
    if (/(הודעות|תיבה|פניות)/.test(t) && !/(מי|ממוצע)/.test(t)) return 'inbox';
    if (/(היעדר|נוכחות|חיסור)/.test(t) && findClass(t)) return 'class_attendance';
    if (/(ממוצע|מבחן)/.test(t) && findClass(t)) return 'class_exam';
    if (/(לא הגיש|הגישו|הגשות)/.test(t) && findClass(t)) return 'class_missing';
    return null;
  }
  if (!ctx.allowedStudentIds.length) return null;
  liveMode = !!ctx.live;
  if (ctx.live && /(היעדר|נוכחות|איחור|חיסור|חיסרתי|נעדר)/.test(t)) return 'not_connected';
  if (ctx.live && !LIVE.events && (findDay(t) != null || /(מערכת|שיעור|לוז)/.test(t)) && !/(להגיש|מטל|ציון|ממוצע|הודע|קיבלתי)/.test(t)) return 'not_connected';
  if (/(xp|באיזו רמה|הרמה שלי|כמה נקודות|הקלפים שלי|כמה קלפים|הישגים|תיבות|תיבה)/i.test(t)) return 'progress';
  if (ctx.role === 'parent' && /(מה המצב|סיכום|מה שלום|שלומו|שלומה|בלימודים)/.test(t)) return 'weekly';
  if (/(היעדר|נוכחות|חיסור|חיסרתי|החסרתי|נעדרתי|נעדר|איחרתי|איחר|לא הגעתי|לא הגיע|לא הייתי בשיעור)/.test(t) || (/איחור/.test(t) && !/(מטל|הגש|עבוד)/.test(t))) return 'attendance';
  if (/ממוצע/.test(t) || (/מקצוע/.test(t) && /(הכי|ביותר|חלש|חזק|גרוע)/.test(t))) return 'average';
  if (/(ציון|ציונים|קיבלתי|קיבל|קיבלה)/.test(t)) return 'grades';
  if (/(^| )מה (ה)?(עבודה|עבודות) (ב|של)/.test(t) || /(להגיש|הגשה|הגשות|הגשתי|הוגש|מגיש|מגישה|מגישים|מטלה|מטלות|(^| )שב( |$)|באיחור|מועד ההגשה|(עבודות|עבודה) (פתוח|להגיש)|פתוחות|פתוחה)/.test(t)) return 'assignments';
  if (/(הודע|עדכו[נן]|מה חדש|(^| )(כתבה|כתב|כתבו|שלחה|שלח|שלחו)( |$))/.test(t)) return 'announcements';
  if (/(^| )מי /.test(t) && /(מורה|מורים|מחנ[כך]|מלמד|נותן|נותנת)/.test(t) || /(המורים שלי|המורה שלי ל)/.test(t)) return 'teachers';
  if (!ctx.live && (findDay(t) != null || /(מערכת|שיעור|עכשיו|כרגע)/.test(t) || (/(^| )(מתי|באיזו שעה|באיזה שעה) /.test(t) && findSubject(t)))) return 'schedule';
  if (ctx.live && LIVE.events && /(יומן|מחר|היום)/.test(t)) return 'schedule';
  return null;
}
// returns { intent, t } for the fast engine, or { intent: null, why } – "why" is kept for tests and debugging
export function routeQuestion(ctx, raw) {
  const c0 = applyPhrases(correct(applyPhrases(basic(raw)), knownNames(ctx), new Set()));   // phrasings, spelling fixes, then phrasings again ("שעורי בית")
  if (!c0 || ctx.role === 'school_admin') return { intent: null, why: 'empty' };
  if (c0.length > 80 || c0.split(' ').length > 12) return { intent: null, why: 'long' };
  const talk = keywordIntent(ctx, c0);                                 // whole-message small talk ("מה את יודעת לעשות?")
  if (talk === 'thanks' || talk === 'hello') return { intent: talk, t: c0, via: 'keyword' };
  if (COMPLEX.test(c0 + ' ')) return { intent: null, why: 'complex' };
  if (!ctx.live && ctx.role !== 'teacher') { const o = mentionedStudent(c0, ctx); if (o && !ctx.allowedStudentIds.includes(o.id)) return { intent: null, why: 'another student' }; }
  const names = knownNames(ctx);
  const t = c0;
  const st = qStems(t), L = learnStore();
  // nearest remembered example (same stems) – a remembered miss always wins
  let best = null, bs = 0; for (const e of L.examples) { const j = jaccard(e.s, st); if (j > bs) { bs = j; best = e; } }
  if (best && !best.ok && bs >= 0.8) return { intent: null, why: 'remembered miss' };
  // candidate topics, in order: the keyword · topics of learned words ("החיבורים שלי" → assignments) · the nearest example
  const cands = [];
  const kw = keywordIntent(ctx, t); if (kw) cands.push([kw, 'keyword']);
  const votes = {}; for (const w of t.split(' ')) for (const k of learnedTopics()) if (learnedHit(w, k)) votes[k] = (votes[k] || 0) + 1;
  Object.entries(votes).sort((a, b) => b[1] - a[1]).forEach(([k]) => cands.push([k, 'learned word']));
  if (best && best.ok && bs >= 0.5) cands.push([best.it, 'learned example']);
  if (!cands.length) return { intent: null, why: 'no keyword' };
  if (kw === 'thanks' || kw === 'hello') return { intent: kw, t, via: 'keyword' };
  // a multi-word subject name counts as one known word ("מדעי החברה" – but "החברים" alone is not explained)
  let tc = t; for (const s of [...SUBJECTS, ...OTHER_SUBJECTS]) for (const a of s.aliases) if (a.includes(' ')) tc = tc.replace(new RegExp(`(^| )[והבלמשכ]{0,2}${a}( |$)`, 'g'), ' ');
  const dw = dataWords(ctx), words = tc.trim().split(/\s+/).filter(Boolean);
  const qw = Object.keys(QWORD).find(q => words.includes(q));
  let why = '';
  for (const [it, via] of cands.filter((c, i, a) => a.findIndex(x => x[0] === c[0]) === i)) {
    if (qw && !QWORD[qw].includes(it)) { why = why || `question word "${qw}" ≠ ${it}`; continue; }
    const sets = [stemSet(VOCAB[it] || new Set()), stemSet(VOCAB.common), stemSet(names), ...(['grades', 'average'].includes(it) ? [dw.grades] : it === 'assignments' ? [dw.assignments] : [])];
    const unknown = words.filter(w => !explainedBy(w, ...sets) && !learnedHit(w, it));
    if (!unknown.length) return { intent: it, t, via };
    why = why || `unexplained: ${unknown.join(', ')}`;
  }
  return { intent: null, why };
}
export const intent = (ctx, raw) => routeQuestion(ctx, raw).intent;
