// Real Google Classroom connection (spec 05) – read only, straight from the browser.
// Uses Google Identity Services (token model): only the public OAuth Client ID is needed.
// The client SECRET is never used here – a static site must not contain it.
// The access token lives in memory only (not in storage) and is gone when the tab closes.
import { GOOGLE_CLIENT_ID } from './config.js';

const SCOPES = [
  'openid', 'profile', 'email',
  'https://www.googleapis.com/auth/classroom.courses.readonly',          // the student's courses
  'https://www.googleapis.com/auth/classroom.coursework.me.readonly',    // their coursework, submissions and grades
  'https://www.googleapis.com/auth/classroom.announcements.readonly',    // class announcements
].join(' ');
const API = 'https://classroom.googleapis.com/v1';

let token = null;
let granted = new Set();
export const LIVE = { profile: null, courses: [], assignments: [], grades: [], announcements: [], teachers: [], events: null, errors: [], fetchedAt: null };

// Extra Google services, connected one by one (incremental consent) with the same Client ID.
export const SERVICES = {
  calendar: { label: 'Google Calendar', desc: 'אירועים, מבחנים וקישורי Meet מהיומן', scopes: ['https://www.googleapis.com/auth/calendar.readonly'] },
  drive: { label: 'Google Drive · Docs · Sheets · Slides', desc: 'חיפוש וקריאה של קבצים (קריאה בלבד)', scopes: ['https://www.googleapis.com/auth/drive.readonly'] },
  gmail: { label: 'Gmail', desc: 'שליחת הודעות למורים – רק אחרי אישור שלך', scopes: ['https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/classroom.rosters.readonly', 'https://www.googleapis.com/auth/classroom.profile.emails'] },
};
export const hasService = k => SERVICES[k].scopes.every(x => granted.has(x));

function requestToken(scope, prompt = '') {
  return new Promise((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID, scope, prompt, include_granted_scopes: true,
      callback: r => {
        if (!r || !r.access_token) return reject(new Error(r && r.error_description || 'ההתחברות בוטלה.'));
        (r.scope || scope).split(' ').forEach(x => granted.add(x));
        resolve(r.access_token);
      },
      error_callback: e => reject(new Error(e && e.type === 'popup_closed' ? 'חלון ההתחברות נסגר.' : 'ההתחברות נכשלה.')),
    });
    client.requestAccessToken();
  });
}
export async function connectService(k) {
  await loadGis();
  const all = [...new Set([...SCOPES.split(' '), ...granted, ...SERVICES[k].scopes])].join(' ');
  token = await requestToken(all, 'consent');
  if (!hasService(k)) throw new Error('לא ניתנה הרשאה לשירות הזה.');
  if (k === 'gmail') await loadTeachers();
  if (k === 'calendar') LIVE.events = await calendarEvents(new Date(), 14);
}

function loadGis() {
  if (window.google && google.accounts && google.accounts.oauth2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
    s.onload = () => resolve(); s.onerror = () => reject(new Error('לא הצלחתי לטעון את ההתחברות של Google.'));
    document.head.appendChild(s);
  });
}

export async function signIn() {
  if (!GOOGLE_CLIENT_ID) throw new Error('לא הוגדר Client ID של Google.');
  await loadGis();
  token = await requestToken(SCOPES);
  await refresh();
  return LIVE.profile;
}

export function signOut() {
  if (token && window.google && google.accounts && google.accounts.oauth2) google.accounts.oauth2.revoke(token, () => {});
  token = null; granted = new Set();
  Object.assign(LIVE, { profile: null, courses: [], assignments: [], grades: [], announcements: [], teachers: [], events: null, fetchedAt: null });
}
export const isLive = () => !!token;

async function get(url) {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (r.status === 401) { token = null; throw new Error('ההתחברות ל-Google פגה. התחברו מחדש.'); }
  if (r.status === 403) throw new Error('אין הרשאה ל-Classroom בחשבון הזה (ייתכן שבית הספר צריך לאשר את האפליקציה).');
  if (!r.ok) throw new Error(`Classroom החזיר שגיאה (${r.status}).`);
  return r.json();
}
async function getAll(url, key) {
  let out = [], page = '';
  for (let i = 0; i < 10; i++) {
    const d = await get(url + (url.includes('?') ? '&' : '?') + 'pageSize=100' + (page ? `&pageToken=${page}` : ''));
    out = out.concat(d[key] || []);
    if (!d.nextPageToken) break; page = d.nextPageToken;
  }
  return out;
}
const dueOf = w => w.dueDate ? new Date(Date.UTC(w.dueDate.year, w.dueDate.month - 1, w.dueDate.day, w.dueTime ? w.dueTime.hours || 0 : 21, w.dueTime ? w.dueTime.minutes || 59 : 59)) : null;

// Fetch and normalise into the same shapes as the demo data (spec 03 records_*)
export async function refresh() {
  const me = await get('https://www.googleapis.com/oauth2/v3/userinfo');
  LIVE.profile = { sub: me.sub, name: me.name || me.email, email: me.email };
  LIVE.errors = [];
  const note = (where, e) => LIVE.errors.push(`${where}: ${e.message}`);
  // courses where the account is a student AND where it is a teacher (a personal Gmail often owns its own classes)
  const [asStudent, asTeacher] = await Promise.all([
    getAll(`${API}/courses?studentId=me&courseStates=ACTIVE`, 'courses').catch(e => (note('כיתות כתלמיד', e), [])),
    getAll(`${API}/courses?teacherId=me&courseStates=ACTIVE`, 'courses').catch(e => (note('כיתות כמורה', e), [])),
  ]);
  const seen = new Set();
  LIVE.courses = [...asStudent.map(c => ({ c, role: 'student' })), ...asTeacher.map(c => ({ c, role: 'teacher' }))]
    .filter(({ c }) => !seen.has(c.id) && seen.add(c.id))
    .map(({ c, role }) => ({ id: c.id, name: c.name, section: c.section || '', link: c.alternateLink, role }));
  const now = new Date().toISOString();
  const asg = [], grades = [], ann = [];
  await Promise.all(LIVE.courses.map(async c => {
    const [work, subs, anns] = await Promise.all([
      getAll(`${API}/courses/${c.id}/courseWork?orderBy=dueDate%20desc`, 'courseWork').catch(e => (note(`מטלות ב"${c.name}"`, e), [])),
      c.role === 'student' ? getAll(`${API}/courses/${c.id}/courseWork/-/studentSubmissions?userId=me`, 'studentSubmissions').catch(e => (note(`הגשות ב"${c.name}"`, e), [])) : [],
      get(`${API}/courses/${c.id}/announcements?pageSize=10`).then(d => d.announcements || []).catch(e => (note(`הודעות ב"${c.name}"`, e), [])),
    ]);
    const subBy = Object.fromEntries(subs.map(s => [s.courseWorkId, s]));
    for (const w of work) {
      const s = subBy[w.id] || {};
      const due = dueOf(w);
      const done = ['TURNED_IN', 'RETURNED'].includes(s.state);
      asg.push({ id: `gc-${w.id}`, subject: c.name, title: w.title, due: due ? due.toISOString() : null, link: w.alternateLink, courseRole: c.role,
        status: c.role === 'teacher' ? 'open' : done ? 'submitted' : (due && due < new Date() ? 'missing' : 'open'), late: !!s.late, source: 'Google Classroom', fetchedAt: now });
      if (s.assignedGrade != null) grades.push({ id: `gg-${w.id}`, subject: c.name, type: 'assignment', title: w.title, score: s.assignedGrade,
        max: w.maxPoints || 100, date: s.updateTime || w.updateTime || now, source: 'Google Classroom', fetchedAt: now });
    }
    for (const a of anns) ann.push({ id: `ga-${a.id}`, subject: c.name, teacherName: c.name, date: a.updateTime || a.creationTime, body: a.text || '', external: true });
  }));
  LIVE.assignments = asg; LIVE.grades = grades; LIVE.announcements = ann; LIVE.fetchedAt = now;
  if (hasService('calendar')) LIVE.events = await calendarEvents(new Date(), 14).catch(e => (note('יומן', e), []));
  if (hasService('gmail')) await loadTeachers().catch(e => note('מורים', e));
}

// ---------- Calendar (and Meet links inside events) ----------
export async function calendarEvents(fromDate, days = 1) {
  const from = new Date(fromDate); from.setHours(0, 0, 0, 0);
  const to = new Date(from.getTime() + days * 864e5);
  const d = await get(`https://www.googleapis.com/calendar/v3/calendars/primary/events?singleEvents=true&orderBy=startTime&maxResults=50&timeMin=${from.toISOString()}&timeMax=${to.toISOString()}`);
  return (d.items || []).map(e => ({ title: e.summary || '(ללא כותרת)', start: e.start.dateTime || e.start.date, end: e.end && (e.end.dateTime || e.end.date),
    allDay: !e.start.dateTime, meet: e.hangoutLink || null, link: e.htmlLink, location: e.location || '' }));
}

// ---------- Drive (Docs / Sheets / Slides are Drive files) ----------
const KIND = { 'application/vnd.google-apps.document': 'מסמך', 'application/vnd.google-apps.spreadsheet': 'גיליון', 'application/vnd.google-apps.presentation': 'מצגת', 'application/pdf': 'PDF', 'application/vnd.google-apps.form': 'טופס' };
export async function driveSearch(query) {
  const q = encodeURIComponent(`trashed=false and (name contains '${query.replace(/'/g, "\\'")}' or fullText contains '${query.replace(/'/g, "\\'")}')`);
  const d = await get(`https://www.googleapis.com/drive/v3/files?q=${q}&pageSize=10&orderBy=modifiedTime desc&fields=files(id,name,mimeType,webViewLink,modifiedTime)`);
  return (d.files || []).map(f => ({ id: f.id, name: f.name, kind: KIND[f.mimeType] || 'קובץ', link: f.webViewLink, modified: f.modifiedTime, mimeType: f.mimeType }));
}
export async function driveRead(id) {
  const meta = await get(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?fields=id,name,mimeType,webViewLink`);
  const exportAs = { 'application/vnd.google-apps.document': 'text/plain', 'application/vnd.google-apps.presentation': 'text/plain', 'application/vnd.google-apps.spreadsheet': 'text/csv' }[meta.mimeType];
  const url = exportAs ? `https://www.googleapis.com/drive/v3/files/${meta.id}/export?mimeType=${encodeURIComponent(exportAs)}`
    : /^text\//.test(meta.mimeType) ? `https://www.googleapis.com/drive/v3/files/${meta.id}?alt=media` : null;
  if (!url) return { name: meta.name, link: meta.webViewLink, text: null, note: 'אי אפשר לקרוא את סוג הקובץ הזה כטקסט.' };
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`לא הצלחתי לקרוא את הקובץ (${r.status}).`);
  const text = (await r.text()).slice(0, 12000);
  return { name: meta.name, link: meta.webViewLink, text };
}

// ---------- Gmail (send only) + the student's real teachers from Classroom ----------
export async function loadTeachers() {
  const out = [];
  await Promise.all(LIVE.courses.map(async c => {
    const d = await get(`${API}/courses/${c.id}/teachers`).catch(() => ({}));
    for (const t of d.teachers || []) if (t.profile && t.profile.emailAddress)
      out.push({ id: t.profile.emailAddress, name: t.profile.name ? t.profile.name.fullName : t.profile.emailAddress, email: t.profile.emailAddress, subjects: [c.name], subjectIds: [c.name], homeroom: false, gender: null });
  }));
  const seen = new Map(); out.forEach(t => { if (seen.has(t.id)) seen.get(t.id).subjects.push(...t.subjects); else seen.set(t.id, t); });
  LIVE.teachers = [...seen.values()];
}
const b64url = s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const encodeHeader = s => `=?UTF-8?B?${btoa(unescape(encodeURIComponent(s)))}?=`;
export async function gmailSend({ to, subject, body }) {
  const raw = [`To: ${to}`, `Subject: ${encodeHeader(subject)}`, 'MIME-Version: 1.0', 'Content-Type: text/plain; charset="UTF-8"', 'Content-Transfer-Encoding: 8bit', '',
    `${body}\n\n—\nנוסחה בעזרת אלומה ואושרה על ידי השולח/ת.`].join('\r\n');
  const r = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ raw: b64url(raw) }) });
  if (!r.ok) throw new Error(`Gmail לא שלח את ההודעה (${r.status}).`);
  return r.json();
}
