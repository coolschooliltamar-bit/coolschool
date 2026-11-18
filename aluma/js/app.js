// Aluma prototype – UI. Roles: student, parent, teacher, school admin (specs 06–09).
import { STUDENTS, TEACHERS, PARENTS, ADMINS, CLASSES, SCHOOL, NOW, subjectName } from './data.js';
import { db, save, audit, getSession, setSession, resetAll } from './store.js';
import { buildContext, findUser, ROLE_NAMES, activeLinks, g } from './auth.js';
import * as T from './tools.js';
import { answer, welcome } from './engine.js';
import * as L from './learn.js';
import { icon, mark } from './icons.js';
import * as G from './google.js';
import * as AI from './gemini.js';

const $app = document.getElementById('app');
const live = document.getElementById('live');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const md = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');            // only **bold** – no raw HTML from answers (spec 02, T10)
const fmtDate = d => { d = new Date(d); return `${d.getDate()}.${d.getMonth() + 1}`; };
const fmtTime = d => new Date(d).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
const ago = d => { const m = Math.round((Date.now() - new Date(d)) / 60000); return m < 1 ? 'עכשיו' : m < 60 ? `לפני ${m} דק׳` : `היום ${fmtTime(d)}`; };
const nameOf = id => (findUser(id) || { name: '?' }).name;
const sleep = ms => new Promise(r => setTimeout(r, ms));

let ctx = null, view = 'chat', activeStudentId = null, busy = false, activeConvId = null, toolSubject = null, lessonState = null;

function boot() {
  const s = getSession();
  if (!s) return renderLogin();
  try { ctx = buildContext(s.userId); } catch { setSession(null); return renderLogin(); }
  if (ctx.role === 'parent') activeStudentId = ctx.allowedStudentIds.includes(s.activeStudentId) ? s.activeStudentId : ctx.allowedStudentIds[0] || null;
  else if (ctx.role === 'student') activeStudentId = ctx.userId;
  view = s.view === 'lesson' ? 'path' : (s.view || (ctx.role === 'school_admin' ? 'dash' : 'chat'));
  activeConvId = s.convId || null;
  render();
}

// ---------------- login (demo accounts) ----------------
function renderLogin() {
  const demo = [
    ['u-noa', 'תלמידה · ט׳2', 'ציונים, מטלות, מערכת, הודעות וכלי תרגול'],
    ['u-yoav', 'תלמיד · י״א3', 'תלמיד תיכון'],
    ['u-avi', 'הורה · דנה ויואב', 'בורר ילד, סיכום שבועי, הודעה למחנכת'],
    ['u-ronit', 'הורה · לא מקושרת', 'מתחברת לילד בקוד מבית הספר'],
    ['u-rina', 'מורה · מחנכת ט׳2', 'תיבת הודעות, הגשות והיעדרויות'],
    ['u-moshe', 'מורה למתמטיקה', 'רואה רק את המקצוע שלו'],
    ['u-admin', 'הנהלת בית הספר', 'לוח בקרה, קישורים, מדיניות וביקורת'],
  ];
  $app.innerHTML = `
  <main class="login">
    <section class="login-brand">
      <div class="brand-row">${mark(40)}<span>אלומה</span></div>
      <h1>פשוט שואלים.</h1>
      <p>סוכנת AI שמחוברת למערכות של בית הספר ועונה לתלמידים, להורים ולמורים – בלי לחפש בתפריטים.</p>
      <ul class="brand-points">
        <li>${icon('database')} תשובות מבוססות נתונים, עם מקור לכל עובדה</li>
        <li>${icon('lock')} כל משתמש רואה רק את מה שמותר לו</li>
        <li>${icon('check')} שום הודעה לא נשלחת בלי אישור</li>
      </ul>
    </section>
    <section class="login-pick">
      <h2>כניסה עם חשבון אמיתי</h2>
      <p class="hint">קריאה בלבד מ-Google Classroom: כיתות, מטלות, ציונים והודעות. אלומה לא משנה ולא שולחת כלום.</p>
      <button class="gbtn" id="gsignin"><svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg><span>התחברות עם Google · Classroom</span></button>
      <div id="gmsg"></div>
      <div class="or"><span>או</span></div>
      <h2>כניסה לחשבון לדוגמה</h2>
      <p class="hint">אב-טיפוס עם נתוני דמה. ההתחברות האמיתית תהיה דרך חשבון בית הספר.</p>
      <div class="who-list">
        ${demo.map(([id, r, d]) => `<button class="who" data-login="${id}"><span class="avatar">${esc(nameOf(id)[0])}</span><span class="who-t"><b>${esc(nameOf(id))}</b><small>${esc(r)} · ${esc(d)}</small></span><span class="chev" aria-hidden="true">‹</span></button>`).join('')}
      </div>
      <button class="btn link" id="reset">איפוס נתוני הדמה</button>
    </section>
  </main>`;
  $app.querySelectorAll('[data-login]').forEach(b => b.onclick = () => {
    setSession({ userId: b.dataset.login }); audit(b.dataset.login, 'login', {}); boot();
  });
  document.getElementById('gsignin').onclick = async e => {
    const b = e.currentTarget, msg = document.getElementById('gmsg');
    b.disabled = true; msg.innerHTML = '<p class="hint">מתחברת ל-Google ומושכת את הנתונים מ-Classroom…</p>';
    try {
      const prof = await G.signIn();
      ctx = liveContext(prof); activeStudentId = ctx.userId; activeConvId = null; view = 'chat';
      audit(ctx.userId, 'login', {}); render();
    } catch (err) { b.disabled = false; msg.innerHTML = `<p class="err">${esc(err.message)}</p>`; }
  };
  document.getElementById('reset').onclick = () => { if (confirm('לאפס את כל נתוני הדמה בדפדפן הזה?')) { resetAll(); renderLogin(); } };
}

// ---------------- shell: top bar + sidebar ----------------
const PROMPT_TOOLS = {
  parent: [['list', 'סיכום שבועי', 'מה המצב השבוע?'], ['task', 'מטלות פתוחות', 'יש הגשות פתוחות?'], ['calendar', 'מה יש מחר', 'מה יש מחר?'], ['mail', 'הודעה למחנכת', 'תכתוב למחנכת ש']],
  teacher: [['task', 'מי לא הגיש', 'מי לא הגיש בט׳2?'], ['chart', 'ממוצע כיתה', 'מה הממוצע במבחן האחרון בט׳2?'], ['calendar', 'היעדרויות בכיתה', 'מי בט׳2 עם יותר מ-3 היעדרויות?']],
};
const STUDENT_TOOLS = [['path', 'sparkle', 'מסלול תרגול'], ['cards', 'layers', 'כרטיסיות זיכרון'], ['planner', 'calendar', 'תוכנית למידה']];
const ADMIN_NAV = [['dash', 'chart', 'לוח בקרה'], ['links', 'users', 'משתמשים וקישורים'], ['policy', 'shield', 'מדיניות'], ['audit', 'log', 'יומן ביקורת']];

function render() {
  if (db().emergencyStop && ctx.role !== 'school_admin') {
    $app.innerHTML = `${topBar()}<div class="stopped"><h1>אלומה מושבתת זמנית</h1><p>בית הספר הפסיק את השירות באופן זמני. המידע שלך זמין כרגיל במערכות בית הספר.</p></div>`;
    bindTop(); return;
  }
  const views = ctx.role === 'school_admin' ? ADMIN_NAV.map(n => n[0]) : ['chat', 'settings', 'inbox', 'path', 'lesson', 'cards', 'planner'];
  if (!views.includes(view)) view = views[0];
  $app.innerHTML = `${topBar()}<div class="layout"><aside class="side" id="side" aria-label="תפריט אלומה">${sidebar()}</aside>
    <div class="scrim" id="scrim"></div><main class="main"><div id="view"></div></main></div>`;
  bindTop(); bindSide();
  ({ chat: renderChat, settings: renderSettings, inbox: renderInbox, dash: renderDash, links: renderLinks, policy: renderPolicy, audit: renderAudit,
     path: renderPath, lesson: renderLesson, cards: renderCards, planner: renderPlanner })[view]();
}
function persistSession() { if (!ctx.live) setSession({ userId: ctx.userId, activeStudentId, view, convId: activeConvId }); }  // live Google sessions are never stored
function liveContext(profile) {
  const id = 'g-' + profile.sub;
  return { userId: id, role: 'student', live: true, user: { id, name: profile.name, email: profile.email, gender: null }, allowedStudentIds: [id], classIds: [],
    scopes: { grades: true, assignments: true, schedule: true, attendance: true, messages: true, send: true } };
}
function go(v) { view = v; persistSession(); render(); window.scrollTo(0, 0); }

function sidebar() {
  const item = (on, ic, label, extra = '', attrs = '') => `<button class="nav ${on ? 'on' : ''}" ${attrs}>${icon(ic)}<span class="lb">${label}</span>${extra}</button>`;
  const head = `<div class="side-head">${mark(28)}<span class="side-name">אלומה</span><button class="iconbtn ghost side-close" id="sideclose" aria-label="סגירת התפריט">✕</button></div>`;
  if (ctx.role === 'school_admin') return `${head}<div class="side-sec">ניהול בית הספר</div>${ADMIN_NAV.map(([k, i, l]) => item(view === k, i, l, '', `data-go="${k}"`)).join('')}${sideUser()}`;
  const convs = convList();
  let h = `${head}<button class="newchat" id="newchat">${icon('plus')}<span>שיחה חדשה</span></button>`;
  h += `<div class="side-sec">כלים</div>`;
  if (ctx.role === 'student') {
    const p = L.progress(ctx.userId);
    h += STUDENT_TOOLS.map(([k, i, l]) => item(['path', 'lesson'].includes(view) ? k === 'path' : view === k, i, l, k === 'path' && p.xp ? `<span class="xp">${p.xp} XP</span>` : '', `data-go="${k}"`)).join('');
  } else {
    if (ctx.role === 'teacher') { const unread = db().inbox.filter(m => m.teacherId === ctx.userId && !m.read).length; h += item(view === 'inbox', 'inbox', 'תיבת הודעות', unread ? `<span class="badge">${unread}</span>` : '', 'data-go="inbox"'); }
    h += PROMPT_TOOLS[ctx.role].map(([i, l, q]) => item(false, i, l, '', `data-prompt="${esc(q)}"`)).join('');
  }
  h += `<div class="side-sec">שיחות אחרונות</div><div class="convs">
    ${convs.map(c => `<div class="conv ${view === 'chat' && c.id === activeConvId ? 'on' : ''}"><button class="conv-open" data-conv="${c.id}" title="${esc(c.title)}"><span>${esc(c.title)}</span></button>
      <button class="conv-del" data-delconv="${c.id}" aria-label="מחיקת השיחה">${icon('trash', 15)}</button></div>`).join('') || '<div class="side-empty">השיחות שלך יופיעו כאן</div>'}</div>`;
  return h + sideUser();
}
function sideUser() {
  return `<div class="side-bottom"><button class="me-row ${view === 'settings' ? 'on' : ''}" ${ctx.role === 'school_admin' ? '' : 'data-go="settings"'}>
    <span class="avatar">${esc(ctx.user.name[0])}</span><span class="who-t"><b>${esc(ctx.user.name)}</b><small>${esc(ROLE_NAMES[ctx.role])}</small></span>${ctx.role === 'school_admin' ? '' : icon('settings', 16)}</button></div>`;
}
function bindSide() {
  const side = document.getElementById('side');
  side.querySelectorAll('[data-go]').forEach(b => b.onclick = () => go(b.dataset.go));
  side.querySelectorAll('[data-conv]').forEach(b => b.onclick = () => { activeConvId = b.dataset.conv; go('chat'); });
  side.querySelectorAll('[data-delconv]').forEach(b => b.onclick = () => {
    const list = convList(); const i = list.findIndex(c => c.id === b.dataset.delconv);
    if (i > -1 && confirm('למחוק את השיחה?')) { list.splice(i, 1); save(); audit(ctx.userId, 'history_deleted', {}); if (activeConvId === b.dataset.delconv) activeConvId = null; render(); }
  });
  const nc = document.getElementById('newchat'); if (nc) nc.onclick = () => { activeConvId = null; go('chat'); };
  side.querySelectorAll('[data-prompt]').forEach(b => b.onclick = () => {
    activeConvId = null; go('chat');
    const q = b.dataset.prompt;
    if (q.endsWith('ש')) { const i = document.getElementById('q'); i.value = q; i.focus(); } else ask(q);
  });
  document.getElementById('scrim').onclick = () => document.body.classList.remove('side-open');
  const sc = document.getElementById('sideclose'); if (sc) sc.onclick = () => document.body.classList.remove('side-open');
}

function topBar() {
  const kids = ctx.role === 'parent' ? ctx.allowedStudentIds : [];
  const titles = { chat: (currentConv(false) || {}).title || 'שיחה חדשה', path: 'מסלול תרגול', lesson: 'מסלול תרגול', cards: 'כרטיסיות זיכרון', planner: 'תוכנית למידה', settings: 'הגדרות', inbox: 'תיבת הודעות',
    dash: 'לוח בקרה', links: 'משתמשים וקישורים', policy: 'מדיניות', audit: 'יומן ביקורת' };
  return `<header class="top">
    <button class="iconbtn ghost burger" id="burger" aria-label="תפריט">${icon('menu')}</button>
    <div class="top-title">${esc(titles[view] || '')}</div>
    ${kids.length ? `<label class="sr-only" for="kid">על מי מדברים?</label><div class="kid-pick">${icon('users', 16)}<select id="kid">${kids.map(id => `<option value="${id}" ${id === activeStudentId ? 'selected' : ''}>${esc(nameOf(id))}</option>`).join('')}</select></div>` : ''}
    <span class="spacer"></span>
    <span class="model-pill" title="${AI.enabled() ? 'התשובות נוצרות ב-Gemini' : 'מנוע מקומי – אפשר לחבר Gemini בהגדרות'}">${icon('sparkle', 14)} ${AI.enabled() ? `Gemini${AI.currentModel() ? ' · ' + esc(AI.currentModel()) : ''}` : 'מנוע מקומי'}</span>
    <button class="iconbtn ghost" id="theme" title="מצב כהה/בהיר" aria-label="מצב כהה או בהיר">${icon(document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon')}</button>
    <button class="iconbtn ghost" id="logout" title="התנתקות" aria-label="התנתקות">${icon('logout')}</button>
  </header>`;
}
function bindTop() {
  const kid = document.getElementById('kid');
  if (kid) kid.onchange = () => { activeStudentId = kid.value; activeConvId = null; persistSession(); render(); };
  const burger = document.getElementById('burger'); if (burger) burger.onclick = () => document.body.classList.toggle('side-open');
  document.getElementById('theme').onclick = () => {
    const th = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = th; try { localStorage.setItem('aluma-theme', JSON.stringify(th)); } catch { /* ignore */ }
    render();
  };
  document.getElementById('logout').onclick = () => { audit(ctx.userId, 'logout', {}); if (ctx.live) G.signOut(); setSession(null); ctx = null; document.body.classList.remove('side-open'); renderLogin(); };
}

// ---------------- chat (several conversations per user, spec 13) ----------------
const convKey = () => `${ctx.userId}|${activeStudentId || '-'}`;
const convList = () => ((db().convs = db().convs || {})[convKey()] = db().convs[convKey()] || []);
function currentConv(create) {
  let c = convList().find(x => x.id === activeConvId);
  if (!c && create) { c = { id: 'c' + Date.now().toString(36), title: 'שיחה חדשה', at: new Date().toISOString(), messages: [] }; convList().unshift(c); activeConvId = c.id; persistSession(); }
  return c;
}
const transcript = () => currentConv(true).messages;

const SUGGEST = {
  student: [['מה יש לי מחר?', 'מערכת שעות ושינויים', 'calendar'], ['כמה קיבלתי במבחן האחרון בהיסטוריה?', 'ציונים עם מקור', 'chart'], ['מה להגיש השבוע?', 'מטלות מ-Classroom', 'task'], ['תנסחי למורה שאני חולה היום', 'טיוטה לאישור שלך', 'mail']],
  parent: [['מה המצב השבוע?', 'סיכום ציונים, מטלות והיעדרויות', 'list'], ['ציונים אחרונים', 'לפי מקצוע', 'chart'], ['יש הגשות פתוחות?', 'מה עוד לא הוגש', 'task'], ['היעדרויות החודש', 'נוכחות מ-30 יום', 'calendar']],
  teacher: [['מי לא הגיש בט׳2?', 'לפי המטלה האחרונה', 'task'], ['מה הממוצע במבחן האחרון בט׳2?', 'ממוצע, טווח ונבחנים', 'chart'], ['מי בט׳2 עם יותר מ-3 היעדרויות?', 'למחנכים', 'calendar'], ['הודעות חדשות', 'סיכום תיבת ההודעות', 'inbox']],
};
function renderChat() {
  const v = document.getElementById('view');
  const conv = currentConv(false);
  const tr = conv ? conv.messages : [];
  const noKids = ctx.role === 'parent' && !activeStudentId;
  const hello = `${new Date().getHours() < 12 ? 'בוקר טוב' : new Date().getHours() < 18 ? 'צהריים טובים' : 'ערב טוב'}, ${firstNameOf(ctx.user.name)}`;
  v.innerHTML = `<div class="chat-wrap">
    ${tr.length ? '' : `<section class="empty">
      ${mark(52)}<h1>${esc(hello)}</h1>
      <p>${noKids ? 'כדי להתחיל, קשרו את הילד/ה בעזרת קוד מבית הספר בהגדרות.' : ctx.role === 'parent' ? `מה תרצו לדעת על ${esc(firstNameOf(nameOf(activeStudentId)))}?` : 'במה אפשר לעזור היום?'}</p>
      ${(ctx.role === 'student' || (ctx.role === 'parent' && activeStudentId)) ? todayCard() : ''}
      ${noKids ? '' : `<div class="suggest">${SUGGEST[ctx.role].map(([q, d, i]) => `<button class="sug" data-q="${esc(q)}">${icon(i)}<span><b>${esc(q)}</b><small>${esc(d)}</small></span></button>`).join('')}</div>`}
    </section>`}
    <section class="chat" id="chat" aria-label="שיחה עם אלומה"></section>
    <div class="composer"><form id="ask"><label for="q" class="sr-only">שאלה לאלומה</label>
      <textarea id="q" rows="1" placeholder="שאלו את אלומה…" ${noKids ? 'disabled' : ''}></textarea>
      <div class="comp-row"><span class="comp-hint">${icon('database', 14)} ${ctx.live ? `מחוברת: Google Classroom (${G.LIVE.courses.length} כיתות)${G.hasService('calendar') ? ' · Calendar' : ''}${G.hasService('drive') ? ' · Drive' : ''}${G.hasService('gmail') ? ' · Gmail' : ''}` : 'מחוברת: משוב · Classroom (נתוני דמה)'}</span><button class="send" aria-label="שליחה">${icon('send', 18)}</button></div></form>
      <div class="disclaimer">אלומה עלולה לטעות. כל נתון מוצג עם המקור שלו, ושום הודעה לא נשלחת בלי אישור.</div></div>
  </div>`;
  const chat = document.getElementById('chat');
  tr.forEach((m, i) => chat.appendChild(m.who === 'me' ? userMsg(m.text) : aiMsg(m.res, i === tr.length - 1)));
  v.querySelectorAll('.sug').forEach(b => b.onclick = () => ask(b.dataset.q));
  const q = document.getElementById('q');
  const grow = () => { q.style.height = 'auto'; q.style.height = Math.min(q.scrollHeight, 180) + 'px'; };
  q.oninput = grow;
  q.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); document.getElementById('ask').requestSubmit(); } };
  document.getElementById('ask').onsubmit = e => { e.preventDefault(); if (q.value.trim()) ask(q.value.trim()); q.value = ''; grow(); };
  if (tr.length) scrollDown();
}
const firstNameOf = n => n.split(' ')[0];
const scrollDown = () => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });

function todayCard() {
  try {
    const sid = activeStudentId;
    let s = T.getSchedule(ctx, { studentId: sid, dayOffsetN: 0 });
    const nowHM = `${String(NOW.getHours()).padStart(2, '0')}:${String(NOW.getMinutes()).padStart(2, '0')}`;
    let next = s.weekend ? null : s.data.find(l => l.end > nowHM && !(l.change && l.change.kind === 'cancelled'));
    let nextLabel = 'היום';
    if (!next) { for (let d = 1; d < 4; d++) { const s2 = T.getSchedule(ctx, { studentId: sid, dayOffsetN: d }); if (!s2.weekend) { next = s2.data.find(l => !(l.change && l.change.kind === 'cancelled')); nextLabel = d === 1 ? 'מחר' : `ביום ${['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי'][new Date(s2.date).getDay()]}`; break; } } }
    const asg = T.getAssignments(ctx, { studentId: sid, status: 'pending' }).data;
    const soon = asg.filter(a => new Date(a.due) > NOW && new Date(a.due) - NOW < 2 * 864e5).length;
    const late = asg.filter(a => new Date(a.due) < NOW).length;
    const ann = T.getAnnouncements(ctx, { studentId: sid }).data.filter(m => NOW - new Date(m.date) < 3 * 864e5).length;
    return `<div class="today" aria-label="תמונת מצב">
      <span class="tchip">${icon('clock', 15)} השיעור הבא ${nextLabel}: <b>${next ? esc(subjectName(next.subject)) + ' · ' + next.start : '—'}</b></span>
      <span class="tchip">${icon('task', 15)} להגשה ביומיים: <b>${soon}</b>${late ? ` <span class="tag bad">${late} באיחור</span>` : ''}</span>
      <span class="tchip">${icon('mail', 15)} הודעות חדשות: <b>${ann}</b></span>
    </div>`;
  } catch { return ''; }
}

function userMsg(text) {
  const d = document.createElement('div'); d.className = 'msg me';
  d.innerHTML = `<div class="bubble">${esc(text)}</div>`; return d;
}
function aiMsg(res, withChips) {
  const d = document.createElement('div'); d.className = 'msg ai';
  d.innerHTML = `<div class="ai-av">${mark(28)}</div><div class="ai-body"><div class="ai-name">אלומה</div><div class="ai-text">${md(res.text)}</div>
    ${res.cards.length ? `<div class="cards">${res.cards.map(cardHTML).join('')}</div>` : ''}
    ${res.note ? `<div class="ai-note">${esc(res.note)}</div>` : ''}
    ${withChips && res.chips.length ? `<div class="chips">${res.chips.map(c => `<button class="chip">${esc(c)}</button>`).join('')}</div>` : ''}</div>`;
  d.querySelectorAll('.chip').forEach(b => b.onclick = () => ask(b.textContent));
  d.querySelectorAll('[data-action]').forEach(el => bindAction(el));
  d.querySelectorAll('[data-tool]').forEach(b => b.onclick = () => { if (b.dataset.subject) toolSubject = b.dataset.subject; go(b.dataset.tool); });
  return d;
}
function addActions(el, res, question) {
  const row = document.createElement('div'); row.className = 'fb';
  row.innerHTML = `<button data-k="copy" aria-label="העתקה" title="העתקה">${icon('copy', 15)}</button><button data-k="up" aria-pressed="false" aria-label="תשובה טובה" title="תשובה טובה">${icon('up', 15)}</button>
    <button data-k="down" class="flip" aria-pressed="false" aria-label="תשובה לא טובה" title="תשובה לא טובה">${icon('up', 15)}</button>${question ? `<button data-k="again" aria-label="לשאול שוב" title="לשאול שוב">${icon('refresh', 15)}</button>` : ''}`;
  el.querySelector('.ai-body').appendChild(row);
  row.querySelector('[data-k=copy]').onclick = e => { try { navigator.clipboard.writeText(res.text.replace(/\*\*/g, '')); } catch { /* ignore */ } e.currentTarget.innerHTML = icon('check', 15); live.textContent = 'הועתק'; };
  row.querySelectorAll('[data-k=up],[data-k=down]').forEach(b => b.onclick = () => {
    row.querySelectorAll('[aria-pressed]').forEach(x => x.setAttribute('aria-pressed', 'false')); b.setAttribute('aria-pressed', 'true');
    db().feedback.push({ at: new Date().toISOString(), rating: b.dataset.k }); save();
  });
  const again = row.querySelector('[data-k=again]'); if (again) again.onclick = () => ask(question);
}

async function ask(text) {
  if (busy) return; busy = true;
  document.querySelector('.empty')?.remove();
  const chat = document.getElementById('chat');
  chat.querySelectorAll('.chips').forEach(c => c.remove());
  const conv = currentConv(true);
  if (!conv.messages.length) { conv.title = text.slice(0, 40); conv.at = new Date().toISOString(); }
  conv.messages.push({ who: 'me', text }); save();
  const side = document.getElementById('side'); if (side) { side.innerHTML = sidebar(); bindSide(); }
  const tt = document.querySelector('.top-title'); if (tt) tt.textContent = conv.title;
  chat.appendChild(userMsg(text));
  // "thinking" with visible steps (the real agent streams tool-use status, spec 13)
  const where = /מטל|להגיש|הגש|עבוד/.test(text) ? 'Classroom' : 'משוב';
  const drafting = /תנסח|תכתב|תכתוב|תשלח|למורה|למחנכ/.test(text);
  const steps = ['מבינה את השאלה', drafting ? 'בודקת למי מותר לשלוח' : `מחפשת ב${where}`, drafting ? 'מנסחת טיוטה' : 'בודקת שכל נתון מגיע מהמקור'];
  const st = document.createElement('div'); st.className = 'msg ai thinking';
  st.innerHTML = `<div class="ai-av">${mark(28)}</div><div class="ai-body"><div class="ai-name">אלומה</div><div class="steps">${steps.map((x, i) => `<div class="step" data-i="${i}"><span class="dot"></span>${x}</div>`).join('')}</div></div>`;
  chat.appendChild(st); scrollDown();
  let res;
  const quick = answer.safety && answer.safety(ctx, text);
  if (AI.enabled() && ctx.role !== 'school_admin' && !quick) {
    const box = st.querySelector('.steps');
    const STEP = { get_grades: 'מחפשת ציונים', get_assignments: 'בודקת מטלות', get_schedule: 'בודקת את המערכת', get_attendance: 'בודקת נוכחות', get_announcements: 'קוראת הודעות',
      list_my_teachers: 'בודקת למי מותר לשלוח', draft_message_to_teacher: 'מנסחת טיוטה', open_learning_tool: 'פותחת כלי תרגול', search_drive: 'מחפשת ב-Drive', read_drive_file: 'קוראת את הקובץ',
      class_summary: 'מסכמת את הכיתה', class_attendance: 'בודקת היעדרויות', inbox_summary: 'בודקת הודעות', __retry: 'Gemini עמוס – מנסה שוב' };
    box.innerHTML = '<div class="step run"><span class="dot"></span>חושבת עם Gemini</div>';
    try {
      res = await AI.geminiAnswer(ctx, text, { activeStudentId, history: conv.messages.slice(0, -1), onStep: n => {
        box.querySelectorAll('.run').forEach(x => x.classList.replace('run', 'done'));
        box.insertAdjacentHTML('beforeend', `<div class="step run"><span class="dot"></span>${STEP[n] || n}</div>`); scrollDown(); } });
    } catch (e) {
      res = answer(ctx, text, { activeStudentId });
      res = { ...res, text: res.text, note: `Gemini לא זמין (${e.message}) – ענה המנוע המקומי.` };
    }
  } else {
    for (let i = 0; i < steps.length; i++) { st.querySelector(`[data-i="${i}"]`).classList.add('run'); await sleep(260 + Math.random() * 220); st.querySelector(`[data-i="${i}"]`).classList.replace('run', 'done'); }
    res = answer(ctx, text, { activeStudentId });
  }
  st.remove();
  const el = aiMsg({ ...res, text: '', cards: [] }, false); chat.appendChild(el);
  const out = el.querySelector('.ai-text'); out.classList.add('typing');
  for (let i = 0; i <= res.text.length; i += 3) { out.innerHTML = md(res.text.slice(0, i)); await sleep(7); }
  const final = aiMsg(res, true); el.replaceWith(final);
  addActions(final, res, text);
  conv.messages.push({ who: 'ai', res }); save();
  live.textContent = res.text.replace(/\*\*/g, '');
  busy = false; scrollDown();
  document.getElementById('q')?.focus();
}

// ---------------- cards ----------------
const srcLine = (src, at) => `<div class="src">מתוך ${esc(src)}${at ? ` · עודכן ${ago(at)}` : ''}</div>`;
function cardHTML(c) {
  switch (c.type) {
    case 'grade': return `<div class="card grade"><div class="score ${c.score < 60 ? 'low' : ''}">${c.score}</div><div><div class="t">${esc(subjectName(c.subject))} · ${esc(c.title)}</div>
      <div class="m">${{ exam: 'מבחן', quiz: 'בוחן', assignment: 'עבודה' }[c.gtype] || ''} · ${fmtDate(c.date)} · מתוך ${c.max}</div>${srcLine(c.source, c.fetchedAt)}</div></div>`;
    case 'assignment': {
      const late = !!c.due && new Date(c.due) < NOW, soon = !!c.due && !late && new Date(c.due) - NOW < 864e5;
      const st = c.status === 'submitted' ? '<span class="tag ok">הוגש</span>' : late ? '<span class="tag bad">לא הוגש · באיחור</span>' : '<span class="tag">פתוח</span>';
      return `<div class="card asg"><div class="t">${esc(c.title)}</div><div class="row"><span>${esc(subjectName(c.subject))}</span>
        <span ${soon ? 'style="color:var(--coral);font-weight:700"' : ''}>${c.due ? `הגשה: ${fmtDate(c.due)} ${fmtTime(c.due)}` : 'ללא תאריך הגשה'}</span>${st}</div>
        <div class="row"><a href="${esc(c.link)}" target="_blank" rel="noopener">פתיחה ב-Classroom ↗</a></div>${srcLine(c.source, c.fetchedAt)}</div>`;
    }
    case 'schedule': return `<div class="card sched"><table><tbody>${c.lessons.map(l => `<tr class="${l.change ? 'changed' : ''} ${l.change && l.change.kind === 'cancelled' ? 'cancelled' : ''}">
      <td>${l.start}</td><td><b>${esc(subjectName(l.subject))}</b></td><td>${esc(nameOf(l.teacherId))}</td><td>חדר ${l.room}</td>
      <td>${l.change ? `<span class="tag warn">${esc(l.change.note)}</span>` : ''}</td></tr>`).join('')}</tbody></table>${srcLine(c.source, c.fetchedAt)}</div>`;
    case 'attendance': return `<div class="card list"><div class="row"><span>${fmtDate(c.date)} · ${esc(subjectName(c.subject))}</span><span class="tag ${c.status === 'absent' ? 'bad' : 'warn'}">${c.status === 'absent' ? 'היעדרות' : 'איחור'}</span></div>${srcLine(c.source, c.fetchedAt)}</div>`;
    case 'announcement': return `<div class="card ann"><div class="h">${esc(c.subject)}</div><div class="m" style="font-size:13px;color:var(--ink2)">${esc(c.teacherName)} · ${fmtDate(c.date)}</div>
      <div class="b">${esc(c.body)}</div><div class="ext">תוכן חיצוני ממשוב – מוצג כמו שהוא. אלומה לא מבצעת הוראות שכתובות בתוכו.</div></div>`;
    case 'stat': return `<div class="card stat"><span class="v">${c.value}</span><span>${esc(c.label)}</span>${srcLine(c.source, c.fetchedAt)}</div>`;
    case 'list': return `<div class="card list"><b>${esc(c.title)}</b>${c.rows.map(r => `<div class="row"><span>${esc(r[0])}</span><span>${esc(r[1])}</span></div>`).join('')}</div>`;
    case 'help': return `<div class="card help">${c.lines.map(l => `<div class="line"><span>${esc(l[0])}</span><b>${esc(l[1])}</b></div>`).join('')}</div>`;
    case 'action': return actionHTML(c);
    case 'events': return `<div class="card list"><b>${fmtDate(c.date)} · מתוך Google Calendar</b>${c.events.map(e => `<div class="row"><span>${e.allDay ? 'כל היום' : fmtTime(e.start)} · ${esc(e.title)}</span><span>${e.meet ? `<a href="${esc(e.meet)}" target="_blank" rel="noopener">Meet ↗</a>` : ''}</span></div>`).join('')}</div>`;
    case 'files': return `<div class="card list">${c.files.map(f => `<div class="row"><span><span class="tag">${esc(f.kind)}</span> ${esc(f.name)}</span><a href="${esc(f.link)}" target="_blank" rel="noopener">פתיחה ↗</a></div>`).join('')}<div class="src">מתוך Google Drive</div></div>`;
    case 'tool': return `<div class="card toolcard"><div class="ti">${c.icon}</div><div><div class="t">${esc(c.title)}</div><div class="m">${esc(c.desc)}</div></div><button class="btn primary" data-tool="${c.tool}" data-subject="${c.subject || ''}">${esc(c.cta)}</button></div>`;
  }
  return '';
}

function actionHTML(c) {
  const a = db().actions[c.actionId] || {};
  const status = a.status || 'draft';
  return `<div class="card action" data-action="${c.actionId}" data-token="${esc(c.confirmToken)}">
    <div class="to">אל: <b>${esc(c.to.name)}</b> (${esc(c.to.homeroom ? g(c.to, 'מחנך', 'מחנכת') : c.to.subjects.join(', '))}) · נושא: <b>${esc(c.subject)}</b></div>
    ${status === 'draft' ? `<label class="sr-only" for="b-${c.actionId}">גוף ההודעה</label><textarea id="b-${c.actionId}">${esc(a.body || c.body)}</textarea>
      <div class="btns"><button class="btn primary" data-do="send">אישור ושליחה</button><button class="btn link" data-do="cancel">ביטול</button></div>`
      : `<div class="body">${esc(a.body || c.body)}</div><div class="${status === 'sent' ? 'sent' : 'err'}">${{ sent: `נשלח ✓ ${fmtTime(a.sentAt)}`, cancelled: 'בוטל – לא נשלח', expired: 'תוקף הטיוטה פג' }[status] || ''}</div>`}
    <div class="ai-mark">ההודעה תסומן אצל המורה: "נוסחה בעזרת אלומה ואושרה ע״י השולח/ת"</div>
  </div>`;
}

function bindAction(el) {
  const id = el.dataset.action;
  const send = el.querySelector('[data-do=send]'), cancel = el.querySelector('[data-do=cancel]');
  if (cancel) cancel.onclick = () => { const a = db().actions[id]; if (a && a.status === 'draft') { a.status = 'cancelled'; save(); audit(ctx.userId, 'draft_cancelled', { action: id }); } el.outerHTML = actionHTML(cardFromAction(id)); };
  if (send) send.onclick = async () => {
    try {
      send.disabled = true; send.textContent = ctx.live ? 'שולחת ב-Gmail…' : 'שולחת…';
      const a = await T.confirmAction(ctx, id, el.dataset.token, el.querySelector('textarea').value);
      if (a.via === 'gmail') {
        const t = G.LIVE.teachers.find(x => x.id === a.teacherId) || { name: a.teacherId };
        el.innerHTML = `<div class="to">אל: <b>${esc(t.name)}</b> (${esc(t.email || '')}) · נושא: <b>${esc(a.subject)}</b></div><div class="body">${esc(a.body)}</div><div class="sent">נשלח ב-Gmail ✓</div>`;
        live.textContent = 'ההודעה נשלחה'; return;
      }
      const teacher = TEACHERS.find(t => t.id === a.teacherId);
      const qs = db().settings[teacher.id] || {};
      const when = quietUntil(qs.quietFrom || db().policies.quietFrom, qs.quietTo || db().policies.quietTo);
      el.innerHTML = `<div class="to">אל: <b>${esc(teacher.name)}</b> · נושא: <b>${esc(a.subject)}</b></div><div class="body">${esc(a.body)}</div>
        <div class="sent">נשלח ✓ ${when ? `· ${esc(teacher.name)} ${g(teacher, 'יקבל', 'תקבל')} את ההודעה ב-${when} (שעות שקט)` : ''}</div>
        <div class="btns"><button class="btn" data-do="undo">ביטול שליחה (<span>10</span>)</button></div>`;
      live.textContent = 'ההודעה נשלחה';
      const undo = el.querySelector('[data-do=undo]');
      let n = 10; const timer = setInterval(() => { n--; if (undo.isConnected) undo.querySelector('span').textContent = n; if (n <= 0) { clearInterval(timer); undo.remove(); } }, 1000);
      undo.onclick = () => { clearInterval(timer); if (T.undoAction(ctx, id)) { el.outerHTML = actionHTML(cardFromAction(id)); live.textContent = 'השליחה בוטלה'; } };
    } catch (e) {
      if (send.isConnected) { send.disabled = false; send.textContent = 'אישור ושליחה'; }
      el.querySelector('.err')?.remove();
      el.insertAdjacentHTML('beforeend', `<div class="err">${esc(e.message)}</div>`);
    }
  };
}
function cardFromAction(id) {
  const a = db().actions[id]; const t = TEACHERS.find(x => x.id === a.teacherId) || G.LIVE.teachers.find(x => x.id === a.teacherId) || { name: a.teacherId, subjects: [] };
  return { actionId: id, confirmToken: '', to: { name: t.name, subjects: t.subjects.map(subjectName), homeroom: false }, subject: a.subject, body: a.body };
}
function quietUntil(from, to) {
  const hm = `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`;
  const inQuiet = from > to ? (hm >= from || hm < to) : (hm >= from && hm < to);
  return inQuiet ? to : null;
}

// ---------------- settings (students / parents / teachers) ----------------
function renderSettings() {
  const v = document.getElementById('view');
  const mem = db().memories[ctx.userId] || [];
  let html = ctx.live ? `<section class="panel"><h2>חיבורים</h2><table class="t"><tbody>
    <tr><td><b>Google Classroom</b><div class="hint">${esc(ctx.user.email || '')}</div></td><td>${G.LIVE.courses.length ? '<span class="tag ok">מחובר</span>' : '<span class="tag warn">מחובר, בלי כיתות</span>'}</td>
      <td>${G.LIVE.courses.filter(c => c.role === 'student').length} כיתות כתלמיד/ה · ${G.LIVE.courses.filter(c => c.role === 'teacher').length} כמורה · ${G.LIVE.assignments.length} מטלות · ${G.LIVE.grades.length} ציונים · עודכן ${G.LIVE.fetchedAt ? ago(G.LIVE.fetchedAt) : ''}</td></tr>
    <tr><td><b>משוב</b></td><td><span class="tag warn">לא מחובר</span></td><td>מערכת שעות, נוכחות וציוני מבחנים (Q-01)</td></tr></tbody></table>
    ${G.LIVE.courses.length ? `<h3>הכיתות שנמצאו</h3><ul class="hint">${G.LIVE.courses.map(c => `<li>${esc(c.name)}${c.section ? ' · ' + esc(c.section) : ''} – ${c.role === 'teacher' ? 'מורה' : 'תלמיד/ה'} · ${G.LIVE.assignments.filter(a => a.subject === c.name).length} מטלות</li>`).join('')}</ul>`
      : '<p class="hint">Google לא החזירה אף כיתה לחשבון הזה. בדקו שהחשבון רשום לכיתה ב-Classroom (classroom.google.com) – כתלמיד או כמורה – ושזה אותו חשבון שאיתו התחברתם.</p>'}
    ${G.LIVE.errors.length ? `<h3>שגיאות בקריאה מ-Classroom</h3><ul class="err">${G.LIVE.errors.map(e => `<li>${esc(e)}</li>`).join('')}</ul>` : ''}
    <div class="btns"><button class="btn" id="grefresh">רענון מ-Classroom</button></div></section>` : '';
  if (ctx.live) html += `<section class="panel"><h2>שירותי Google נוספים</h2><p class="hint">כל שירות מתחבר בנפרד ומבקש רק את ההרשאה שהוא צריך.</p><table class="t"><tbody>
    ${Object.entries(G.SERVICES).map(([k, sv]) => `<tr><td><b>${esc(sv.label)}</b><div class="hint">${esc(sv.desc)}</div></td><td>${G.hasService(k) ? '<span class="tag ok">מחובר</span>' : `<button class="btn" data-svc="${k}">חיבור</button>`}</td></tr>`).join('')}
    </tbody></table><div id="svcmsg"></div></section>`;
  html += `<section class="panel"><h2>מנוע ה-AI</h2>
    <p class="hint">${AI.enabled() ? `התשובות נוצרות ב-<b>Gemini</b>${AI.currentModel() ? ` (${esc(AI.currentModel())})` : ''}. ההרשאות עדיין נבדקות בכלים – Gemini רואה רק את מה שמותר לך.` : 'כרגע עונה מנוע מקומי פשוט. אפשר לחבר Gemini עם מפתח API.'}</p>
    <form class="formrow" id="aiform"><label for="gkey">מפתח Gemini API</label><input type="password" id="gkey" autocomplete="off" placeholder="${AI.getKey() ? '•••••••• (שמור בדפדפן הזה)' : 'AIza…'}" style="flex:1;min-width:200px">
      <button class="btn primary">שמירה ובדיקה</button>${AI.getKey() ? '<button class="btn link" type="button" id="gkeydel">מחיקת המפתח</button>' : ''}</form><div id="aimsg"></div>
    <p class="hint">המפתח נשמר <b>רק בדפדפן הזה</b> ולא נכנס לקוד האתר. שימו לב: בשכבה החינמית של Gemini, Google עשויה להשתמש בתוכן לשיפור המוצרים שלה – אל תשתמשו בה עם נתונים אמיתיים של תלמידים. לפיילוט צריך שכבה בתשלום ושרת מתווך.</p></section>`;
  html += `<section class="panel"><h2>מה אלומה זוכרת עליי</h2><p class="hint">אפשר לבקש בצ׳אט: "תזכרי שתמיד תעני לי בקצרה". מידע רגיש לא נשמר.</p>
    ${mem.length ? `<table class="t"><tbody>${mem.map(m => `<tr><td>${esc(m.text)}</td><td style="width:90px">${fmtDate(m.at)}</td><td style="width:70px"><button class="btn link" data-delmem="${m.id}">מחיקה</button></td></tr>`).join('')}</tbody></table>` : '<p class="hint">עוד לא שמרתי כלום.</p>'}
    <div class="formrow"><button class="btn" id="clearhist">מחיקת כל היסטוריית השיחות</button></div></section>`;
  if (ctx.role === 'student') {
    const parents = db().links.filter(l => l.studentId === ctx.userId && l.status === 'active');
    html += `<section class="panel"><h2>מי יכול לראות את המידע שלי</h2><p class="hint">הורים מקושרים רואים ציונים, מטלות, נוכחות ומערכת שעות. הם <b>לא</b> רואים את השיחות שלך עם אלומה ואת ההודעות שלך למורים.</p>
      ${parents.length ? parents.map(l => `<div class="formrow">👤 ${esc(nameOf(l.parentId))} · קושר ${fmtDate(l.verifiedAt || l.createdAt)}</div>`).join('') : '<p class="hint">אין הורים מקושרים.</p>'}</section>`;
  }
  if (ctx.role === 'parent') {
    const links = db().links.filter(l => l.parentId === ctx.userId);
    html += `<section class="panel"><h2>הילדים שלי</h2>
      ${links.length ? `<table class="t"><tbody>${links.map(l => `<tr><td>${esc(nameOf(l.studentId))}</td><td>${{ active: '<span class="tag ok">פעיל</span>', pending: '<span class="tag warn">ממתין לאישור</span>', blocked: '<span class="tag bad">חסום</span>' }[l.status]}</td></tr>`).join('')}</tbody></table>` : '<p class="hint">אין ילדים מקושרים.</p>'}
      <h3>קישור ילד בעזרת קוד מבית הספר</h3><p class="hint">את הקוד מנפיק בית הספר. אי אפשר לקשר ילד בלי קוד או אישור של בית הספר.</p>
      <form class="formrow" id="linkform"><label for="code">קוד הזמנה</label><input type="text" id="code" maxlength="9" placeholder="למשל AB12-CD34" style="text-transform:uppercase"><button class="btn primary">קישור</button></form>
      <div id="linkmsg"></div></section>`;
  }
  if (ctx.role === 'teacher') {
    const s = db().settings[ctx.userId] || {};
    html += `<section class="panel"><h2>שעות שקט</h2><p class="hint">הודעות שנשלחות בשעות האלה יחכו לך לבוקר. השולח רואה מתי תקבלו אותן.</p>
      <form class="formrow" id="quiet"><label>לא לשלוח הודעות בין</label><input type="time" id="qf" value="${s.quietFrom || db().policies.quietFrom}"> ל- <input type="time" id="qt" value="${s.quietTo || db().policies.quietTo}"><button class="btn primary">שמירה</button></form></section>`;
  }
  v.innerHTML = html;
  v.querySelectorAll('[data-svc]').forEach(b => b.onclick = async () => {
    b.disabled = true; b.textContent = 'מתחברת…';
    try { await G.connectService(b.dataset.svc); audit(ctx.userId, 'service_connected', { kind: b.dataset.svc }); renderSettings(); }
    catch (e) { b.disabled = false; b.textContent = 'חיבור'; v.querySelector('#svcmsg').innerHTML = `<p class="err">${esc(e.message)}</p>`; }
  });
  const af = v.querySelector('#aiform');
  if (af) af.onsubmit = async e => {
    e.preventDefault(); const k = v.querySelector('#gkey').value.trim(); const msg = v.querySelector('#aimsg');
    if (!k) { msg.innerHTML = '<p class="err">הדביקו מפתח.</p>'; return; }
    AI.setKey(k); msg.innerHTML = '<p class="hint">בודקת את המפתח…</p>';
    try { const m = await AI.test(t => { msg.innerHTML = `<p class="hint">${esc(t)}</p>`; }); msg.innerHTML = `<p class="sent">מחובר ✓ המודל: ${esc(m)}</p>`; setTimeout(render, 900); }
    catch (err) { AI.setKey(''); msg.innerHTML = `<p class="err">${esc(err.message)}</p>`; }
  };
  const kd = v.querySelector('#gkeydel'); if (kd) kd.onclick = () => { AI.setKey(''); render(); };
  const gr = v.querySelector('#grefresh');
  if (gr) gr.onclick = async () => { gr.disabled = true; gr.textContent = 'מרעננת…'; try { await G.refresh(); renderSettings(); } catch (e) { gr.disabled = false; gr.insertAdjacentHTML('afterend', `<span class="err">${esc(e.message)}</span>`); } };
  v.querySelectorAll('[data-delmem]').forEach(b => b.onclick = () => { db().memories[ctx.userId] = mem.filter(m => m.id !== b.dataset.delmem); save(); audit(ctx.userId, 'memory_deleted', {}); renderSettings(); });
  v.querySelector('#clearhist').onclick = () => { if (confirm('למחוק את כל השיחות? אי אפשר לשחזר.')) { Object.keys(db().convs || {}).filter(k => k.startsWith(ctx.userId + '|')).forEach(k => delete db().convs[k]); activeConvId = null; save(); audit(ctx.userId, 'history_deleted', {}); alert('ההיסטוריה נמחקה.'); } };
  const lf = v.querySelector('#linkform');
  if (lf) lf.onsubmit = e => { e.preventDefault(); linkWithCode(v.querySelector('#code').value); };
  const qf = v.querySelector('#quiet');
  if (qf) qf.onsubmit = e => { e.preventDefault(); db().settings[ctx.userId] = { ...(db().settings[ctx.userId] || {}), quietFrom: v.querySelector('#qf').value, quietTo: v.querySelector('#qt').value }; save(); qf.insertAdjacentHTML('beforeend', '<span class="sent">נשמר ✓</span>'); };
}

function linkWithCode(raw) {
  const code = raw.trim().toUpperCase().replace(/[\s-]/g, '');
  const msg = document.getElementById('linkmsg');
  const fails = (db().linkFails = db().linkFails || {})[ctx.userId] || { n: 0, until: 0 };
  if (fails.until > Date.now()) { msg.innerHTML = '<div class="err">יותר מדי ניסיונות. נסו שוב בעוד 30 דקות.</div>'; return; }
  const c = db().parentCodes.find(x => x.code === code && !x.usedBy && new Date(x.expiresAt) > new Date());
  if (!c) {
    fails.n++; if (fails.n >= 5) { fails.until = Date.now() + 30 * 60000; fails.n = 0; } db().linkFails[ctx.userId] = fails; save();
    audit(ctx.userId, 'link_code_failed', {});
    msg.innerHTML = '<div class="err">הקוד לא תקף או שכבר נוצל.</div>'; return;
  }
  c.usedBy = ctx.userId;
  db().links = db().links.filter(l => !(l.parentId === ctx.userId && l.studentId === c.studentId));
  db().links.push({ parentId: ctx.userId, studentId: c.studentId, status: 'active', verifiedBy: 'school_code', createdAt: new Date().toISOString(), verifiedAt: new Date().toISOString() });
  save(); audit(ctx.userId, 'parent_linked', { subjectStudent: c.studentId });
  ctx = buildContext(ctx.userId); activeStudentId = c.studentId; persistSession();
  render(); setTimeout(() => { const m = document.getElementById('linkmsg'); if (m) m.innerHTML = `<div class="sent">קושרת ל${esc(nameOf(c.studentId))} ✓ (${esc(nameOf(c.studentId))} ${g(findUser(c.studentId), 'יקבל', 'תקבל')} הודעה על כך)</div>`; }, 0);
}

// ---------------- teacher inbox (spec 08) ----------------
function renderInbox() {
  const v = document.getElementById('view');
  const msgs = db().inbox.filter(m => m.teacherId === ctx.userId).sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt));
  const tags = [...new Set(msgs.map(m => m.tag))];
  v.innerHTML = `<section class="panel"><h2>הודעות דרך אלומה</h2>
    <p class="hint">${msgs.length ? `היום: ${tags.map(t => `${msgs.filter(m => m.tag === t && new Date(m.sentAt).toDateString() === new Date().toDateString()).length} ${t}`).join(' · ')}` : 'עוד אין הודעות. נסו להתחבר כנועה ולשלוח הודעה למורה.'}</p>
    ${msgs.map(m => {
      const st = findUser(m.studentId), cls = CLASSES.find(c => c.id === st.classId);
      return `<article class="mail ${m.read ? '' : 'unread'}"><div class="h"><span><b>${esc(nameOf(m.fromUserId))}</b> ${m.fromRole === 'parent' ? `(הורה של ${esc(st.name)})` : ''} · ${esc(cls.name)}</span>
        <span><span class="tag">${esc(m.tag)}</span> ${fmtDate(m.sentAt)} ${fmtTime(m.sentAt)}</span></div>
        <div style="font-weight:700;margin-top:6px">${esc(m.subject)}</div><div class="b">${esc(m.body)}</div>
        <div class="ai-mark">נוסחה בעזרת אלומה ואושרה ע״י השולח/ת</div>
        <div class="btns" style="display:flex;gap:8px;margin-top:8px">${m.read ? '' : `<button class="btn" data-read="${m.id}">סימון כנקרא</button>`}<button class="btn link" data-report="${m.id}">${m.reported ? 'דווח להנהלה ✓' : 'דיווח על הודעה פוגענית'}</button></div></article>`;
    }).join('')}</section>`;
  v.querySelectorAll('[data-read]').forEach(b => b.onclick = () => { db().inbox.find(m => m.id === b.dataset.read).read = true; save(); render(); });
  v.querySelectorAll('[data-report]').forEach(b => b.onclick = () => { const m = db().inbox.find(x => x.id === b.dataset.report); if (!m.reported && confirm('לדווח להנהלת בית הספר על ההודעה?')) { m.reported = true; save(); audit(ctx.userId, 'message_reported', { message: m.id }); renderInbox(); } });
}

// ---------------- admin (spec 09) ----------------
function renderDash() {
  const v = document.getElementById('view');
  const week = Date.now() - 7 * 864e5;
  const au = db().audit;
  const kpis = [
    [STUDENTS.length, 'תלמידים'], [PARENTS.length, 'הורים'], [TEACHERS.length, 'מורים'],
    [db().stats.questions, 'שאלות לאלומה'], [db().inbox.filter(m => new Date(m.sentAt) > week).length, 'הודעות למורים השבוע'],
    [au.filter(a => a.action === 'access_denied').length, 'ניסיונות גישה שנחסמו'],
  ];
  const reported = db().inbox.filter(m => m.reported);
  v.innerHTML = `<section class="panel"><h2>${esc(SCHOOL.name)}</h2><p class="hint">מספרים מצרפיים בלבד – הנהלה לא רואה תוכן של שיחות.</p>
    <div class="kpis">${kpis.map(([n, l]) => `<div class="kpi"><div class="v">${n}</div><div class="l">${l}</div></div>`).join('')}</div></section>
    <section class="panel"><h2>חיבורים</h2><table class="t"><thead><tr><th>מערכת</th><th>סטטוס</th><th>הערה</th></tr></thead><tbody>
      <tr><td>נתוני דמה</td><td><span class="tag ok">פעיל</span></td><td>אב-טיפוס</td></tr>
      <tr><td>Google Classroom</td><td><span class="tag warn">בפיתוח</span></td><td>API רשמי קיים – המחבר האמיתי הראשון (מסמך 05)</td></tr>
      <tr><td>משוב</td><td><span class="tag bad">ממתין לאישור</span></td><td>נדרשת גישה רשמית מהמפעיל (Q-01)</td></tr>
    </tbody></table></section>
    <section class="panel"><h2>הודעות שדווחו</h2>${reported.length ? reported.map(m => `<div class="mail"><div class="h"><span>מאת ${esc(nameOf(m.fromUserId))} אל ${esc(nameOf(m.teacherId))}</span><span>${fmtDate(m.sentAt)}</span></div><div class="b">${esc(m.body)}</div></div>`).join('') : '<p class="hint">אין דיווחים.</p>'}</section>
    <section class="panel" style="border-color:var(--coral)"><h2>עצירת חירום</h2><p class="hint">משביתה את אלומה לכל בית הספר מיידית. המערכות של בית הספר ממשיכות לעבוד כרגיל.</p>
      <button class="btn ${db().emergencyStop ? 'primary' : 'danger'}" id="estop">${db().emergencyStop ? 'הפעלה מחדש של אלומה' : 'עצירת חירום'}</button>
      ${db().emergencyStop ? '<span class="err" style="margin-inline-start:10px">השירות מושבת כרגע</span>' : ''}</section>`;
  v.querySelector('#estop').onclick = () => {
    if (!db().emergencyStop) {
      const typed = prompt('כדי לעצור את השירות לכל בית הספר, הקלידו: עצירה');
      if (typed !== 'עצירה') return;
    }
    db().emergencyStop = !db().emergencyStop; save(); audit(ctx.userId, db().emergencyStop ? 'emergency_stop' : 'service_resumed', {}); renderDash();
  };
}

function renderLinks() {
  const v = document.getElementById('view');
  const links = db().links;
  const codes = db().parentCodes.filter(c => !c.usedBy && new Date(c.expiresAt) > new Date());
  v.innerHTML = `<section class="panel"><h2>קישורי הורה–ילד</h2><p class="hint">הורה לא יכול לקשר את עצמו לבד: רק בקוד שבית הספר מנפיק או באישור כאן (מסמך 10).</p>
    <table class="t"><thead><tr><th>הורה</th><th>תלמיד/ה</th><th>אימות</th><th>סטטוס</th><th></th></tr></thead><tbody>
    ${links.map((l, i) => `<tr><td>${esc(nameOf(l.parentId))}</td><td>${esc(nameOf(l.studentId))}</td><td>${{ import: 'ייבוא מבית הספר', school_code: 'קוד הזמנה', admin: 'אישור הנהלה' }[l.verifiedBy] || ''}</td>
      <td>${{ active: '<span class="tag ok">פעיל</span>', blocked: '<span class="tag bad">חסום</span>', pending: '<span class="tag warn">ממתין</span>' }[l.status]}</td>
      <td><button class="btn link" data-toggle="${i}">${l.status === 'blocked' ? 'הפעלה' : 'חסימה'}</button></td></tr>`).join('')}</tbody></table>
    <h3>הנפקת קוד הזמנה להורה</h3>
    <form class="formrow" id="codeform"><label for="stu">תלמיד/ה</label><select id="stu">${STUDENTS.slice(0, 3).concat(STUDENTS.slice(3)).map(s => `<option value="${s.id}">${esc(s.name)} · ${esc(CLASSES.find(c => c.id === s.classId).name)}</option>`).join('')}</select><button class="btn primary">הנפקת קוד</button></form>
    ${codes.length ? `<table class="t"><thead><tr><th>קוד</th><th>עבור</th><th>בתוקף עד</th></tr></thead><tbody>${codes.map(c => `<tr><td style="direction:ltr;text-align:right;font-weight:800;letter-spacing:1px">${c.display || c.code}</td><td>${esc(nameOf(c.studentId))}</td><td>${fmtDate(c.expiresAt)}</td></tr>`).join('')}</tbody></table>` : ''}
    <p class="hint">לניסיון: הנפיקו קוד עבור נועה לוי, התנתקו, היכנסו כרונית לוי והזינו אותו בהגדרות.</p></section>
    <section class="panel"><h2>משתמשים</h2><table class="t"><thead><tr><th>שם</th><th>תפקיד</th><th>כיתה / מקצוע</th></tr></thead><tbody>
      ${[...TEACHERS.map(t => [t.name, 'מורה', t.subjects.map(subjectName).join(', ') + (t.homeroom ? ` · מחנך/ת ${CLASSES.find(c => c.id === t.homeroom).name}` : '')]), ...PARENTS.map(p => [p.name, 'הורה', '']), ...STUDENTS.slice(0, 12).map(s => [s.name, 'תלמיד/ה', CLASSES.find(c => c.id === s.classId).name])]
        .map(r => `<tr><td>${esc(r[0])}</td><td>${r[1]}</td><td>${esc(r[2])}</td></tr>`).join('')}
      <tr><td colspan="3" class="hint">ועוד ${STUDENTS.length - 12} תלמידים…</td></tr></tbody></table></section>`;
  v.querySelectorAll('[data-toggle]').forEach(b => b.onclick = () => { const l = links[+b.dataset.toggle]; l.status = l.status === 'blocked' ? 'active' : 'blocked'; save(); audit(ctx.userId, 'link_' + l.status, { subjectStudent: l.studentId }); renderLinks(); });
  v.querySelector('#codeform').onsubmit = e => {
    e.preventDefault();
    const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', rnd = new Uint32Array(8); crypto.getRandomValues(rnd);
    const raw = [...rnd].map(n => abc[n % abc.length]).join('');
    const code = `${raw.slice(0, 4)}-${raw.slice(4)}`;
    db().parentCodes.push({ code: code.replace('-', ''), display: code, studentId: v.querySelector('#stu').value, createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 7 * 864e5).toISOString() });
    save(); audit(ctx.userId, 'parent_code_issued', { subjectStudent: v.querySelector('#stu').value }); renderLinks();
  };
}

function renderPolicy() {
  const v = document.getElementById('view'); const p = db().policies;
  v.innerHTML = `<section class="panel"><h2>מדיניות בית הספר</h2><form id="pol">
    <h3>מה הורים רואים</h3>
    <div class="formrow"><label><input type="checkbox" id="pg" ${p.parentGrades ? 'checked' : ''}> ציונים</label><label><input type="checkbox" id="pa" ${p.parentAssignments ? 'checked' : ''}> מטלות</label><label><input type="checkbox" id="pt" ${p.parentAttendance ? 'checked' : ''}> נוכחות</label></div>
    <p class="hint">הודעות של התלמיד לא חשופות להורים בשום מצב, וגם לא השיחות עם אלומה.</p>
    <h3>הודעות</h3>
    <div class="formrow"><label for="lim">מקסימום הודעות למורים ליום, לכל משתמש</label><input type="number" id="lim" min="1" max="50" value="${p.dailyMessageLimit}"></div>
    <div class="formrow"><label>שעות שקט ברירת מחדל למורים</label><input type="time" id="qf" value="${p.quietFrom}"> עד <input type="time" id="qt" value="${p.quietTo}"></div>
    <div class="formrow"><label for="hd">שמירת היסטוריית שיחות (ימים)</label><input type="number" id="hd" min="1" max="365" value="${p.historyDays}"></div>
    <button class="btn primary">שמירה</button> <span id="saved"></span></form></section>`;
  v.querySelector('#pol').onsubmit = e => {
    e.preventDefault();
    Object.assign(p, { parentGrades: v.querySelector('#pg').checked, parentAssignments: v.querySelector('#pa').checked, parentAttendance: v.querySelector('#pt').checked,
      dailyMessageLimit: +v.querySelector('#lim').value || 10, quietFrom: v.querySelector('#qf').value, quietTo: v.querySelector('#qt').value, historyDays: +v.querySelector('#hd').value || 90 });
    save(); audit(ctx.userId, 'policy_changed', {}); v.querySelector('#saved').innerHTML = '<span class="sent">נשמר ✓</span>';
  };
}

const ACTION_NAMES = { login: 'התחברות', logout: 'התנתקות', question: 'שאלה לאלומה', view: 'צפייה בנתונים', access_denied: 'ניסיון גישה נחסם', draft_created: 'נוצרה טיוטה',
  draft_cancelled: 'טיוטה בוטלה', message_sent: 'הודעה נשלחה', message_undone: 'שליחה בוטלה', memory_saved: 'זיכרון נשמר', memory_deleted: 'זיכרון נמחק', history_deleted: 'היסטוריה נמחקה',
  parent_code_issued: 'הונפק קוד הזמנה', parent_linked: 'הורה קושר', link_code_failed: 'קוד הזמנה שגוי', link_blocked: 'קישור נחסם', link_active: 'קישור הופעל', policy_changed: 'שינוי מדיניות',
  emergency_stop: 'עצירת חירום', service_resumed: 'השירות הופעל מחדש', class_summary: 'סיכום כיתה', class_attendance: 'נוכחות כיתה', message_reported: 'דיווח על הודעה' };
function renderAudit() {
  const v = document.getElementById('view');
  const rows = db().audit.slice(-150).reverse();
  v.innerHTML = `<section class="panel"><h2>יומן ביקורת</h2><p class="hint">מי עשה מה ומתי. נרשם סוג המידע שנצפה – לא התוכן. 150 האירועים האחרונים.</p>
    <table class="t"><thead><tr><th>זמן</th><th>מי</th><th>פעולה</th><th>על מי / פרטים</th></tr></thead><tbody>
    ${rows.map(r => `<tr><td>${fmtDate(r.at)} ${fmtTime(r.at)}</td><td>${esc(nameOf(r.actor))}</td><td>${r.action === 'access_denied' ? '<span class="tag bad">' : ''}${esc(ACTION_NAMES[r.action] || r.action)}${r.action === 'access_denied' ? '</span>' : ''}</td>
      <td>${esc(r.subjectStudent ? nameOf(r.subjectStudent) : r.target ? nameOf(r.target) : r.to ? 'אל ' + nameOf(r.to) : '')}${r.kind ? ` · ${esc({ grades: 'ציונים', assignments: 'מטלות', attendance: 'נוכחות' }[r.kind] || r.kind)}` : ''}</td></tr>`).join('')}
    </tbody></table></section>`;
}

// ---------------- AI learning tools (student) ----------------
// Recommendation is grounded in the student's real grades (via the permission-checked tool).
function weakest() {
  const rows = L.LEARN_SUBJECTS.map(sub => {
    const g = T.getGrades(ctx, { studentId: ctx.userId, subject: sub }).data.slice(0, 3);
    return { sub, avg: g.length ? Math.round(g.reduce((a, b) => a + b.score, 0) / g.length) : 100, n: g.length };
  }).sort((a, b) => a.avg - b.avg);
  return rows[0];
}
function statsBar() {
  const p = L.progress(ctx.userId);
  const done = Object.keys(p.done).length;
  return `<div class="lstats"><div class="lstat"><b>${p.xp}</b><span>XP</span></div><div class="lstat"><b>🔥 ${p.streak}</b><span>ימים ברצף</span></div><div class="lstat"><b>${done}</b><span>שיעורים הושלמו</span></div></div>`;
}
function subjectTabs(current, viewName) {
  return `<div class="subj-tabs" role="tablist">${L.LEARN_SUBJECTS.map(sub => `<button class="tab" role="tab" aria-selected="${sub === current}" data-sub="${sub}">${L.BANK[sub].icon} ${esc(subjectName(sub))}</button>`).join('')}</div>`;
}
function bindSubjectTabs(v, viewName) { v.querySelectorAll('[data-sub]').forEach(b => b.onclick = () => { toolSubject = b.dataset.sub; go(viewName); }); }

function renderPath() {
  const v = document.getElementById('view');
  if (ctx.role !== 'student') { go('chat'); return; }
  const w = weakest();
  const sub = toolSubject && L.BANK[toolSubject] ? toolSubject : w.sub;
  const next = L.nextLesson(ctx.userId, sub);
  const units = L.BANK[sub].units;
  let node = 0;
  v.innerHTML = `<section class="panel lpanel"><h2 class="ph">${icon('sparkle', 20)} מסלול תרגול</h2>${statsBar()}
    <div class="reco">${icon('sparkle', 16)} <b>מומלץ לתרגל ${esc(subjectName(w.sub))}</b> – הממוצע בשלושת הציונים האחרונים שלך בו הוא ${w.avg} (מתוך משוב).</div>
    ${subjectTabs(sub)}
    <div class="path">${units.map((u, ui) => {
      const st = L.unitState(ctx.userId, sub, ui);
      return `<div class="unit"><div class="unit-h"><span>יחידה ${ui + 1}</span><b>${esc(u.title)}</b><span class="tag ${st.every(Boolean) ? 'ok' : ''}">${st.filter(Boolean).length}/${st.length}</span></div>
        <div class="nodes">${st.map((done, li) => {
          const isNext = next && next[0] === ui && next[1] === li;
          const locked = !done && !isNext;
          const off = ['0', '-70px', '-110px', '-70px', '0', '70px', '110px', '70px'][node++ % 8];
          return `<button class="node ${done ? 'done' : isNext ? 'next' : 'locked'}" style="transform:translateX(${off})" ${locked ? 'disabled aria-disabled="true"' : ''} data-lesson="${ui}:${li}" aria-label="שיעור ${li + 1} ב${esc(u.title)}${done ? ' – הושלם' : locked ? ' – נעול' : ''}">${done ? '✓' : locked ? '🔒' : '★'}${isNext ? '<span class="start">התחילו</span>' : ''}</button>`;
        }).join('')}</div></div>`;
    }).join('')}</div>
    ${!next ? '<p class="sent" style="text-align:center">סיימת את כל המסלול במקצוע הזה! 🏆</p>' : ''}
    <p class="hint">תרגול בלבד – אלומה לא כותבת עבודות להגשה. באב-הטיפוס השאלות מגיעות ממאגר מוכן; עם ה-AI הן ייווצרו מחומרי הכיתה.</p></section>`;
  bindSubjectTabs(v, 'path');
  v.querySelectorAll('[data-lesson]').forEach(b => b.onclick = () => {
    const [u, l] = b.dataset.lesson.split(':').map(Number);
    lessonState = { sub, u, l, qs: L.lessonQuestions(sub, u), i: 0, correct: 0, picked: null, checked: false };
    go('lesson');
  });
}

function renderLesson() {
  const v = document.getElementById('view');
  const s = lessonState;
  if (!s) { go('path'); return; }
  if (s.i >= s.qs.length) {
    if (!s.result) s.result = L.finishLesson(ctx.userId, s.sub, s.u, s.l, s.correct, s.qs.length);
    const p = L.progress(ctx.userId);
    v.innerHTML = `<section class="panel lesson-end"><div class="big">${s.result.passed ? '🎉' : '💪'}</div>
      <h2>${s.result.passed ? 'כל הכבוד!' : 'כמעט! נסו שוב'}</h2><p>${s.correct} מתוך ${s.qs.length} תשובות נכונות</p>
      <div class="lstats"><div class="lstat"><b>+${s.result.xp}</b><span>XP</span></div><div class="lstat"><b>🔥 ${p.streak}</b><span>ימים ברצף</span></div></div>
      <div class="btns" style="justify-content:center"><button class="btn primary" id="back">חזרה למסלול</button>${s.result.passed ? '' : '<button class="btn" id="again">ניסיון נוסף</button>'}</div></section>`;
    v.querySelector('#back').onclick = () => { toolSubject = s.sub; lessonState = null; go('path'); };
    const ag = v.querySelector('#again'); if (ag) ag.onclick = () => { lessonState = { ...s, qs: L.lessonQuestions(s.sub, s.u), i: 0, correct: 0, picked: null, checked: false, result: null }; render(); };
    live.textContent = `סיום שיעור: ${s.correct} מתוך ${s.qs.length}`;
    return;
  }
  const q = s.qs[s.i];
  const right = s.checked && s.picked === q.answer;
  v.innerHTML = `<section class="panel lesson">
    <div class="lesson-top"><button class="iconbtn" id="quit" aria-label="יציאה מהשיעור">✕</button>
      <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="${s.qs.length}" aria-valuenow="${s.i}"><i style="width:${(s.i / s.qs.length) * 100}%"></i></div>
      <span class="hint">${s.i + 1}/${s.qs.length}</span></div>
    <div class="unit-label">${L.BANK[s.sub].icon} ${esc(subjectName(s.sub))} · ${esc(L.BANK[s.sub].units[s.u].title)}</div>
    <h2 class="q" ${/[a-zA-Z]{3}/.test(q.q) && !/[א-ת]/.test(q.q) ? 'dir="ltr"' : ''}>${esc(q.q)}</h2>
    <div class="opts">${q.options.map((o, i) => `<button class="opt ${s.picked === i ? 'picked' : ''} ${s.checked && i === q.answer ? 'right' : ''} ${s.checked && s.picked === i && i !== q.answer ? 'wrong' : ''}" data-opt="${i}" ${s.checked ? 'disabled' : ''} ${/^[\x00-\x7F]+$/.test(o) ? 'dir="ltr"' : ''}>${esc(o)}</button>`).join('')}</div>
    ${s.checked ? `<div class="feedback ${right ? 'good' : 'bad'}" role="status"><b>${right ? 'נכון! +10 XP' : 'לא בדיוק'}</b><div>${esc(q.explain)}</div></div>` : ''}
    <div class="btns lesson-btns">${s.checked ? '<button class="btn primary wide" id="next">המשך</button>' : `<button class="btn primary wide" id="check" ${s.picked == null ? 'disabled' : ''}>בדיקה</button>`}</div>
  </section>`;
  v.querySelectorAll('[data-opt]').forEach(b => b.onclick = () => { s.picked = +b.dataset.opt; renderLesson(); });
  v.querySelector('#quit').onclick = () => { if (confirm('לצאת מהשיעור? ההתקדמות בשיעור הזה לא תישמר.')) { toolSubject = s.sub; lessonState = null; go('path'); } };
  const ch = v.querySelector('#check'); if (ch) ch.onclick = () => { s.checked = true; if (s.picked === q.answer) s.correct++; renderLesson(); live.textContent = s.picked === q.answer ? 'נכון' : 'לא נכון. ' + q.explain; };
  const nx = v.querySelector('#next'); if (nx) nx.onclick = () => { s.i++; s.picked = null; s.checked = false; renderLesson(); };
}

let cardIdx = 0, cardFlipped = false;
function renderCards() {
  const v = document.getElementById('view');
  if (ctx.role !== 'student') { go('chat'); return; }
  const sub = toolSubject && L.BANK[toolSubject] ? toolSubject : weakest().sub;
  const deck = L.flashDeck(sub).map((c, i) => ({ c, i, box: L.cardBox(ctx.userId, sub, i) }));
  const order = deck.slice().sort((a, b) => a.box - b.box || a.i - b.i);
  const mastered = deck.filter(d => d.box >= 4).length;
  const cur = order[cardIdx % order.length];
  v.innerHTML = `<section class="panel lpanel"><h2 class="ph">${icon('layers', 20)} כרטיסיות זיכרון</h2>
    <p class="hint">לוחצים על הכרטיס כדי להפוך. כרטיסים שלא ידעת חוזרים מהר יותר.</p>${subjectTabs(sub)}
    <div class="flash-meta"><span>${mastered} מתוך ${deck.length} נשלטים</span><div class="bar"><i style="width:${deck.length ? mastered / deck.length * 100 : 0}%"></i></div></div>
    <button class="flash ${cardFlipped ? 'flipped' : ''}" id="flash" aria-live="polite"><span class="side-l">${cardFlipped ? 'תשובה' : 'שאלה'}</span><span class="txt">${esc(cardFlipped ? cur.c[1] : cur.c[0])}</span></button>
    <div class="btns" style="justify-content:center">${cardFlipped ? '<button class="btn" id="no">לא ידעתי</button><button class="btn primary" id="yes">ידעתי ✓</button>' : '<button class="btn primary" id="flip">הצגת התשובה</button>'}</div></section>`;
  bindSubjectTabs(v, 'cards');
  const flip = () => { cardFlipped = !cardFlipped; renderCards(); };
  v.querySelector('#flash').onclick = flip;
  const f = v.querySelector('#flip'); if (f) f.onclick = flip;
  const rate = k => { L.rateCard(ctx.userId, sub, cur.i, k); cardFlipped = false; cardIdx++; renderCards(); };
  const y = v.querySelector('#yes'); if (y) y.onclick = () => rate(true);
  const n = v.querySelector('#no'); if (n) n.onclick = () => rate(false);
}

function renderPlanner() {
  const v = document.getElementById('view');
  if (ctx.role !== 'student') { go('chat'); return; }
  const p = L.progress(ctx.userId);
  const asg = T.getAssignments(ctx, { studentId: ctx.userId, status: 'pending' }).data.filter(a => new Date(a.due) > NOW);
  const fmt = d => `${['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'][new Date(d).getDay()]} ${fmtDate(d)}`;
  const minDate = new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10);
  v.innerHTML = `<section class="panel lpanel"><h2 class="ph">${icon('calendar', 20)} תוכנית למידה</h2>
    <h3>מטלות פתוחות (מ-Classroom)</h3>
    ${asg.length ? `<table class="t"><tbody>${asg.map(a => { const start = new Date(Math.max(Date.now(), new Date(a.due) - 2 * 864e5));
      return `<tr><td><b>${esc(a.title)}</b><div class="hint">${esc(subjectName(a.subject))}</div></td><td>הגשה: ${fmt(a.due)}</td><td>מומלץ להתחיל: <b>${fmt(start)}</b></td></tr>`; }).join('')}</tbody></table>` : '<p class="hint">אין מטלות פתוחות. ✅</p>'}
    <h3>תוכנית לקראת מבחן</h3>
    <form class="formrow" id="planform"><label for="psub">מקצוע</label><select id="psub">${L.LEARN_SUBJECTS.map(s => `<option value="${s}">${esc(subjectName(s))}</option>`).join('')}</select>
      <label for="pdate" style="min-width:auto">תאריך המבחן</label><input type="date" id="pdate" min="${minDate}" required><button class="btn primary">בניית תוכנית</button></form>
    ${p.plans.map((pl, pi) => `<div class="plan"><div class="plan-h"><b>${L.BANK[pl.sub].icon} מבחן ב${esc(subjectName(pl.sub))} · ${fmt(pl.date)}</b><button class="btn link" data-delplan="${pi}">מחיקה</button></div>
      ${pl.days.map((d, di) => `<div class="pday"><div class="pd">${fmt(d.date)}</div><div>${d.tasks.map((t, ti) => `<label class="ptask"><input type="checkbox" data-task="${pi}:${di}:${ti}" ${t.done ? 'checked' : ''}> ${esc(t.text)}</label>`).join('')}</div></div>`).join('')}</div>`).join('')}
  </section>`;
  v.querySelector('#planform').onsubmit = e => {
    e.preventDefault();
    const sub = v.querySelector('#psub').value, date = new Date(v.querySelector('#pdate').value + 'T08:00:00');
    const days = Math.max(1, Math.min(10, Math.ceil((date - Date.now()) / 864e5)));
    const units = L.BANK[sub].units;
    const plan = { sub, date: date.toISOString(), days: [] };
    for (let d = 0; d < days; d++) {
      const day = new Date(Date.now() + d * 864e5); const last = d === days - 1;
      const u = units[Math.min(units.length - 1, Math.floor(d * units.length / Math.max(1, days - 1)))];
      plan.days.push({ date: day.toISOString(), tasks: last
        ? [{ text: 'חזרה קלה על הכרטיסיות שלא ידעת' }, { text: 'שינה טובה – זה חלק מהלמידה 😴' }]
        : [{ text: `שיעור במסלול התרגול: ${u.title}` }, { text: '10 כרטיסיות זיכרון' }, ...(d === Math.floor(days / 2) ? [{ text: 'לשאול את המורה על מה שלא ברור' }] : [])] });
    }
    p.plans.unshift(plan); save(); audit(ctx.userId, 'study_plan_created', { kind: sub }); renderPlanner();
  };
  v.querySelectorAll('[data-task]').forEach(c => c.onchange = () => { const [a, b, t] = c.dataset.task.split(':').map(Number); p.plans[a].days[b].tasks[t].done = c.checked; save(); });
  v.querySelectorAll('[data-delplan]').forEach(b => b.onclick = () => { p.plans.splice(+b.dataset.delplan, 1); save(); renderPlanner(); });
}

boot();
