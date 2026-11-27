// The "tools" (spec 04). Each one takes the AuthContext from the session and enforces
// permissions itself. The answering engine can ask for anything – these decide what it gets.
import { GRADES, ASSIGNMENTS, SUBMISSIONS, SCHEDULE, SCHEDULE_CHANGES, ATTENDANCE, ANNOUNCEMENTS, EXAMS, STUDENTS, TEACHERS, CLASSES, NOW, dayOffset, subjectName } from './data.js';
import { Forbidden } from './auth.js';
import { db, save, audit } from './store.js';
import { LIVE, gmailSend } from './google.js';
const liveOnly = (ctx, what) => ({ data: [], source: what, notConnected: true });

const student = id => STUDENTS.find(s => s.id === id);

function requireStudent(ctx, studentId) {
  if (!ctx.allowedStudentIds.includes(studentId)) {
    audit(ctx.userId, 'access_denied', { target: studentId });
    throw new Forbidden('אני יכולה לעזור רק עם המידע שמותר לך לראות.');
  }
}
function requireScope(ctx, scope) { if (!ctx.scopes[scope]) throw new Forbidden('המידע הזה לא זמין לחשבון שלך.'); }
const logView = (ctx, studentId, kind) => audit(ctx.userId, 'view', { subjectStudent: studentId, kind });

export function getGrades(ctx, { studentId, subject, limit, quiet } = {}) {
  if (ctx.live) { requireStudent(ctx, studentId); let r = LIVE.grades.filter(g => !subject || g.subject === subject).sort((a, b) => new Date(b.date) - new Date(a.date)); return { data: limit ? r.slice(0, limit) : r, source: 'Google Classroom', fetchedAt: LIVE.fetchedAt }; }
  requireScope(ctx, 'grades'); requireStudent(ctx, studentId); if (!quiet) logView(ctx, studentId, 'grades');
  let r = GRADES.filter(g => g.studentId === studentId && (!subject || g.subject === subject));
  r.sort((a, b) => new Date(b.date) - new Date(a.date));
  return { data: limit ? r.slice(0, limit) : r, source: 'משוב', fetchedAt: r[0] ? r[0].fetchedAt : NOW.toISOString() };
}

export function getAssignments(ctx, { studentId, status, subject, dueWithinDays, title, quiet } = {}) {
  if (ctx.live) { requireStudent(ctx, studentId); let r = LIVE.assignments.filter(a => (!subject || a.subject === subject) && (!title || a.title.includes(title))); if (status === 'pending') r = r.filter(a => a.status !== 'submitted'); if (dueWithinDays != null) r = r.filter(a => a.due && new Date(a.due) - NOW < dueWithinDays * 864e5 && new Date(a.due) > NOW); r.sort((a, b) => (a.due ? new Date(a.due) : Infinity) - (b.due ? new Date(b.due) : Infinity)); /* no due date: kept, sorted last */ return { data: r, source: 'Google Classroom', fetchedAt: LIVE.fetchedAt }; }
  requireScope(ctx, 'assignments'); requireStudent(ctx, studentId); if (!quiet) logView(ctx, studentId, 'assignments');
  const s = student(studentId);
  let r = ASSIGNMENTS.filter(a => a.classId === s.classId && (!subject || a.subject === subject))
    .map(a => ({ ...a, studentId, status: SUBMISSIONS[`${a.id}|${studentId}`] }));
  if (status === 'pending') r = r.filter(a => a.status !== 'submitted');
  if (dueWithinDays != null) r = r.filter(a => new Date(a.due) - NOW < dueWithinDays * 864e5 && new Date(a.due) > NOW);
  r.sort((a, b) => new Date(a.due) - new Date(b.due));
  return { data: r, source: 'Google Classroom', fetchedAt: ASSIGNMENTS[0].fetchedAt };
}

// tests and quizzes in the next few days. Live: Classroom work and calendar events that are named like a test
const TEST_RE = /מבחן|בוחן|בחינה|מבדק|\b(test|exam|quiz)\b/i;
export function getUpcomingTests(ctx, { studentId, days = 7 } = {}) {
  const soon = d => d && new Date(d) > NOW && new Date(d) - NOW < days * 864e5;
  if (ctx.live) {
    const a = (LIVE.assignments || []).filter(x => TEST_RE.test(x.title || '') && soon(x.due)).map(x => ({ subject: x.subject, title: x.title, date: x.due, source: 'Google Classroom' }));
    const e = (LIVE.events || []).filter(x => TEST_RE.test(x.title || x.summary || '') && soon(x.start)).map(x => ({ subject: '', title: x.title || x.summary, date: x.start, source: 'Google Calendar' }));
    return { data: [...a, ...e].sort((p, q) => new Date(p.date) - new Date(q.date)), source: 'Google Classroom' };
  }
  requireScope(ctx, 'schedule'); requireStudent(ctx, studentId);
  const s = student(studentId);
  return { data: EXAMS.filter(x => x.classId === s.classId && soon(x.date)).sort((p, q) => new Date(p.date) - new Date(q.date)), source: 'משוב' };
}
export function scheduleChanges(ctx, { studentId, dayOffsetN = 1 } = {}) {
  if (ctx.live) return [];
  requireScope(ctx, 'schedule'); requireStudent(ctx, studentId);
  const s = student(studentId), date = dayOffset(dayOffsetN);
  return SCHEDULE_CHANGES.filter(c => c.classId === s.classId && new Date(c.date).toDateString() === date.toDateString());
}

export function getSchedule(ctx, { studentId, dayOffsetN = 0 } = {}) {
  if (ctx.live) {
    const date = dayOffset(dayOffsetN);
    if (!LIVE.events) return { ...liveOnly(ctx, 'Google Calendar'), date };
    const evs = LIVE.events.filter(e => new Date(e.start).toDateString() === date.toDateString());
    return { data: [], events: evs, date, calendar: true, source: 'Google Calendar', fetchedAt: LIVE.fetchedAt };
  }
  requireScope(ctx, 'schedule'); requireStudent(ctx, studentId);
  const s = student(studentId);
  const date = dayOffset(dayOffsetN);
  const wd = date.getDay();
  if (wd > 4) return { data: [], date, weekend: true, source: 'משוב' };
  const changes = SCHEDULE_CHANGES.filter(c => c.classId === s.classId && new Date(c.date).toDateString() === date.toDateString());
  const lessons = SCHEDULE[s.classId][wd].map(l => {
    const ch = changes.find(c => c.subject === l.subject);
    return { ...l, change: ch || null };
  });
  return { data: lessons, date, source: 'משוב', fetchedAt: new Date(NOW.getTime() - 25 * 60000).toISOString() };
}

export function getAttendance(ctx, { studentId, days = 30 } = {}) {
  if (ctx.live) return { ...liveOnly(ctx, 'משוב'), days };
  requireScope(ctx, 'attendance'); requireStudent(ctx, studentId); logView(ctx, studentId, 'attendance');
  const from = dayOffset(-days);
  const r = ATTENDANCE.filter(a => a.studentId === studentId && new Date(a.date) >= from).sort((a, b) => new Date(b.date) - new Date(a.date));
  return { data: r, days, source: 'משוב', fetchedAt: new Date(NOW.getTime() - 25 * 60000).toISOString() };
}

// Announcements contain FREE TEXT from outside – marked as external content (spec 02, T5)
export function getAnnouncements(ctx, { studentId } = {}) {
  if (ctx.live) { requireStudent(ctx, studentId); return { data: LIVE.announcements.slice().sort((a, b) => new Date(b.date) - new Date(a.date)), source: 'Google Classroom' }; }
  if (!(ctx.scopes.messages || ctx.scopes.announcements)) throw new Forbidden();
  requireStudent(ctx, studentId);
  const s = student(studentId);
  const r = ANNOUNCEMENTS.filter(m => m.classId === s.classId).sort((a, b) => new Date(b.date) - new Date(a.date));
  return { data: r.map(m => ({ ...m, external: true })), source: 'משוב' };
}

// Allowed recipients = the student's own teachers (+ homeroom). Never free-text addresses.
export function listMyTeachers(ctx, { studentId } = {}) {
  if (ctx.live) return LIVE.teachers.slice();
  requireScope(ctx, 'send'); requireStudent(ctx, studentId);
  const s = student(studentId);
  const subjectsInClass = new Set(SCHEDULE[s.classId].flat().map(l => l.subject));
  return TEACHERS.filter(t => t.subjects.some(x => subjectsInClass.has(x)) || t.homeroom === s.classId)
    .map(t => ({ id: t.id, name: t.name, gender: t.gender, subjects: t.subjects.map(subjectName), subjectIds: t.subjects, homeroom: t.homeroom === s.classId }));
}

// Creates a DRAFT only. There is no tool that confirms – only the user's click does (spec 01/04).
export function draftMessage(ctx, { studentId, teacherId, subject, body, fromExternal = false }) {
  const allowed = listMyTeachers(ctx, { studentId });
  if (!allowed.some(t => t.id === teacherId)) throw new Forbidden('אפשר לשלוח הודעות רק למורים שלך.');
  const id = 'act_' + crypto.randomUUID().slice(0, 8);
  const confirmToken = crypto.randomUUID();
  db().actions[id] = { id, type: 'send_message', userId: ctx.userId, role: ctx.role, studentId, teacherId, subject, body,
    status: 'draft', confirmToken, fromExternal, createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 30 * 60000).toISOString() };
  save();
  audit(ctx.userId, 'draft_created', { action: id });
  return { actionId: id, confirmToken };
}

export function sentToday(userId) {
  const r = db().rate[userId]; const d = new Date().toDateString();
  return r && r.date === d ? r.sent : 0;
}

// Called ONLY from the confirm button handler, with the one-time token.
export async function confirmAction(ctx, actionId, token, editedBody) {
  const a = db().actions[actionId];
  if (!a || a.userId !== ctx.userId) throw new Forbidden('הפעולה לא נמצאה.');
  if (a.status !== 'draft') throw new Error('הפעולה כבר טופלה.');
  if (a.confirmToken !== token) throw new Forbidden('אישור לא תקף.');
  if (new Date(a.expiresAt) < new Date()) { a.status = 'expired'; save(); throw new Error('תוקף הטיוטה פג. אפשר לבקש ניסוח חדש.'); }
  const limit = db().policies.dailyMessageLimit;
  if (sentToday(ctx.userId) >= limit) throw new Error(`הגעת למגבלה של ${limit} הודעות ליום.`);
  if (editedBody != null) a.body = editedBody.trim();
  if (ctx.live) {   // real account: send through Gmail to the teacher's real address (from Classroom)
    const t = LIVE.teachers.find(x => x.id === a.teacherId);
    if (!t) throw new Forbidden('הנמען לא נמצא ברשימת המורים שלך.');
    a.confirmToken = null; save();
    await gmailSend({ to: t.email, subject: a.subject, body: a.body });
    a.status = 'sent'; a.sentAt = new Date().toISOString(); a.via = 'gmail';
    const rr = db().rate[ctx.userId] = db().rate[ctx.userId] && db().rate[ctx.userId].date === new Date().toDateString() ? db().rate[ctx.userId] : { date: new Date().toDateString(), sent: 0 };
    rr.sent++; save(); audit(ctx.userId, 'message_sent', { action: actionId });
    return a;
  }
  a.status = 'sent'; a.sentAt = new Date().toISOString(); a.confirmToken = null;
  const r = db().rate[ctx.userId] = db().rate[ctx.userId] && db().rate[ctx.userId].date === new Date().toDateString() ? db().rate[ctx.userId] : { date: new Date().toDateString(), sent: 0 };
  r.sent++;
  db().inbox.push({ id: 'in_' + actionId, actionId, teacherId: a.teacherId, fromUserId: ctx.userId, fromRole: ctx.role, studentId: a.studentId,
    subject: a.subject, body: a.body, sentAt: a.sentAt, read: false, aiAssisted: true, tag: tagFor(a.body) });
  save();
  audit(ctx.userId, 'message_sent', { action: actionId, to: a.teacherId });
  return a;
}

export function undoAction(ctx, actionId) {
  const a = db().actions[actionId];
  if (!a || a.userId !== ctx.userId || a.status !== 'sent' || a.via === 'gmail') return false;
  if (Date.now() - new Date(a.sentAt).getTime() > 10500) return false;
  a.status = 'cancelled';
  db().inbox = db().inbox.filter(m => m.actionId !== actionId);
  const r = db().rate[ctx.userId]; if (r && r.sent) r.sent--;
  save(); audit(ctx.userId, 'message_undone', { action: actionId });
  return true;
}

export function tagFor(body) {
  if (/חול|לא אגיע|אעדר|היעדר|תור לרופא|לא אוכל להגיע/.test(body)) return 'היעדרות';
  if (/ציון|מבחן|בדיק/.test(body)) return 'שאלה על ציון';
  if (/הארכה|לדחות|יותר זמן/.test(body)) return 'בקשת הארכה';
  if (/תודה/.test(body)) return 'תודה';
  return 'אחר';
}

// ----- teacher tools -----
const teacherSubjectsIn = (ctx, classId) => ctx.homeroom === classId ? null : ctx.subjects; // null = all subjects
export function classSummary(ctx, { classId, subject }) {
  requireScope(ctx, 'classSummary');
  if (!ctx.classIds.includes(classId)) throw new Forbidden('זו לא כיתה שלך.');
  const allowedSubs = teacherSubjectsIn(ctx, classId);
  const sub = subject || ctx.subjects[0];
  if (allowedSubs && !allowedSubs.includes(sub)) throw new Forbidden(`אין לך הרשאה לנתוני ${subjectName(sub)} בכיתה הזו.`);
  const studs = STUDENTS.filter(s => s.classId === classId);
  const asg = ASSIGNMENTS.filter(a => a.classId === classId && a.subject === sub).sort((a, b) => new Date(b.due) - new Date(a.due))[0];
  const missing = asg ? studs.filter(s => SUBMISSIONS[`${asg.id}|${s.id}`] !== 'submitted') : [];
  const lastExam = GRADES.filter(g => g.subject === sub && studs.some(s => s.id === g.studentId)).sort((a, b) => new Date(b.date) - new Date(a.date))[0];
  const exams = lastExam ? GRADES.filter(g => g.subject === sub && g.title === lastExam.title && studs.some(s => s.id === g.studentId)) : [];
  const scores = exams.map(e => e.score);
  audit(ctx.userId, 'class_summary', { classId, subject: sub });
  return {
    className: CLASSES.find(c => c.id === classId).name, subject: sub, assignment: asg, total: studs.length,
    missing: missing.map(s => s.name),
    exam: lastExam ? { title: lastExam.title, avg: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length), min: Math.min(...scores), max: Math.max(...scores), n: scores.length } : null,
    source: 'משוב + Google Classroom',
  };
}

export function classAttendance(ctx, { classId, days = 30, threshold = 3 }) {
  if (ctx.homeroom !== classId) throw new Forbidden('נתוני נוכחות של כל הכיתה זמינים רק למחנך/ת.');
  const studs = STUDENTS.filter(s => s.classId === classId);
  const from = dayOffset(-days);
  const rows = studs.map(s => ({ name: s.name, count: ATTENDANCE.filter(a => a.studentId === s.id && a.status === 'absent' && new Date(a.date) >= from).length }))
    .filter(r => r.count >= threshold).sort((a, b) => b.count - a.count);
  audit(ctx.userId, 'class_attendance', { classId });
  return { className: CLASSES.find(c => c.id === classId).name, rows, threshold, days };
}

// ----- level of the class (aggregate only, for adaptive learning – spec ג) -----
// A student may see the class AVERAGE in a subject (never other students' grades), and only when
// at least 5 students have a grade, so no single student can be identified.
export function classLevel(ctx, { studentId, subject }) {
  requireStudent(ctx, studentId);
  if (ctx.live) return null;
  const s = student(studentId); if (!s) return null;
  const mates = STUDENTS.filter(x => x.classId === s.classId).map(x => x.id);
  const rows = GRADES.filter(g => mates.includes(g.studentId) && g.subject === subject);
  if (new Set(rows.map(r => r.studentId)).size < 5) return null;
  return { avg: Math.round(rows.reduce((a, b) => a + b.score / b.max * 100, 0) / rows.length), n: new Set(rows.map(r => r.studentId)).size, className: CLASSES.find(c => c.id === s.classId).name };
}
