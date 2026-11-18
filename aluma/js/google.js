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
export const LIVE = { profile: null, courses: [], assignments: [], grades: [], announcements: [], fetchedAt: null };

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
  token = await new Promise((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID, scope: SCOPES, prompt: '',
      callback: r => (r && r.access_token ? resolve(r.access_token) : reject(new Error(r && r.error_description || 'ההתחברות בוטלה.'))),
      error_callback: e => reject(new Error(e && e.type === 'popup_closed' ? 'חלון ההתחברות נסגר.' : 'ההתחברות נכשלה.')),
    });
    client.requestAccessToken();
  });
  await refresh();
  return LIVE.profile;
}

export function signOut() {
  if (token && window.google && google.accounts && google.accounts.oauth2) google.accounts.oauth2.revoke(token, () => {});
  token = null;
  Object.assign(LIVE, { profile: null, courses: [], assignments: [], grades: [], announcements: [], fetchedAt: null });
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
  const courses = await getAll(`${API}/courses?studentId=me&courseStates=ACTIVE`, 'courses');
  LIVE.courses = courses.map(c => ({ id: c.id, name: c.name, section: c.section || '', link: c.alternateLink }));
  const now = new Date().toISOString();
  const asg = [], grades = [], ann = [];
  await Promise.all(LIVE.courses.map(async c => {
    const [work, subs, anns] = await Promise.all([
      getAll(`${API}/courses/${c.id}/courseWork?orderBy=dueDate%20desc`, 'courseWork').catch(() => []),
      getAll(`${API}/courses/${c.id}/courseWork/-/studentSubmissions?userId=me`, 'studentSubmissions').catch(() => []),
      get(`${API}/courses/${c.id}/announcements?pageSize=10`).then(d => d.announcements || []).catch(() => []),
    ]);
    const subBy = Object.fromEntries(subs.map(s => [s.courseWorkId, s]));
    for (const w of work) {
      const s = subBy[w.id] || {};
      const due = dueOf(w);
      const done = ['TURNED_IN', 'RETURNED'].includes(s.state);
      asg.push({ id: `gc-${w.id}`, subject: c.name, title: w.title, due: due ? due.toISOString() : null, link: w.alternateLink,
        status: done ? 'submitted' : (due && due < new Date() ? 'missing' : 'open'), late: !!s.late, source: 'Google Classroom', fetchedAt: now });
      if (s.assignedGrade != null) grades.push({ id: `gg-${w.id}`, subject: c.name, type: 'assignment', title: w.title, score: s.assignedGrade,
        max: w.maxPoints || 100, date: s.updateTime || w.updateTime || now, source: 'Google Classroom', fetchedAt: now });
    }
    for (const a of anns) ann.push({ id: `ga-${a.id}`, subject: c.name, teacherName: c.name, date: a.updateTime || a.creationTime, body: a.text || '', external: true });
  }));
  LIVE.assignments = asg; LIVE.grades = grades; LIVE.announcements = ann; LIVE.fetchedAt = now;
}
