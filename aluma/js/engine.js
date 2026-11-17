// Local answering engine – stands in for the AI orchestrator (spec 04) until the Claude API is connected.
// It understands Hebrew questions with simple patterns, calls the SAME permission-checked tools the AI
// would call, and builds every fact in the answer from tool results (spec 04 "grounding").
// Behaviour rules follow spec 18.
import { SUBJECTS, STUDENTS, TEACHERS, CLASSES, subjectName, NOW, dayOffset } from './data.js';
import * as T from './tools.js';
import { g, Forbidden } from './auth.js';
import { db, save, audit } from './store.js';

const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const fmtDate = d => { d = new Date(d); return `${d.getDate()}.${d.getMonth() + 1}`; };
const dayName = d => DAYS[new Date(d).getDay()];
const firstName = n => n.split(' ')[0];
const norm = s => s.replace(/[֑-ׇ]/g, '').replace(/[״"׳']/g, '').replace(/\s+/g, ' ').trim();

function findSubject(t) {
  for (const s of SUBJECTS) for (const a of s.aliases) if (t.includes(norm(a))) return s.id;
  return null;
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

const reply = (text, extra = {}) => ({ text, cards: [], chips: [], ...extra });
const DEFAULT_CHIPS = {
  student: ['מה יש לי מחר?', 'ציונים אחרונים', 'מה להגיש השבוע?', 'בואי נתרגל', 'תנסחי למורה שאני חולה היום'],
  parent: ['מה המצב השבוע?', 'ציונים אחרונים', 'יש הגשות פתוחות?', 'היעדרויות החודש'],
  teacher: ['מי לא הגיש בט׳2?', 'מה הממוצע במבחן האחרון בט׳2?', 'מי בט׳2 עם יותר מ-3 היעדרויות?', 'הודעות חדשות'],
};

export function welcome(ctx, activeStudent) {
  const u = ctx.user;
  if (ctx.role === 'parent' && !ctx.allowedStudentIds.length)
    return reply(`שלום ${firstName(u.name)}! עדיין אין ילדים מקושרים לחשבון. אפשר להזין קוד הזמנה מבית הספר בהגדרות (⚙️).`);
  const who = ctx.role === 'parent' ? `על ${firstName(activeStudent.name)}` : '';
  return reply(`היי ${firstName(u.name)}, אני אלומה${emoji(ctx, '👋')} אפשר לשאול אותי ${who} על ציונים, מטלות, מערכת שעות והודעות – ואני יכולה לנסח הודעה למורה (היא נשלחת רק אחרי שתאשר${g(u, '', 'י')}).`,
    { chips: DEFAULT_CHIPS[ctx.role] });
}

export function answer(ctx, rawText, { activeStudentId, convo } = {}) {
  db().stats.questions++; save();
  audit(ctx.userId, 'question', {});
  const t = norm(rawText);
  try { return route(ctx, t, rawText, activeStudentId, convo || {}); }
  catch (e) {
    if (e instanceof Forbidden) return reply(e.message);
    console.error(e);
    return reply('משהו השתבש אצלי. אפשר לנסות לנסח אחרת?');
  }
}

function route(ctx, t, raw, activeStudentId, convo) {
  const u = ctx.user;

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
  const other = mentionedStudent(t, ctx);
  let studentIds = [activeStudentId || ctx.allowedStudentIds[0]];
  if (other) {
    if (!ctx.allowedStudentIds.includes(other.id)) {
      // still call the tool: the permission check lives there, not here
      try { T.getGrades(ctx, { studentId: other.id }); } catch (e) { return reply(ctx.role === 'parent' ? 'אני יכולה לעזור רק לגבי הילדים שמקושרים לחשבון שלך.' : 'אני יכולה לעזור רק עם המידע שלך.'); }
    }
    studentIds = [other.id];
  }
  if (ctx.role === 'parent' && /(כל הילדים|הילדים|שניהם|שתיהן)/.test(t)) studentIds = ctx.allowedStudentIds;

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
  if (/(תנסח|תכתוב|תכתבי|תשלח|תשלחי|נסחי|כתבי|שלחי|תודיע|תודיעי).*(מורה|מחנכ|ל(רינה|משה|שירן|אלון|מיכל|יוסי))/.test(t) || /^(הודעה|תגידי) למורה/.test(t)) {
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

function perStudent(ctx, ids, fn) {
  if (ids.length === 1) return fn(ids[0]);
  const parts = ids.map(fn);
  return { text: parts.map((p, i) => `**${firstName(STUDENTS.find(s => s.id === ids[i]).name)}:** ${p.text}`).join('\n\n'), cards: parts.flatMap(p => p.cards), chips: [] };
}
const nameOf = id => firstName(STUDENTS.find(s => s.id === id).name);
const childPrefix = (ctx, sid) => (ctx.role === 'parent' ? `ל${nameOf(sid)} ` : 'לך ');

// ---- answers (every fact comes from a tool result) ----
function gradesAnswer(ctx, sid, subject, plural, t) {
  const r = T.getGrades(ctx, { studentId: sid, subject });
  if (!r.data.length) return reply(subject ? `עוד אין ציונים ב${subjectName(subject)} במערכת.` : 'עוד אין ציונים במערכת.');
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
  const text = `הממוצע הפשוט ${scope} הוא **${avg}** (${r.data.length} ציונים: ${r.data.slice(0, 6).map(x => x.score).join(', ')}${r.data.length > 6 ? '…' : ''}).` +
    (wantsShort(ctx) ? '' : ' הממוצע הרשמי בתעודה עשוי להיות משוקלל אחרת.');
  return reply(text, { cards: [{ type: 'stat', label: `ממוצע ${scope}`, value: avg, source: r.source, fetchedAt: r.fetchedAt }] });
}

function assignmentsAnswer(ctx, sid, subject, t) {
  const week = /(השבוע|הקרוב|מחר|היום)/.test(t) || !/(כל)/.test(t);
  const r = T.getAssignments(ctx, { studentId: sid, subject, status: 'pending' });
  const late = r.data.filter(a => new Date(a.due) < NOW);
  const upcoming = r.data.filter(a => new Date(a.due) >= NOW && (!week || new Date(a.due) - NOW < 7 * 864e5));
  if (!late.length && !upcoming.length) return reply(`אין ${childPrefix(ctx, sid)}מטלות פתוחות${week ? ' השבוע' : ''}.${emoji(ctx, '✅')}`);
  let text = upcoming.length ? `יש ${childPrefix(ctx, sid)}${upcoming.length} מטלות להגשה${week ? ' השבוע' : ''}.` : '';
  if (late.length) text += `${text ? ' ' : ''}שימו לב: ${late.length === 1 ? 'מטלה אחת עברה' : late.length + ' מטלות עברו'} את מועד ההגשה ולא ${late.length === 1 ? 'הוגשה' : 'הוגשו'}.`;
  return reply(text, { cards: [...late, ...upcoming].map(a => ({ type: 'assignment', ...a })) });
}

function scheduleAnswer(ctx, sid, d) {
  const r = T.getSchedule(ctx, { studentId: sid, dayOffsetN: d });
  const label = d === 0 ? 'היום' : d === 1 ? 'מחר' : `ביום ${dayName(r.date)}`;
  if (r.weekend) return reply(`${label} (${dayName(r.date)}) אין לימודים.`, { chips: ['מה יש ביום ראשון?'] });
  const changes = r.data.filter(l => l.change);
  let text = `${label} (יום ${dayName(r.date)}, ${fmtDate(r.date)}) ${ctx.role === 'parent' ? `יש ל${nameOf(sid)}` : 'יש לך'} ${r.data.length} שיעורים, ${r.data[0].start}–${r.data[r.data.length - 1].end}.`;
  if (changes.length) text += ` ${changes.length === 1 ? 'יש שינוי אחד' : `יש ${changes.length} שינויים`} – מסומן בכתום.`;
  return reply(text, { cards: [{ type: 'schedule', date: r.date, lessons: r.data, source: r.source, fetchedAt: r.fetchedAt }] });
}

function attendanceAnswer(ctx, sid) {
  const r = T.getAttendance(ctx, { studentId: sid, days: 30 });
  const abs = r.data.filter(a => a.status === 'absent').length, late = r.data.filter(a => a.status === 'late').length;
  if (!r.data.length) return reply(`ב-30 הימים האחרונים אין היעדרויות או איחורים.${emoji(ctx, '👍')}`);
  return reply(`ב-30 הימים האחרונים: **${abs}** היעדרויות ו-**${late}** איחורים.`, { cards: r.data.map(a => ({ type: 'attendance', ...a })) });
}

function announcementsAnswer(ctx, sid) {
  const r = T.getAnnouncements(ctx, { studentId: sid });
  if (!r.data.length) return reply('אין הודעות חדשות מהמורים.');
  // external text is shown as data, never followed as an instruction (spec 02, T5)
  return reply(`יש ${r.data.length} הודעות אחרונות מהמורים:`, { cards: r.data.slice(0, 4).map(m => ({ type: 'announcement', ...m, teacherName: TEACHERS.find(t => t.id === m.teacherId).name })) });
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
  if (/מחנכ/.test(t)) teacher = teachers.find(x => x.homeroom);
  if (!teacher && subject) teacher = teachers.find(x => x.subjectIds.includes(subject));
  if (!teacher) teacher = teachers.find(x => t.includes(firstName(x.name)));
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
