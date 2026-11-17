// Aluma prototype – UI. Roles: student, parent, teacher, school admin (specs 06–09).
import { STUDENTS, TEACHERS, PARENTS, ADMINS, CLASSES, SCHOOL, NOW, subjectName } from './data.js';
import { db, save, audit, getSession, setSession, resetAll } from './store.js';
import { buildContext, findUser, ROLE_NAMES, activeLinks, g } from './auth.js';
import * as T from './tools.js';
import { answer, welcome } from './engine.js';
import * as L from './learn.js';

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
  ctx = buildContext(s.userId);
  if (ctx.role === 'parent') activeStudentId = ctx.allowedStudentIds.includes(s.activeStudentId) ? s.activeStudentId : ctx.allowedStudentIds[0] || null;
  else if (ctx.role === 'student') activeStudentId = ctx.userId;
  view = s.view === 'lesson' ? 'path' : (s.view || (ctx.role === 'school_admin' ? 'dash' : 'chat'));
  activeConvId = s.convId || null;
  render();
}

// ---------------- login (demo accounts) ----------------
function renderLogin() {
  const demo = [
    ['u-noa', 'תלמידה, ט׳2', 'שואלת על ציונים, מטלות ומערכת, ומנסחת הודעות למורה'],
    ['u-yoav', 'תלמיד, י״א3', 'תלמיד תיכון'],
    ['u-avi', 'הורה (דנה ז׳1 ויואב י״א3)', 'בורר ילד, סיכום שבועי, הודעה למחנכת'],
    ['u-ronit', 'הורה – עוד לא מקושרת', 'מקבלת קוד הזמנה מהמנהל כדי להתחבר לנועה'],
    ['u-rina', 'מורה להיסטוריה, מחנכת ט׳2', 'תיבת הודעות, מי לא הגיש, היעדרויות'],
    ['u-moshe', 'מורה למתמטיקה', 'מורה מקצועי – רואה רק את המקצוע שלו'],
    ['u-admin', 'מנהל בית הספר', 'לוח בקרה, קישורי הורים, מדיניות, יומן ביקורת'],
  ];
  $app.innerHTML = `
  <main class="login">
    <div class="hero">
      <div class="logo" style="justify-content:center"><span class="logo-mark" aria-hidden="true">•••</span></div>
      <h1>אלומה</h1>
      <p>פשוט שואלים. סוכנת AI שעונה על מה שקורה בבית הספר – בלי לחפש בתפריטים.</p>
    </div>
    <h2 style="font-size:17px">בחרו חשבון לדוגמה</h2>
    <div class="who-grid">
      ${demo.map(([id, r, d]) => `<button class="who" data-login="${id}"><div class="r">${esc(r)}</div><div class="n">${esc(nameOf(id))}</div><div class="d">${esc(d)}</div></button>`).join('')}
    </div>
    <div class="note">
      <b>זה אב-טיפוס.</b> ההתחברות האמיתית תהיה דרך Google של בית הספר או קוד חד-פעמי להורים (מסמך 10). כאן כל הנתונים הם נתוני דמה,
      ובמקום מודל AI עונה מנוע מקומי שמשתמש באותם כלים ובאותן בדיקות הרשאה. ${SCHOOL.name}.
      <div style="margin-top:8px"><button class="btn link" id="reset">איפוס נתוני הדמה</button></div>
    </div>
  </main>`;
  $app.querySelectorAll('[data-login]').forEach(b => b.onclick = () => {
    setSession({ userId: b.dataset.login }); audit(b.dataset.login, 'login', {}); boot();
  });
  document.getElementById('reset').onclick = () => { if (confirm('לאפס את כל נתוני הדמה בדפדפן הזה?')) { resetAll(); renderLogin(); } };
}

// ---------------- shell: top bar + sidebar ----------------
const PROMPT_TOOLS = {
  parent: [['📋', 'סיכום שבועי', 'מה המצב השבוע?'], ['📝', 'מטלות פתוחות', 'יש הגשות פתוחות?'], ['📅', 'מה יש מחר', 'מה יש מחר?'], ['✉️', 'הודעה למחנכת', 'תכתוב למחנכת ש']],
  teacher: [['📥', 'מי לא הגיש', 'מי לא הגיש בט׳2?'], ['📊', 'ממוצע כיתה', 'מה הממוצע במבחן האחרון בט׳2?'], ['🗓️', 'היעדרויות בכיתה', 'מי בט׳2 עם יותר מ-3 היעדרויות?']],
};
const STUDENT_TOOLS = [['path', '🧩', 'מסלול תרגול', 'שיעורים קצרים, XP ורצף'], ['cards', '🃏', 'כרטיסיות זיכרון', 'חזרה חכמה על מושגים'], ['planner', '🗓️', 'תוכנית למידה', 'לפני מבחן או הגשה']];
const ADMIN_NAV = [['dash', '📈', 'לוח בקרה'], ['links', '👪', 'משתמשים וקישורים'], ['policy', '⚙️', 'מדיניות'], ['audit', '🧾', 'יומן ביקורת']];

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
function persistSession() { setSession({ userId: ctx.userId, activeStudentId, view, convId: activeConvId }); }
function go(v) { view = v; persistSession(); render(); window.scrollTo(0, 0); }

function sidebar() {
  const item = (on, icon, label, extra = '', attrs = '') => `<button class="nav ${on ? 'on' : ''}" ${attrs}><span class="ic" aria-hidden="true">${icon}</span><span class="lb">${label}</span>${extra}</button>`;
  if (ctx.role === 'school_admin') return `<div class="side-sec">ניהול בית הספר</div>${ADMIN_NAV.map(([k, i, l]) => item(view === k, i, l, '', `data-go="${k}"`)).join('')}`;
  const convs = convList();
  let h = `<button class="newchat" id="newchat">＋ שיחה חדשה</button><div class="side-sec">שיחות</div><div class="convs">
    ${convs.map(c => `<div class="conv ${view === 'chat' && c.id === activeConvId ? 'on' : ''}"><button class="conv-open" data-conv="${c.id}" title="${esc(c.title)}">💬 <span>${esc(c.title)}</span></button>
      <button class="conv-del" data-delconv="${c.id}" aria-label="מחיקת השיחה">✕</button></div>`).join('') || '<div class="side-empty">עוד אין שיחות</div>'}</div>
    <div class="side-sec">כלי AI</div>`;
  if (ctx.role === 'student') {
    const p = L.progress(ctx.userId);
    h += STUDENT_TOOLS.map(([k, i, l, d]) => item(['path', 'lesson'].includes(view) ? k === 'path' : view === k, i, `${l}<small>${d}</small>`, k === 'path' && p.xp ? `<span class="xp">${p.xp} XP</span>` : '', `data-go="${k}"`)).join('');
  } else {
    if (ctx.role === 'teacher') { const unread = db().inbox.filter(m => m.teacherId === ctx.userId && !m.read).length; h += item(view === 'inbox', '📨', 'תיבת הודעות', unread ? `<span class="badge">${unread}</span>` : '', 'data-go="inbox"'); }
    h += PROMPT_TOOLS[ctx.role].map(([i, l, q]) => item(false, i, l, '', `data-prompt="${esc(q)}"`)).join('');
  }
  h += `<div class="side-bottom">${item(view === 'settings', '⚙️', ctx.role === 'parent' ? 'הגדרות וילדים' : 'הגדרות', '', 'data-go="settings"')}</div>`;
  return h;
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
}

function topBar() {
  const kids = ctx.role === 'parent' ? ctx.allowedStudentIds : [];
  return `<header class="top">
    <button class="iconbtn burger" id="burger" aria-label="תפריט">☰</button>
    <div class="logo"><span class="logo-mark" aria-hidden="true">•••</span><span>אלומה</span></div>
    <span class="pill who-pill">${esc(ctx.user.name)} · ${esc(ROLE_NAMES[ctx.role])}</span>
    ${kids.length ? `<label class="sr-only" for="kid">על מי מדברים?</label><select id="kid" class="pill">${kids.map(id => `<option value="${id}" ${id === activeStudentId ? 'selected' : ''}>${esc(nameOf(id))}</option>`).join('')}</select>` : ''}
    <span class="spacer"></span>
    <button class="iconbtn" id="theme" title="מצב כהה/בהיר" aria-label="מצב כהה או בהיר">${document.documentElement.dataset.theme === 'dark' ? '☀️' : '🌙'}</button>
    <button class="iconbtn" id="logout" title="התנתקות" aria-label="התנתקות">⏻</button>
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
  document.getElementById('logout').onclick = () => { audit(ctx.userId, 'logout', {}); setSession(null); ctx = null; document.body.classList.remove('side-open'); renderLogin(); };
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

function renderChat() {
  const v = document.getElementById('view');
  const today = (ctx.role === 'student' || (ctx.role === 'parent' && activeStudentId)) ? todayCard() : '';
  v.innerHTML = `${today}<section class="chat" id="chat" aria-label="שיחה עם אלומה"></section>
    <div class="composer"><form id="ask"><label for="q" class="sr-only">שאלה לאלומה</label>
      <input id="q" autocomplete="off" placeholder="שאלו אותי משהו… למשל: מה יש לי מחר?" ${ctx.role === 'parent' && !activeStudentId ? 'disabled' : ''}>
      <button class="send" aria-label="שליחה">‹</button></form></div>`;
  const chat = document.getElementById('chat');
  const conv = currentConv(false);
  const tr = conv ? conv.messages : [];
  if (!tr.length) chat.appendChild(aiMsg(welcome(ctx, activeStudentId && findUser(activeStudentId)), true));
  tr.forEach((m, i) => chat.appendChild(m.who === 'me' ? userMsg(m.text) : aiMsg(m.res, i === tr.length - 1)));
  document.getElementById('ask').onsubmit = e => { e.preventDefault(); const q = document.getElementById('q'); if (q.value.trim()) ask(q.value.trim()); q.value = ''; };
  scrollDown();
}
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
    return `<section class="today" aria-label="היום ${ctx.role === 'parent' ? 'של ' + esc(nameOf(sid)) : 'שלי'}">
      <div class="tcell"><div class="l">השיעור הבא · ${nextLabel}</div><div class="v">${next ? esc(subjectName(next.subject)) : '—'}</div><div class="s">${next ? `${next.start} · חדר ${next.room}` : ''}</div></div>
      <div class="tcell"><div class="l">להגשה ביומיים הקרובים</div><div class="v">${soon}</div><div class="s">${late ? `<span class="tag bad">${late} באיחור</span>` : 'אין מטלות באיחור'}</div></div>
      <div class="tcell"><div class="l">הודעות מהמורים (3 ימים)</div><div class="v">${ann}</div><div class="s">מתוך משוב</div></div>
    </section>`;
  } catch { return ''; }
}

function userMsg(text) {
  const d = document.createElement('div'); d.className = 'msg me';
  d.innerHTML = `<div class="bubble">${esc(text)}</div>`; return d;
}
function aiMsg(res, withChips) {
  const d = document.createElement('div'); d.className = 'msg ai';
  d.innerHTML = `<div class="bubble">${md(res.text)}</div>${res.cards.length ? `<div class="cards">${res.cards.map(cardHTML).join('')}</div>` : ''}
    ${withChips && res.chips.length ? `<div class="chips">${res.chips.map(c => `<button class="chip">${esc(c)}</button>`).join('')}</div>` : ''}`;
  d.querySelectorAll('.chip').forEach(b => b.onclick = () => ask(b.textContent));
  d.querySelectorAll('[data-action]').forEach(el => bindAction(el));
  d.querySelectorAll('[data-tool]').forEach(b => b.onclick = () => { if (b.dataset.subject) toolSubject = b.dataset.subject; go(b.dataset.tool); });
  return d;
}

async function ask(text) {
  if (busy) return; busy = true;
  const chat = document.getElementById('chat');
  chat.querySelectorAll('.chips').forEach(c => c.remove());
  const conv = currentConv(true);
  if (!conv.messages.length) { conv.title = text.slice(0, 32); conv.at = new Date().toISOString(); }
  conv.messages.push({ who: 'me', text }); save();
  const side = document.getElementById('side'); if (side) { side.innerHTML = sidebar(); bindSide(); }
  chat.appendChild(userMsg(text));
  const st = document.createElement('div'); st.className = 'msg ai';
  const where = /מטל|להגיש|הגש|עבוד/.test(text) ? 'ב-Classroom' : /תנסח|תכתב|תכתוב|תשלח|למורה|למחנכ/.test(text) ? '' : 'במשוב';
  st.innerHTML = `<div class="status"><span class="dots"><i></i><i></i><i></i></span>${where ? `מחפשת ${where}…` : 'מנסחת…'}</div>`;
  chat.appendChild(st); scrollDown();
  await sleep(450 + Math.random() * 450);
  const res = answer(ctx, text, { activeStudentId });
  st.remove();
  // stream the text like the real SSE answer (spec 13)
  const el = aiMsg({ ...res, text: '' }, false); chat.appendChild(el);
  const bubble = el.querySelector('.bubble');
  for (let i = 0; i <= res.text.length; i += 3) { bubble.innerHTML = md(res.text.slice(0, i)); await sleep(8); }
  const final = aiMsg(res, true); el.replaceWith(final);
  final.insertAdjacentHTML('beforeend', `<div class="fb"><button aria-pressed="false" aria-label="תשובה טובה">👍</button><button aria-pressed="false" aria-label="תשובה לא טובה">👎</button></div>`);
  final.querySelectorAll('.fb button').forEach((b, i) => b.onclick = () => {
    final.querySelectorAll('.fb button').forEach(x => x.setAttribute('aria-pressed', 'false')); b.setAttribute('aria-pressed', 'true');
    db().feedback.push({ at: new Date().toISOString(), rating: i ? 'down' : 'up' }); save();
  });
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
      const late = new Date(c.due) < NOW, soon = !late && new Date(c.due) - NOW < 864e5;
      const st = c.status === 'submitted' ? '<span class="tag ok">הוגש</span>' : late ? '<span class="tag bad">לא הוגש · באיחור</span>' : '<span class="tag">פתוח</span>';
      return `<div class="card asg"><div class="t">${esc(c.title)}</div><div class="row"><span>${esc(subjectName(c.subject))}</span>
        <span ${soon ? 'style="color:var(--coral);font-weight:700"' : ''}>הגשה: ${fmtDate(c.due)} ${fmtTime(c.due)}</span>${st}</div>
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
  if (send) send.onclick = () => {
    try {
      const a = T.confirmAction(ctx, id, el.dataset.token, el.querySelector('textarea').value);
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
      el.querySelector('.err')?.remove();
      el.insertAdjacentHTML('beforeend', `<div class="err">${esc(e.message)}</div>`);
    }
  };
}
function cardFromAction(id) {
  const a = db().actions[id]; const t = TEACHERS.find(x => x.id === a.teacherId);
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
  let html = `<section class="panel"><h2>מה אלומה זוכרת עליי</h2><p class="hint">אפשר לבקש בצ׳אט: "תזכרי שתמיד תעני לי בקצרה". מידע רגיש לא נשמר.</p>
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
  v.innerHTML = `<section class="panel lpanel"><h2>🧩 מסלול תרגול</h2>${statsBar()}
    <div class="reco">✨ <b>מומלץ לתרגל ${esc(subjectName(w.sub))}</b> – הממוצע בשלושת הציונים האחרונים שלך בו הוא ${w.avg} (מתוך משוב).</div>
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
  v.innerHTML = `<section class="panel lpanel"><h2>🃏 כרטיסיות זיכרון</h2>
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
  v.innerHTML = `<section class="panel lpanel"><h2>🗓️ תוכנית למידה</h2>
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
