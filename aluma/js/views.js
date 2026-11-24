// New screens: rewards & collection (א), personal project (ב), generated paths & decks (ג/ד),
// teacher approvals and class paths. app.js passes an env with the session and navigation.
import * as Game from './game.js';
import * as P from './projects.js';
import * as S from './studio.js';
import * as Intro from './intro.js';
import * as L from './learn.js';
import * as Cloud from './cloud.js';
import * as T from './trade.js';
import { CARDS, RARITY, RARITY_ORDER, cardById, unlockText, TOTAL, SERIES, seriesOf } from './cards.js';
import { cardArt, cardSVG } from './cardart.js';
import { STUDENTS, CLASSES, TEACHERS, subjectName } from './data.js';
import { icon } from './icons.js';
import { db, save, audit } from './store.js';
import { LIVE } from './google.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDate = d => { d = new Date(d); return `${d.getDate()}.${d.getMonth() + 1}`; };
const nameOf = id => (STUDENTS.find(s => s.id === id) || TEACHERS.find(t => t.id === id) || { name: '?' }).name;
const first = n => String(n || '').split(' ')[0];
let E = null;
export function init(env) {
  E = env;
  // any owned card, anywhere (album, a friend's album, the box result): click → big view
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-zoom]'); if (!b || b.closest('.card-zoom')) return;
    e.preventDefault(); zoomCard(+b.dataset.zoom, !!b.dataset.own);
  });
}
// ---------- big card view ----------
function zoomCard(id, own) {
  const c = cardById(id); if (!c) return;
  const ctx = E.ctx(); const sid = ctx.role === 'parent' ? E.sid() : ctx.userId;
  const R = RARITY[c.rarity];
  const copies = own ? Game.count(sid, id) : 0, isAvatar = own && (Game.avatarOf(sid) || {}).id === id;
  const back = document.activeElement;
  const ov = document.createElement('div'); ov.className = `card-zoom ${c.rarity}`; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', `${c.name} – ${R.he}`);
  ov.innerHTML = `<div class="cz-inner"><div class="cz-card"><div class="cz-tilt">${cardSVG(c, { w: 600 })}<span class="cz-shine"></span></div></div>
    <div class="cz-info"><div class="bo-r" style="color:${R.color}">${R.symbol} ${R.he} · ${R.en} · ${c.no}/${TOTAL}</div><h2>${esc(c.name)}</h2><p>${esc(c.bio)}</p>
      <p class="cz-meta">${esc(c.kind)}${own ? ` · ${copies === 1 ? 'עותק אחד' : `${copies} עותקים`}${copies > 1 && copies < Game.COMBINE_NEED ? ` (${copies}/${Game.COMBINE_NEED} לשילוב)` : ''}` : ''} · סיכוי ${R.share} בכל תיבה</p>
      <div class="btns">${own ? (isAvatar ? '<span class="tag ok">הדמות שלי ✓</span>' : '<button class="btn primary" data-cz="avatar">בחירה כדמות שלי</button>') : ''}
        ${own && copies >= Game.COMBINE_NEED ? `<button class="btn combine" data-cz="combine">✨ שילוב ${Game.COMBINE_NEED} → תיבה</button>` : ''}
        <button class="btn" data-cz="close">סגירה</button></div></div></div>`;
  document.body.appendChild(ov);
  requestAnimationFrame(() => ov.classList.add('open'));
  const close = () => { ov.classList.remove('open'); document.removeEventListener('keydown', key); setTimeout(() => ov.remove(), 180); if (back && back.focus) back.focus(); };
  const key = e => { if (e.key === 'Escape') close(); if (e.key === 'Tab') { const f = [...ov.querySelectorAll('button')]; if (!f.length) return; const i = f.indexOf(document.activeElement); if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); } } };
  document.addEventListener('keydown', key);
  (ov.querySelector('[data-cz=avatar]') || ov.querySelector('[data-cz=close]')).focus();
  ov.onclick = e => {
    const k = e.target.closest('[data-cz]');
    if (!k) { if (!e.target.closest('.cz-card, .cz-info')) close(); return; }
    if (k.dataset.cz === 'avatar') { Game.setState(sid, { avatar: id }); E.live(`הדמות שלך עכשיו: ${c.name}`); close(); renderGame(); E.refreshSide(); }
    else if (k.dataset.cz === 'combine') { try { const r = Game.combine(sid, id); flash = `✨ שילבת 4 עותקים של ${r.card.name}: 3 יצאו מהאוסף, אחד נשאר – וקיבלת תיבה חדשה 🎁`; E.live(flash); } catch (err) { E.live(err.message); } close(); renderGame(); E.refreshSide(); }
    else close();
  };
  // a gentle 3D tilt + light that follows the pointer (not with reduced motion)
  const tilt = ov.querySelector('.cz-tilt');
  if (!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) {
    ov.querySelector('.cz-card').onpointermove = e => { const r = tilt.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      tilt.style.transform = `rotateY(${(x * 14).toFixed(1)}deg) rotateX(${(-y * 14).toFixed(1)}deg)`; tilt.style.setProperty('--mx', `${(x + 0.5) * 100}%`); tilt.style.setProperty('--my', `${(y + 0.5) * 100}%`); };
    ov.querySelector('.cz-card').onpointerleave = () => { tilt.style.transform = ''; };
  }
}
const view = () => document.getElementById('view');

// ---------- sticker card (small, in-app) ----------
export function cardTile(c, { locked = false, isNew = false, size = 'm', pick = false, on = false, copies = 1, combine = false } = {}) {
  const r = RARITY[c.rarity];
  if (!locked && (copies > 1 || combine)) {
    const need = Game.COMBINE_NEED;
    // every owned card shows how many copies you have and how close it is to combining (4 → a new box)
    const dots = Array.from({ length: need }, (_, i) => `<i class="${i < copies ? 'on' : ''}"></i>`).join('');
    return `<div class="stk-wrap ${size} ${copies >= need ? 'can' : copies > 1 ? 'dup' : ''}">${cardTile(c, { isNew, size, pick, on })}${copies > 1 ? `<span class="stk-x" dir="ltr" aria-hidden="true">×${copies}</span>` : ''}
      <span class="stk-count" aria-label="${copies === 1 ? 'עותק אחד' : `${copies} עותקים`}${combine ? ` – ${copies >= need ? 'אפשר לשלב' : `עוד ${need - copies} לשילוב`}` : ''}"><b>${copies === 1 ? 'עותק אחד' : `${copies} עותקים`}</b>${combine ? `<span class="stk-dots" aria-hidden="true">${dots}</span>` : ''}</span>
      ${combine && copies >= need ? `<button class="btn combine" data-combine="${c.id}">✨ שילוב ${need} → תיבה</button>` : combine && copies > 1 ? `<span class="stk-prog">עוד ${need - copies} לשילוב</span>` : ''}</div>`;
  }
  if (!locked) return `<button class="stk-card ${c.rarity} ${size} ${on ? 'on' : ''}" data-zoom="${c.id}" ${pick ? 'data-own="1"' : ''} aria-label="${esc(c.name)} – ${r.he} – ${c.no}/${TOTAL}${on ? ' – הדמות שלך' : ''} – הגדלה" title="${esc(c.bio)}">${cardSVG(c, { w: 240 })}${isNew ? '<span class="stk-new">חדש!</span>' : ''}${on ? '<span class="stk-on">הדמות שלי</span>' : ''}</button>`;
  return `<button class="stk ${c.rarity} ${locked ? 'locked' : ''} ${size} ${on ? 'on' : ''}" ${pick && !locked ? `data-avatar="${c.id}"` : 'tabindex="-1"'} aria-label="${esc(c.name)} – ${r.he}${locked ? ' – נעול: ' + esc(unlockText(c, Game.achName)) : ''}">
    <span class="stk-art">${locked ? `<span class="stk-lock">${icon('lock', 22)}</span>` : cardArt(c, { mini: true })}</span>
    <span class="stk-name">${locked ? '???' : esc(c.name)}</span>
    <span class="stk-foot"><span class="stk-r" style="color:${r.color}">${r.symbol} ${r.he}</span><span class="stk-no">${c.no}/${TOTAL}</span></span>
    ${locked ? `<span class="stk-hint">${esc(unlockText(c, Game.achName))}</span>` : ''}${isNew ? '<span class="stk-new">חדש!</span>' : ''}
  </button>`;
}

// ---------- card boxes: every 100 XP, fixed published odds, no duplicates ----------
export function boxArt(open = false) {
  return `<svg viewBox="0 0 160 140" aria-hidden="true"><defs><linearGradient id="bxa" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7a5cff"/><stop offset=".6" stop-color="#4f6bff"/><stop offset="1" stop-color="#f2706a"/></linearGradient>
    <linearGradient id="bxg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3b0"/><stop offset="1" stop-color="#e8a92a"/></linearGradient><radialGradient id="bxl" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff6c2"/><stop offset="1" stop-color="#fff6c2" stop-opacity="0"/></radialGradient></defs>
    <ellipse cx="80" cy="128" rx="58" ry="8" fill="#1b1430" opacity=".18"/>${open ? '<circle cx="80" cy="56" r="56" fill="url(#bxl)"/>' : ''}
    <rect x="26" y="62" width="108" height="62" rx="10" fill="url(#bxa)"/><rect x="72" y="62" width="16" height="62" fill="url(#bxg)"/>
    <g ${open ? 'transform="rotate(-24 26 50)"' : ''}><rect x="20" y="40" width="120" height="28" rx="9" fill="url(#bxa)"/><rect x="72" y="40" width="16" height="28" fill="url(#bxg)"/>
    <path d="M80 40 C64 18 44 24 52 38 C56 44 70 42 80 40 C90 42 104 44 108 38 C116 24 96 18 80 40Z" fill="url(#bxg)" stroke="#b8761a" stroke-width="2"/></g>
    <path d="M40 84 l4 -8 l4 8 l-4 8z M118 100 l3 -6 l3 6 l-3 6z" fill="#fff" opacity=".85"/><ellipse cx="48" cy="72" rx="14" ry="4" fill="#fff" opacity=".35" transform="rotate(-10 48 72)"/></svg>`;
}
let boxFocus = false, flash = '';
export const showBoxes = () => { gameTab = 'progress'; boxFocus = true; };
function boxPanel(sid, s, own) {
  const b = Game.boxInfo(sid, s);
  const counts = Object.fromEntries(RARITY_ORDER.map(r => [r, CARDS.filter(c => c.rarity === r && Game.owns(sid, c)).length]));
  const ready4 = own ? Game.canCombine(sid) : [];
  return `<section class="boxes" id="boxes" aria-label="תיבות קלפים">
    <div class="box-art ${b.ready ? 'has' : ''}">${boxArt()}${b.ready ? `<span class="box-n">${b.ready}</span>` : ''}</div>
    <div class="box-main"><h3>${b.complete && !b.ready ? 'השלמת את כל האוסף! 🏆' : b.ready ? `${b.ready === 1 ? 'תיבת קלפים אחת מחכה' : `${b.ready} תיבות קלפים מחכות`}${own ? ' לך' : ''}` : 'תיבת הקלפים הבאה'}</h3>
      <div class="hint">כל ${Game.BOX_EVERY} XP = תיבה עם קלף אחד. עוד <b>${b.toNext} XP</b> לתיבה הבאה. נפתחו עד עכשיו: ${b.opened}${b.bonus ? ` · ${b.bonus} מהן משילובים` : ''}.</div>
      ${own && b.ready ? '<button class="btn primary" id="openbox">🎁 פתיחת תיבה</button>' : ''}
      ${!own && b.ready ? '<div class="hint">רק התלמיד/ה פותח/ת את התיבות.</div>' : ''}
      ${ready4.length ? `<div class="combine-row">${ready4.map(c => `<button class="btn combine" data-combine="${c.id}">✨ שילוב 4 × ${esc(c.name)} → תיבה חדשה</button>`).join('')}</div>` : ''}</div>
    <table class="odds" aria-label="הסיכויים בכל תיבה"><caption>הסיכויים בכל תיבה (קבועים)</caption><tbody>
      ${RARITY_ORDER.map(r => `<tr><td><span style="color:${RARITY[r].color}">${RARITY[r].symbol}</span> ${RARITY[r].he}</td><td class="pct">${RARITY[r].share}</td><td class="hint">${counts[r]}/${RARITY[r].count}</td></tr>`).join('')}
    </tbody></table>
    <p class="hint box-rule">אותו קלף יכול לצאת יותר מפעם אחת. <b>4 עותקים של אותו קלף = שילוב:</b> 3 עותקים יוצאים מהאוסף, אחד נשאר, ומקבלים תיבה חדשה. התיבות לא נקנות בכסף ולא פגות.</p></section>`;
}
function openBoxFlow(sid) {
  const s = Game.score(E.ctx(), sid);
  let res;
  try { res = Game.openBox(sid, s); } catch (e) { E.live(e.message); return; }
  const { card, copies, isNew } = res, R = RARITY[card.rarity];
  const left = Game.boxInfo(sid, s).ready;
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ov = document.createElement('div'); ov.className = `box-open ${card.rarity}`; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', 'פתיחת תיבת קלפים');
  ov.innerHTML = `<div class="bo-stage"><div class="bo-box">${boxArt()}</div><div class="bo-card" hidden>${cardSVG(card, { w: 300 })}</div>
    <div class="bo-text" hidden><div class="bo-r" style="color:${R.color}">${R.symbol} ${R.he} · ${R.en}</div><h2>${esc(card.name)}</h2><p>${esc(card.bio)}</p>
      <p class="bo-copy ${isNew ? 'new' : ''}">${isNew ? '✨ קלף חדש באוסף!' : `עותק ${copies} של הקלף הזה${copies >= Game.COMBINE_NEED ? ` – אפשר לשלב ${Game.COMBINE_NEED} עותקים לתיבה חדשה!` : ` (${copies}/${Game.COMBINE_NEED} לשילוב)`}`}</p>
      <div class="btns">${left ? `<button class="btn primary" data-bo="again">🎁 עוד תיבה (${left})</button>` : ''}<button class="btn" data-bo="avatar">בחירה כדמות שלי</button><button class="btn link" data-bo="close">סגירה</button></div></div></div>`;
  document.body.appendChild(ov);
  const reveal = () => { ov.classList.add('revealed'); ov.querySelector('.bo-box').hidden = true; ov.querySelector('.bo-card').hidden = false; ov.querySelector('.bo-text').hidden = false; (ov.querySelector('[data-bo=again]') || ov.querySelector('[data-bo=close]')).focus(); E.live(`קיבלת את ${card.name} – ${R.he}`); };
  if (reduce) reveal(); else { ov.classList.add('shaking'); setTimeout(() => { ov.classList.remove('shaking'); ov.classList.add('burst'); }, 900); setTimeout(reveal, 1300); }
  const close = () => { ov.remove(); document.removeEventListener('keydown', onKey); renderGame(); E.refreshSide(); };
  const onKey = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  ov.onclick = e => {
    const k = e.target.closest('[data-bo]'); if (!k) return;
    if (k.dataset.bo === 'avatar') { Game.setState(sid, { avatar: card.id }); close(); }
    else if (k.dataset.bo === 'again') { ov.remove(); document.removeEventListener('keydown', onKey); openBoxFlow(sid); }
    else close();
  };
}

// ---------- rewards: progress · album · class ----------
let gameTab = 'progress', peek = null, albumSeries = null, albumFilter = 'all';
let tradeTo = '', tradeGive = [], tradeWant = [], tradeMsg = '', tradeTimer = null;
export function renderGame() {
  const v = view(); const ctx = E.ctx();
  const sid = ctx.role === 'parent' ? E.sid() : ctx.userId;
  if (!sid) { v.innerHTML = '<section class="panel"><p class="hint">אין ילד/ה מקושר/ת.</p></section>'; return; }
  const s = Game.score(ctx, sid);
  const own = ctx.role === 'student';
  const av = Game.avatarOf(sid);
  const lv = s.level, inLevel = s.xp - lv * 100, last = lv === Game.LEVELS.length - 1;
  const fresh = own ? Game.newCards(sid) : [];
  if (!own) gameTab = ['class', 'trade'].includes(gameTab) ? 'progress' : gameTab;
  const tabs = [['progress', 'התקדמות'], ['album', `אלבום (${Game.ownedCards(sid).length}/${TOTAL})`], ...(own ? [['trade', 'החלפות'], ['class', 'הכיתה']] : [])];
  v.innerHTML = `<section class="panel lpanel"><h2 class="ph">${icon('trophy', 20)} ${own ? 'פרסים והישגים' : `ההתקדמות של ${esc(first(nameOf(sid)))}`}</h2>
    <div class="lvl">
      <div class="lvl-av">${av ? cardArt(av, { mini: true }) : '<span class="lvl-empty">?</span>'}</div>
      <div class="lvl-main"><div class="lvl-t">רמה ${lv} · <b>${esc(Game.LEVELS[lv])}</b></div>
        <div class="bar big" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${last ? 100 : inLevel}" aria-label="התקדמות לרמה הבאה"><i style="width:${last ? 100 : inLevel}%"></i></div>
        <div class="hint">${s.xp} XP מתוך ${Game.SEMESTER_MAX} בסמסטר${last ? ' · הרמה הגבוהה ביותר!' : ` · עוד ${100 - inLevel} XP לרמה ${lv + 1} (${esc(Game.LEVELS[lv + 1])})`}</div></div>
    </div>
    <div class="note-xp">${icon('sparkle', 15)} <span><b>XP הוא מדד – לא המטרה.</b> הוא משקף כמה ${own ? 'את/ה משקיע/ה' : 'יש השקעה'} בלמידה: הגשות בזמן ובאיכות, מבחנים ותרגול. כל ${Game.BOX_EVERY} XP = תיבת קלפים, עם סיכויים קבועים שמוצגים כאן. 4 עותקים של אותו קלף אפשר לשלב לתיבה חדשה. אין מה לקנות, ותיבות לא פגות – אין לחץ זמן.</span></div>
    <div class="subj-tabs" role="tablist">${tabs.map(([k, l]) => `<button class="tab" role="tab" aria-selected="${gameTab === k}" data-gtab="${k}">${l}</button>`).join('')}</div>
    <div id="gbody"></div></section>`;
  v.querySelectorAll('[data-gtab]').forEach(b => b.onclick = () => { gameTab = b.dataset.gtab; peek = null; renderGame(); });
  const body = v.querySelector('#gbody');
  const fl = flash ? `<div class="reco tmsg" role="status">${esc(flash)}</div>` : ''; flash = '';
  if (gameTab === 'progress') body.innerHTML = fl + boxPanel(sid, s, own) + progressTab(s, own, fresh);
  if (gameTab === 'album') body.innerHTML = fl + boxPanel(sid, s, own) + albumTab(sid, s, own, fresh);
  const ob = body.querySelector('#openbox'); if (ob) ob.onclick = () => openBoxFlow(sid);
  if (gameTab === 'class') { classTab(body, ctx, s); return; }
  if (gameTab === 'trade') { tradeTab(body, ctx, s); return; }
  body.querySelectorAll('[data-combine]').forEach(b => b.onclick = () => {
    try { const r = Game.combine(sid, b.dataset.combine); flash = `✨ שילבת 4 עותקים של ${r.card.name}: 3 יצאו מהאוסף, אחד נשאר – וקיבלת תיבה חדשה 🎁`; E.live(flash); renderGame(); E.refreshSide(); }
    catch (e) { E.live(e.message); }
  });

  const go = body.querySelector('[data-goto]'); if (go) go.onclick = () => { gameTab = go.dataset.goto; if (go.dataset.series) albumSeries = go.dataset.series; renderGame(); };
  body.querySelectorAll('[data-series]').forEach(b => b.onclick = () => { albumSeries = b.dataset.series; if (['dupes', 'combine'].includes(albumFilter)) albumFilter = 'all'; renderGame(); });
  body.querySelectorAll('[data-afilter]').forEach(b => b.onclick = () => { albumFilter = b.dataset.afilter; renderGame(); const h = body.querySelector('.alb-h'); if (h) h.scrollIntoView({ block: 'start', behavior: 'smooth' }); });
  const af = body.querySelector('#albf'); if (af) af.onchange = () => { albumFilter = af.value; renderGame(); };
  body.querySelectorAll('[data-go]').forEach(b => b.onclick = () => E.go(b.dataset.go));
  if (own && gameTab === 'album') { Game.markSeen(sid); E.refreshSide(); }
  if (boxFocus) { boxFocus = false; const bx = v.querySelector('#boxes'); if (bx) bx.scrollIntoView({ block: 'center' }); const o = v.querySelector('#openbox'); if (o) o.focus(); }
}
function progressTab(s, own, fresh) {
  const bar = (k, label, w, facts) => `<div class="xpart"><div class="xpart-h"><b>${label}</b><span class="tag">${w}</span><span class="xpart-n">${s.parts[k]} / ${Game.CAPS[k]}</span></div>
    <div class="bar"><i style="width:${s.parts[k] / Game.CAPS[k] * 100}%"></i></div><div class="hint">${facts}</div></div>`;
  const f = s.facts, R = Game.RULES;
  return `${fresh.length ? `<div class="reco">${icon('star', 16)} <b>${fresh.length === 1 ? 'קלף חדש באוסף' : `${fresh.length} קלפים חדשים באוסף`}:</b> ${fresh.slice(0, 4).map(c => esc(c.name)).join(', ')} <button class="btn link" data-goto="album">לאלבום</button></div>` : ''}
    <h3>מאיפה מגיע ה-XP</h3>
    ${bar('submissions', 'הגשות בזמן ובאיכות', '40%', `${f.onTime} הגשות בזמן (+${R.onTime} כל אחת) · ${f.late} באיחור (+${R.late}) · ${f.missing} שלא הוגשו · איכות העבודות: +${f.quality}`)}
    ${bar('exams', 'מבחנים ובחנים', '20%', `${f.examsN} ציונים · כל מבחן נותן עד ${R.examMax} XP לפי הציון, בוחן עד ${R.quizMax}, ושיפור של 5+ נקודות באותו מקצוע: +${R.improve}`)}
    ${bar('learning', 'כלי הלמידה של אלומה', '40%', `${f.lessons} שיעורים הושלמו · ${f.reviews} חזרות בכרטיסיות · היום: ${f.today}/${L.DAILY_LEARNING_XP} XP (תקרה יומית, כדי שלא יהיה שווה "לטחון")`)}
    <p class="hint">האחוזים הם החלק המקסימלי של כל מקור מתוך ${Game.SEMESTER_MAX} XP בסמסטר. מסלולים וכרטיסיות שיצרת לעצמך הם תרגול חופשי – בלי XP. מסלולים שהמורה פרסם/ה והמסלול המותאם של אלומה – עם XP.</p>
    <h3>הישגים ומדבקות</h3>
    <div class="badges">${Object.entries(Game.ACHIEVEMENTS).map(([k, a]) => `<div class="badge-i ${s.ach[k] ? 'got' : ''}" title="${esc(a.desc)}"><span class="bs">${a.sticker}</span><b>${esc(a.name)}</b><small>${esc(a.desc)}</small></div>`).join('')}</div>
    ${own ? `<div class="btns"><button class="btn primary" data-go="path">${icon('sparkle', 16)} לתרגל עכשיו</button><button class="btn" data-go="project">${icon('bulb', 16)} פרויקט אישי</button></div>` : ''}`;
}
// the album: 1,000 cards in 25 series (the originals + 24 worlds) – one series at a time, with filters
function albumTab(sid, s, own, fresh) {
  const av = Game.avatarOf(sid);
  const isNew = new Set(fresh.map(c => c.id)); const n = Game.counts(sid);
  const mine = Game.ownedCards(sid);
  if (!albumSeries) albumSeries = (fresh[0] || mine[mine.length - 1] || { world: 'originals' }).world;
  const bySeries = id => CARDS.filter(c => c.world === id);
  const got = id => bySeries(id).filter(c => n[c.id]).length;
  const dupes = CARDS.filter(c => n[c.id] > 1), ready = dupes.filter(c => n[c.id] >= Game.COMBINE_NEED);
  const global = albumFilter === 'dupes' || albumFilter === 'combine';      // these two look across all the worlds
  const list = global ? (albumFilter === 'combine' ? ready : dupes).slice().sort((a, b) => n[b.id] - n[a.id] || a.id - b.id)
    : bySeries(albumSeries).filter(c => albumFilter === 'all' || (albumFilter === 'mine' ? n[c.id] : albumFilter === 'missing' ? !n[c.id] : c.rarity === albumFilter));
  const ser = SERIES.find(x => x.id === albumSeries) || SERIES[0];
  const rar = RARITY_ORDER.map(r => { const all = CARDS.filter(c => c.rarity === r); return `<span class="alb-r ${r}"><span style="color:${RARITY[r].color}">${RARITY[r].symbol}</span> ${RARITY[r].he} <b>${all.filter(c => n[c.id]).length}/${all.length}</b> <small>${RARITY[r].share}</small></span>`; }).join('');
  return `<div class="alb-top"><div class="alb-total"><b>${mine.length}</b><span>/${TOTAL} קלפים באוסף</span></div><div class="alb-rs">${rar}</div></div>
    <p class="hint">${own ? 'לחצו על קלף כדי להגדיל אותו ולבחור אותו כדמות. ' : ''}25 עולמות, 40 קלפים בכל עולם. כל הקלפים מוצגים מראש, גם אלה שעוד לא יצאו. הסיכוי בכל תיבה: רגיל 50% · מיוחד 25% · נדיר 15% · אפי 7.5% · אגדי 2.5%.</p>
    ${dupes.length ? `<div class="alb-dupes">🔁 <span>יש לך <b>${dupes.length}</b> קלפים כפולים${ready.length ? ` · <b>${ready.length}</b> מהם עם ${Game.COMBINE_NEED} עותקים – אפשר לשלב לתיבה חדשה ✨` : ` · כשיש ${Game.COMBINE_NEED} עותקים מאותו קלף אפשר לשלב לתיבה`}</span>
      <button class="btn" data-afilter="dupes">הצגת הכפולים</button>${ready.length ? `<button class="btn combine" data-afilter="combine">מה אפשר לשלב</button>` : ''}</div>` : ''}
    <div class="alb-worlds" role="tablist" aria-label="עולמות">${SERIES.map(w => { const g = got(w.id); return `<button class="alb-w ${w.id === albumSeries ? 'on' : ''} ${g === 40 ? 'full' : ''}" role="tab" aria-selected="${w.id === albumSeries}" data-series="${w.id}"><span class="aw-e">${w.emoji}</span><span class="aw-n">${esc(w.name)}</span><span class="aw-c">${g}/40</span></button>`; }).join('')}</div>
    <div class="alb-h">${global ? `<b>${albumFilter === 'combine' ? '✨ אפשר לשלב' : '🔁 הקלפים הכפולים שלך'}</b> <span class="hint">${list.length} קלפים מכל העולמות</span>` : `<b>${ser.emoji} ${esc(ser.name)}</b> <span class="hint">${got(ser.id)}/40</span>`}<span class="spacer"></span>
      <label for="albf" class="sr-only">סינון</label><select id="albf">${[['all', 'כל הקלפים'], ['mine', 'רק שיש לי'], ['missing', 'רק שחסרים'], ['dupes', 'כפולים (מכל העולמות)'], ['combine', 'אפשר לשלב (מכל העולמות)'], ...RARITY_ORDER.map(r => [r, `רק ${RARITY[r].he}`])].map(([k, l]) => `<option value="${k}" ${albumFilter === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    <div class="stk-grid">${list.map(c => cardTile(c, { locked: !n[c.id], isNew: isNew.has(c.id), pick: own, on: av && av.id === c.id, copies: n[c.id] || 0, combine: own })).join('') || '<p class="hint">אין קלפים שמתאימים לסינון.</p>'}</div>`;
}
function classTab(body, ctx, s) {
  const st = Game.state(ctx.userId);
  const settings = `<div class="formrow"><label class="pick inline"><input type="checkbox" id="gshare" ${st.share ? 'checked' : ''}> <span><b>לשתף עם הכיתה</b><small>רק שם פרטי, רמה, הדמות, הקלפים וההישגים. לא XP, לא ציונים ולא הגשות.</small></span></label>
    <label class="pick inline"><input type="checkbox" id="grace" ${st.race ? 'checked' : ''}> <span><b>להשתתף במרוץ התרגול השבועי</b><small>סופר רק שיעורי תרגול – לא ציונים.</small></span></label></div>`;
  const bind = () => {
    const sh = body.querySelector('#gshare'), rc = body.querySelector('#grace');
    if (sh) sh.onchange = e => { Game.setState(ctx.userId, { share: e.target.checked }); audit(ctx.userId, e.target.checked ? 'game_share_on' : 'game_share_off', {}); if (ctx.live) shareLive(ctx, s); renderGame(); };
    if (rc) rc.onchange = e => { Game.setState(ctx.userId, { race: e.target.checked }); if (ctx.live) shareLive(ctx, s); renderGame(); };
    body.querySelectorAll('[data-peek]').forEach(b => b.onclick = () => { peek = b.dataset.peek; renderGame(); });
    const back = body.querySelector('#peekback'); if (back) back.onclick = () => { peek = null; renderGame(); };
  };
  if (ctx.live) { liveClass(body, ctx, s, settings, bind); return; }
  const mates = Game.classmates(ctx); const shared = mates.filter(m => m.share); const cls = Game.classOf(ctx);
  if (peek) {
    const m = shared.find(x => x.id === peek);
    body.innerHTML = m ? `<button class="btn link" id="peekback">→ חזרה לכיתה</button><h3>האוסף של ${esc(m.first)} · רמה ${m.level} (${esc(m.levelName)})</h3>
      <div class="badges small">${m.badges.map(k => `<div class="badge-i got"><span class="bs">${Game.ACHIEVEMENTS[k].sticker}</span><b>${esc(Game.ACHIEVEMENTS[k].name)}</b></div>`).join('') || '<p class="hint">עוד אין הישגים.</p>'}</div>
      <div class="stk-grid">${m.cards.map(id => cardTile(cardById(id), { size: 's' })).join('')}</div>` : '';
    bind(); return;
  }
  const tw = Game.teamWeek(ctx); const rc = Game.race(ctx);
  body.innerHTML = `${settings}
    <h3>${icon('users', 16)} אתגר הכיתה השבועי</h3>
    <div class="team"><div class="hint">כל הכיתה ${cls ? esc(cls.name) : ''} יחד: ${tw.goal} שיעורי תרגול השבוע. כשמגיעים – כולם מקבלים את מדבקת "רוח צוות" 🤝.</div>
      <div class="bar big"><i style="width:${tw.done / tw.goal * 100}%"></i></div><div class="hint"><b>${tw.done}/${tw.goal}</b> · התרומה שלך השבוע: ${tw.mine}</div></div>
    <h3>${icon('flag', 16)} מרוץ התרגול השבועי</h3>
    ${st.race ? `<table class="t race"><tbody>${rc.map((r, i) => `<tr class="${r.me ? 'me' : ''}"><td>${i + 1}</td><td>${esc(r.first)}</td><td>${r.lessons} שיעורים</td></tr>`).join('')}</tbody></table><p class="hint">מתאפס בכל יום ראשון. רק מי שבחר/ה להשתתף מופיע/ה.</p>`
      : '<p class="hint">המרוץ הוא בהסכמה בלבד. סמנו למעלה כדי להשתתף.</p>'}
    <h3>מה יש לחברים</h3>
    ${st.share ? '' : '<p class="hint">כדי לראות את האוספים של החברים, שתפו גם את שלכם (הדדיות).</p>'}
    <div class="mates">${shared.map(m => `<button class="mate" ${st.share ? `data-peek="${m.id}"` : 'disabled'}><span class="mate-av">${m.avatar ? cardArt(m.avatar, { mini: true }) : ''}</span><b>${esc(m.first)}</b><small>רמה ${m.level} · ${esc(m.levelName)}</small><small>${m.cards.length}/${TOTAL} קלפים · ${m.badges.map(k => Game.ACHIEVEMENTS[k].sticker).join('')}</small></button>`).join('')}</div>
    ${mates.length - shared.length ? `<p class="hint">עוד ${mates.length - shared.length} חברים בחרו לא לשתף.</p>` : ''}`;
  bind();
}
// ---------- card trading with classmates ----------
const tthumb = (id, { pick = '', sel = false, n = 0 } = {}) => { const c = cardById(id); if (!c) return ''; const r = RARITY[c.rarity];
  return `<button type="button" class="tthumb ${c.rarity} ${sel ? 'sel' : ''}" ${pick ? `data-tpick="${pick}" data-id="${c.id}" aria-pressed="${sel}"` : `data-zoom="${c.id}"`} title="${esc(c.name)} – ${r.he}"><span class="tt-art">${cardArt(c)}</span><span class="tt-n">${esc(c.name)}</span><span class="tt-r" style="color:${r.color}">${r.symbol} ${r.he}</span>${n > 1 ? `<span class="tt-x" dir="ltr">×${n}</span>` : ''}${sel ? '<span class="tt-ok">✓</span>' : ''}</button>`; };
const fairBadge = (give, want) => { const f = T.fairness(give, want); return f.verdict === 'empty' ? '' : `<span class="tfair ${f.verdict}">${f.verdict === 'fair' ? '⚖️' : '⚠️'} ${T.FAIR_TEXT[f.verdict]} <small>(נותן/ת ${f.g} · מקבל/ת ${f.w} נק׳ נדירות)</small></span>`; };
const STATUS_HE = { accepted: '✅ בוצעה', declined: '❌ סורבה', cancelled: 'בוטלה', expired: 'פגה', pending: 'ממתינה' };
function tradeTab(body, ctx, s) {
  const st = Game.state(ctx.userId);
  const rules = `<p class="hint">${icon('users', 14)} מחליפים רק עם חברים מהכיתה ששיתפו את האוסף · רק קלפים – בלי כסף ובלי XP · עד ${T.MAX_SIDE} קלפים בכל צד · הקלפים שהצעת נשמרים בצד עד התשובה · אפשר לבטל עד שההצעה מתקבלת · הצעה פגה אחרי ${T.EXPIRE_DAYS} ימים.</p>`;
  if (!st.share) { body.innerHTML = `${rules}<div class="reco">${icon('users', 16)} <span>כדי להחליף קלפים צריך קודם <b>לשתף את האוסף עם הכיתה</b> (בלשונית "הכיתה"). רק מי שמשתף/ת יכול/ה להחליף.</span> <button class="btn" data-goto="class">ללשונית הכיתה</button></div>`; body.querySelector('[data-goto]').onclick = () => { gameTab = 'class'; renderGame(); }; return; }
  if (ctx.live) { liveTrade(body, ctx, rules, s); return; }
  T.demoTick(ctx);
  const data = T.myTrades(ctx);
  const mates = T.classmatesForTrade(ctx).map(m => ({ key: m.id, first: m.first, cards: m.cards }));
  drawTrade(body, ctx, rules, mates, data, {
    send: (to, give, want) => T.offer(ctx, to, give, want),
    act: (id, action) => T.respond(ctx, id, action),
  });
  clearTimeout(tradeTimer);
  if (data.outgoing.some(t => /^u-s-/.test(t.to))) tradeTimer = setTimeout(() => { if (gameTab === 'trade' && document.querySelector('.trade') && T.demoTick(ctx)) { tradeMsg = 'החבר/ה ענה/תה על ההצעה שלך 👇'; renderGame(); E.refreshSide(); } }, 3600);
}
async function liveTrade(body, ctx, rules, s) {
  const course = LIVE.courses.find(c => c.role === 'student');
  if (!course) { body.innerHTML = `${rules}<p class="hint">לא נמצאה כיתה ב-Classroom שבה את/ה תלמיד/ה.</p>`; return; }
  body.innerHTML = `${rules}<p class="hint">טוענת את ההחלפות בכיתה "${esc(course.name)}"…</p>`;
  const [members, data] = await Promise.all([Cloud.classGame(course.id), T.liveSync(ctx, course.id)]);
  if (!members || !data) { body.innerHTML = `${rules}<p class="err">לא הצלחתי להתחבר לשרת ההחלפות. נסו שוב עוד מעט.</p>`; return; }
  shareLive(ctx, s);                                     // the shared collection follows trades
  const mates = members.filter(m => !m.me && m.handle).map(m => ({ key: m.handle, first: m.first, cards: m.cards || [] }));
  drawTrade(body, ctx, rules, mates, data, {
    live: true,
    send: async (to, give, want) => T.liveOffer(ctx, course.id, to, give, want),
    act: async (id, action) => { const t = [...data.incoming, ...data.outgoing].find(x => x.id === id); return T.liveRespond(ctx, course.id, id, action, t); },
  });
}
function drawTrade(body, ctx, rules, mates, data, api) {
  const counts = Game.counts(ctx.userId);
  const mineIds = Object.keys(counts).map(Number).sort((a, b) => T.VALUE[cardById(b).rarity] - T.VALUE[cardById(a).rarity] || a - b);
  if (tradeTo && !mates.some(m => m.key === tradeTo)) { tradeTo = ''; tradeWant = []; }
  const mate = mates.find(m => m.key === tradeTo);
  const offerRow = (t, dir) => `<div class="toffer"><div class="to-h"><b>${dir === 'in' ? `${esc(t.other)} מציע/ה לך` : `הצעה ל${esc(t.other)}`}</b>${t.status !== 'pending' ? `<span class="to-st ${t.status}">${STATUS_HE[t.status] || t.status}</span>` : ''}<span class="hint">${new Date(t.at).toLocaleDateString('he-IL')}</span></div>
      <div class="to-sides"><div><small>${dir === 'in' ? 'את/ה מקבל/ת' : 'את/ה נותן/ת'}</small><div class="tthumbs">${(dir === 'in' ? t.give : t.give).map(id => tthumb(id)).join('')}</div></div><span class="to-arrow" aria-hidden="true">⇄</span>
        <div><small>${dir === 'in' ? 'את/ה נותן/ת' : 'את/ה מקבל/ת'}</small><div class="tthumbs">${t.want.map(id => tthumb(id)).join('')}</div></div></div>
      ${t.status === 'pending' ? `${dir === 'in' ? fairBadge(t.want, t.give) : fairBadge(t.give, t.want)}<div class="btns">${dir === 'in' ? `<button class="btn primary" data-tact="accept" data-tid="${t.id}" ${T.hasAll(ctx.userId, t.want) ? '' : 'disabled title="אין לך את הקלפים שביקשו"'}>אישור ההחלפה</button><button class="btn" data-tact="decline" data-tid="${t.id}">לא, תודה</button>` : `<button class="btn" data-tact="cancel" data-tid="${t.id}">ביטול ההצעה (הקלפים חוזרים אליך)</button>`}</div>` : t.note === 'not_fair' ? '<p class="hint">החבר/ה חשב/ה שההחלפה לא הוגנת. נסו להציע קלף ברמת נדירות דומה.</p>' : ''}</div>`;
  body.innerHTML = `<div class="trade">${rules}${tradeMsg ? `<div class="reco tmsg" role="status">${esc(tradeMsg)}</div>` : ''}
    ${data.incoming.length ? `<h3>${icon('inbox', 16)} הצעות שקיבלת (${data.incoming.length})</h3>${data.incoming.map(t => offerRow(t, 'in')).join('')}` : ''}
    ${data.outgoing.length ? `<h3>הצעות ששלחת וממתינות (${data.outgoing.length}/${T.MAX_OPEN})</h3>${data.outgoing.map(t => offerRow(t, 'out')).join('')}` : ''}
    <h3>${icon('sparkle', 16)} הצעה חדשה</h3>
    ${!mates.length ? '<p class="hint">עוד אף אחד מהכיתה לא שיתף את האוסף. כשחברים ישתפו – תוכלו להחליף איתם.</p>' : !mineIds.length ? '<p class="hint">עוד אין לך קלפים להחלפה. כל 100 XP = תיבת קלפים.</p>' : `
    <div class="formrow"><label for="tto">עם מי?</label><select id="tto"><option value="">בחרו חבר/ה מהכיתה</option>${mates.map(m => `<option value="${esc(m.key)}" ${m.key === tradeTo ? 'selected' : ''}>${esc(m.first)} · ${m.cards.length} קלפים</option>`).join('')}</select></div>
    ${mate ? `<div class="tpick"><div><h4>מה תבקש/י מ${esc(mate.first)}? <small>${tradeWant.length}/${T.MAX_SIDE}</small></h4><div class="tthumbs grid">${[...new Set(mate.cards)].map(id => tthumb(id, { pick: 'want', sel: tradeWant.includes(id) })).join('') || '<p class="hint">אין קלפים.</p>'}</div></div>
      <div><h4>מה תיתן/י? <small>${tradeGive.length}/${T.MAX_SIDE}</small></h4><div class="tthumbs grid">${mineIds.map(id => tthumb(id, { pick: 'give', sel: tradeGive.includes(id), n: counts[id] })).join('')}</div></div></div>
      <div class="tsend">${fairBadge(tradeGive, tradeWant)}<button class="btn primary" id="tsend" ${tradeGive.length && tradeWant.length ? '' : 'disabled'}>שליחת ההצעה ל${esc(mate.first)}</button></div>` : ''}`}
    ${data.history.length ? `<h3>היסטוריה</h3>${data.history.map(t => offerRow(t, t.dir)).join('')}` : ''}</div>`;
  tradeMsg = '';
  const sel = body.querySelector('#tto'); if (sel) sel.onchange = () => { tradeTo = sel.value; tradeWant = []; renderGame(); };
  body.querySelectorAll('[data-tpick]').forEach(b => b.onclick = () => {
    const id = +b.dataset.id, list = b.dataset.tpick === 'give' ? tradeGive : tradeWant;
    const i = list.indexOf(id); if (i >= 0) list.splice(i, 1); else if (list.length < T.MAX_SIDE) list.push(id); else { E.live(`אפשר עד ${T.MAX_SIDE} קלפים בכל צד`); return; }
    renderGame();
  });
  const go = async (fn, okMsg) => { try { await fn(); tradeMsg = okMsg; } catch (err) { tradeMsg = err.message; } renderGame(); E.refreshSide(); E.live(tradeMsg); };
  const send = body.querySelector('#tsend');
  if (send) send.onclick = () => {
    const f = T.fairness(tradeGive, tradeWant);
    if (f.verdict === 'you-give-more' && !confirm('ההחלפה הזאת לא הוגנת כלפייך – את/ה נותן/ת הרבה יותר ממה שמקבל/ת. לשלוח בכל זאת?')) return;
    send.disabled = true;
    go(async () => { await api.send(tradeTo, tradeGive, tradeWant); tradeGive = []; tradeWant = []; }, `ההצעה נשלחה ✓ הקלפים שהצעת שמורים בצד עד התשובה.${api.live ? '' : ' החבר/ה יענה/תענה עוד רגע.'}`);
  };
  body.querySelectorAll('[data-tact]').forEach(b => b.onclick = () => {
    const a = b.dataset.tact;
    if (a === 'accept' && !confirm('לאשר את ההחלפה? אי אפשר לבטל אחרי האישור.')) return;
    go(() => api.act(b.dataset.tid, a), { accept: 'ההחלפה בוצעה! 🎉 הקלפים החדשים כבר באלבום.', decline: 'סירבת להצעה. הקלפים חזרו לחבר/ה.', cancel: 'ההצעה בוטלה והקלפים חזרו אליך.' }[a]);
  });
}

// live accounts: the class is a Google Classroom course; profiles go through Aluma's server
function shareLive(ctx, s) {
  const course = LIVE.courses.find(c => c.role === 'student'); if (!course) return;
  const st = Game.state(ctx.userId);
  Cloud.shareGame(course.id, st.share ? { first: first(ctx.user.name), level: s.level, cards: Game.ownedCards(ctx.userId).map(c => c.id), badges: Object.keys(s.ach).filter(k => s.ach[k]),
    avatar: (Game.avatarOf(ctx.userId) || {}).id || null, race: !!st.race, week: L.weekLessons(ctx.userId) } : null);
}
async function liveClass(body, ctx, s, settings, bind) {
  const course = LIVE.courses.find(c => c.role === 'student');
  if (!course) { body.innerHTML = `${settings}<p class="hint">לא נמצאה כיתה ב-Classroom שבה את/ה תלמיד/ה.</p>`; bind(); return; }
  body.innerHTML = `${settings}<p class="hint">טוענת את הכיתה "${esc(course.name)}"…</p>`; bind();
  shareLive(ctx, s);
  const st = Game.state(ctx.userId);
  if (!st.share) { body.innerHTML = `${settings}<p class="hint">כדי לראות את האוספים של החברים ב"${esc(course.name)}", שתפו גם את שלכם.</p>`; bind(); return; }
  const list = await Cloud.classGame(course.id);
  if (!list) { body.innerHTML = `${settings}<p class="err">לא הצלחתי לטעון את הכיתה מהשרת.</p>`; bind(); return; }
  const others = list.filter(m => !m.me);
  const rc = list.filter(m => m.race).sort((a, b) => b.week - a.week).slice(0, 8);
  body.innerHTML = `${settings}<h3>${icon('flag', 16)} מרוץ התרגול השבועי · ${esc(course.name)}</h3>
    ${st.race && rc.length ? `<table class="t race"><tbody>${rc.map((r, i) => `<tr class="${r.me ? 'me' : ''}"><td>${i + 1}</td><td>${esc(r.me ? 'אני' : r.first)}</td><td>${r.week} שיעורים</td></tr>`).join('')}</tbody></table>` : '<p class="hint">המרוץ בהסכמה בלבד.</p>'}
    <h3>מה יש לחברים</h3>${others.length ? `<div class="mates">${others.map(m => `<div class="mate"><span class="mate-av">${m.avatar ? cardArt(cardById(m.avatar), { mini: true }) : ''}</span><b>${esc(m.first)}</b><small>רמה ${m.level} · ${esc(Game.LEVELS[m.level] || '')}</small><small>${m.cards.length}/${TOTAL} קלפים</small></div>`).join('')}</div>` : '<p class="hint">עוד אף אחד מהכיתה לא שיתף. אפשר להזמין חברים להתחבר לאלומה.</p>'}`;
  bind();
}

// ---------- personal project (student) ----------
let ideaList = null, ideaSource = '', editing = null, qEdit = false;
export function renderProject() {
  const v = view(); const ctx = E.ctx(); const uid = ctx.userId;
  const a = P.interests(uid);
  if (!a || qEdit) { questionnaire(v, uid, a); return; }
  const mine = P.forStudent(uid);
  const bonus = P.bonusFor(uid);
  v.innerHTML = `<section class="panel lpanel"><h2 class="ph">${icon('bulb', 20)} פרויקט אישי</h2>
    <p class="hint">פרויקט שמחבר את מה שאת/ה אוהב/ת לאחד המקצועות. המורה מאשר/ת, ואחרי ההגשה אפשר לקבל <b>נקודות בונוס בתעודה</b> (לפי מגבלה שהמורה קובע/ת – בדרך כלל עד ${P.DEFAULT_MAX_BONUS} בסמסטר).</p>
    ${bonus.length ? `<div class="reco">${icon('trophy', 16)} נקודות בונוס בתעודה: ${bonus.map(p => `<b>+${p.awarded}</b> ב${esc(subjectName(p.subject))}`).join(' · ')}</div>` : ''}
    <div id="pbody"></div>
    <div class="btns"><button class="btn" id="qedit">עריכת שאלון ההיכרות</button></div></section>`;
  v.querySelector('#qedit').onclick = () => { qEdit = true; renderProject(); };
  const body = v.querySelector('#pbody');
  if (editing) { editForm(body, ctx, editing); return; }
  body.innerHTML = `${mine.length ? `<h3>הפרויקטים שלי</h3>${mine.map(p => projectCard(p, 'student')).join('')}` : ''}
    <h3>רעיונות לפרויקט</h3>
    ${ideaList ? `<div class="ideas">${ideaList.map((x, i) => `<div class="idea"><div class="idea-h"><b>${esc(x.title)}</b><span class="tag">${esc(subjectName(x.subject))}</span></div><p>${esc(x.summary)}</p>
      <div class="hint">תוצר: ${esc(x.product)} · כ-${x.weeks} שבועות${x.skills && x.skills.length ? ' · ' + x.skills.map(esc).join(', ') : ''}</div><button class="btn primary" data-idea="${i}">בחירה</button></div>`).join('')}</div>
      <p class="hint">${ideaSource === 'gemini' ? 'הרעיונות נוצרו ב-Gemini לפי השאלון.' : 'הרעיונות נבנו מתבניות לפי השאלון (Gemini לא זמין כרגע).'} אפשר לערוך כל רעיון לפני השליחה.</p>` : ''}
    <div class="btns"><button class="btn ${ideaList ? '' : 'primary'}" id="getideas">${icon('sparkle', 16)} ${ideaList ? 'רעיונות אחרים' : 'הצעת רעיונות לפי תחומי העניין שלי'}</button><button class="btn link" id="ownidea">יש לי רעיון משלי</button></div><div id="pmsg"></div>`;
  bindProjectCards(body, ctx);
  body.querySelector('#getideas').onclick = async e => {
    e.currentTarget.disabled = true; e.currentTarget.textContent = 'אלומה חושבת על רעיונות…';
    try { const r = await P.ideas(uid); ideaList = r.list; ideaSource = r.source; } catch (err) { body.querySelector('#pmsg').innerHTML = `<p class="err">${esc(err.message)}</p>`; }
    renderProject();
  };
  body.querySelector('#ownidea').onclick = () => { editing = P.createDraft(uid, { title: '', subject: (a.subjects[0] || 'science'), summary: '', product: a.output[0] || '', steps: [], skills: [], weeks: 4 }); renderProject(); };
  body.querySelectorAll('[data-idea]').forEach(b => b.onclick = () => { editing = P.createDraft(uid, ideaList[+b.dataset.idea]); renderProject(); });
}
function questionnaire(v, uid, a) {
  a = a || { hobbies: [], subjects: [], output: [], style: '', time: '', curious: '' };
  const group = (k, q) => `<fieldset class="qgroup"><legend>${esc(q.label)}</legend><div class="qopts">${q.options.map(o => `<label class="qopt"><input type="${q.multi ? 'checkbox' : 'radio'}" name="${k}" value="${esc(o)}" ${(q.multi ? a[k].includes(o) : a[k] === o) ? 'checked' : ''}><span>${esc(k === 'subjects' ? subjectName(o) : o)}</span></label>`).join('')}</div></fieldset>`;
  v.innerHTML = `<section class="panel lpanel"><h2 class="ph">${icon('bulb', 20)} שאלון היכרות</h2>
    <p class="hint">כמה שאלות קצרות על מה שמעניין אותך, כדי שאלומה תציע רעיונות שמתאימים לך. <b>אין כאן שאלות על פרטים אישיים</b> (כמו מקום מגורים, טלפון או משפחה) – ואל תכתבו כאלה.</p>
    <form id="qform">${Object.entries(P.Q).map(([k, q]) => group(k, q)).join('')}
      <fieldset class="qgroup"><legend>משהו שמסקרן אותך במיוחד? (לא חובה)</legend><input type="text" id="curious" maxlength="200" value="${esc(a.curious)}" placeholder="למשל: איך עובדים משחקי וידאו, למה כוכבים נוצצים…" style="width:100%"></fieldset>
      <div class="btns"><button class="btn primary">שמירה והמשך</button>${P.interests(uid) ? '<button class="btn link" type="button" id="qcancel">ביטול</button>' : ''}</div><div id="qmsg"></div></form></section>`;
  const f = v.querySelector('#qform');
  const c = v.querySelector('#qcancel'); if (c) c.onclick = () => { qEdit = false; renderProject(); };
  f.onsubmit = e => {
    e.preventDefault();
    const get = k => [...f.querySelectorAll(`[name=${k}]:checked`)].map(x => x.value);
    const ans = { hobbies: get('hobbies'), subjects: get('subjects'), output: get('output'), style: get('style')[0] || '', time: get('time')[0] || '', curious: v.querySelector('#curious').value };
    if (!ans.hobbies.length || !ans.subjects.length) { v.querySelector('#qmsg').innerHTML = '<p class="err">בחרו לפחות תחום עניין אחד ומקצוע אחד.</p>'; return; }
    P.saveInterests(uid, ans); qEdit = false; ideaList = null; renderProject();
  };
}
function editForm(body, ctx, p) {
  const teachers = P.teacherOptions(ctx.userId, p.subject);
  body.innerHTML = `<h3>${p.status === 'returned' ? 'תיקון ההצעה' : 'ההצעה שלי'}</h3>
    ${p.comment && p.status === 'returned' ? `<div class="reco">הערת המורה: ${esc(p.comment)}</div>` : ''}
    <form id="pform" class="pform">
      <label>שם הפרויקט<input id="pt" maxlength="80" required value="${esc(p.title)}"></label>
      <label>מקצוע<select id="ps">${P.Q.subjects.options.map(o => `<option value="${o}" ${o === p.subject ? 'selected' : ''}>${esc(subjectName(o))}</option>`).join('')}</select></label>
      <label>מה אני רוצה לעשות<textarea id="pd" maxlength="400" required>${esc(p.summary)}</textarea></label>
      <label>התוצר<input id="pp" maxlength="60" value="${esc(p.product)}"></label>
      <label>שלבים (שורה לכל שלב)<textarea id="pst" maxlength="700">${esc((p.steps || []).join('\n'))}</textarea></label>
      <label>מספר שבועות<input id="pw" type="number" min="1" max="12" value="${p.weeks || 4}"></label>
      <label>לשלוח אל<select id="pteach">${teachers.map(t => `<option value="${t.id}">${esc(t.name)} · ${esc(t.role)}</option>`).join('')}</select></label>
      <div class="btns"><button class="btn primary">${icon('send', 16)} שליחה למורה לאישור</button><button class="btn" type="button" id="psave">שמירת טיוטה</button><button class="btn link" type="button" id="pdel">מחיקה</button></div>
      <p class="hint">אלומה עוזרת לתכנן – את העבודה עצמה עושים לבד. המורה יקבל/תקבל את ההצעה ויחליט/תחליט כמה נקודות בונוס היא שווה.</p><div id="pmsg"></div></form>`;
  const f = body.querySelector('#pform');
  const read = () => P.update(p, { title: f.querySelector('#pt').value.trim().slice(0, 80), subject: f.querySelector('#ps').value, summary: f.querySelector('#pd').value.trim().slice(0, 400),
    product: f.querySelector('#pp').value.trim().slice(0, 60), steps: f.querySelector('#pst').value.split('\n').map(x => x.trim()).filter(Boolean).slice(0, 8), weeks: Math.max(1, Math.min(12, +f.querySelector('#pw').value || 4)) });
  f.querySelector('#ps').onchange = () => { read(); renderProject(); };
  f.querySelector('#psave').onclick = () => { read(); editing = null; renderProject(); };
  f.querySelector('#pdel').onclick = () => { if (confirm('למחוק את ההצעה?')) { db().projects = db().projects.filter(x => x.id !== p.id); save(); editing = null; renderProject(); } };
  f.onsubmit = e => {
    e.preventDefault(); read();
    try { P.send(p, f.querySelector('#pteach').value); editing = null; E.live('ההצעה נשלחה למורה'); renderProject(); E.refreshSide(); }
    catch (err) { f.querySelector('#pmsg').innerHTML = `<p class="err">${esc(err.message)}</p>`; }
  };
}
function projectCard(p, as) {
  const [st, cls] = P.STATUS[p.status];
  const who = as === 'teacher' ? `${esc(nameOf(p.studentId))} · ${esc((CLASSES.find(c => c.id === (STUDENTS.find(s => s.id === p.studentId) || {}).classId) || {}).name || '')}` : (p.teacherId ? `אל ${esc(nameOf(p.teacherId))}` : 'עוד לא נשלח');
  let actions = '';
  if (as === 'student') {
    if (['draft', 'returned'].includes(p.status)) actions = `<button class="btn primary" data-edit="${p.id}">${p.status === 'returned' ? 'תיקון ושליחה מחדש' : 'המשך עריכה'}</button>`;
    if (p.status === 'approved') actions = `<form class="psub" data-submit="${p.id}"><label>מה עשיתי (קצר)<textarea maxlength="2000" name="t"></textarea></label><label>קישור לתוצר (לא חובה)<input name="l" type="url" placeholder="https://…" dir="ltr"></label><button class="btn primary">הגשה</button><div class="pmsg"></div></form>`;
  } else {
    const left = P.remaining(p.teacherId, p.studentId, p.id);
    if (p.status === 'pending') actions = `<form class="psub" data-approve="${p.id}"><div class="formrow"><label>נקודות בונוס מקסימליות</label><input name="cap" type="number" min="1" value="${Math.min(left, 5) || ''}" ${left ? '' : 'disabled'} style="width:80px"><span class="hint">נשארו לתלמיד/ה אצלך: ${left} מתוך ${P.maxBonus(p.teacherId)} בסמסטר</span></div>
      <label>הערה (לא חובה לאישור, חובה להחזרה)<textarea name="c" maxlength="500"></textarea></label><div class="btns"><button class="btn primary" ${left ? '' : 'disabled'}>אישור</button><button class="btn" type="button" data-return="${p.id}">החזרה לתיקון</button></div><div class="pmsg"></div></form>`;
    if (p.status === 'submitted') actions = `<form class="psub" data-grade="${p.id}"><div class="formrow"><label>נקודות בונוס לתעודה</label><input name="pts" type="number" min="0" value="${p.cap}" style="width:80px"><span class="hint">עד ${p.cap}, כפי שאושר</span></div>
      <label>משוב לתלמיד/ה<textarea name="c" maxlength="500"></textarea></label><div class="btns"><button class="btn primary">מתן ניקוד</button><button class="btn" type="button" data-return="${p.id}">החזרה לתיקון</button></div><div class="pmsg"></div></form>`;
  }
  return `<article class="proj"><div class="proj-h"><b>${esc(p.title || 'בלי שם')}</b><span class="tag ${cls}">${st}</span></div>
    <div class="hint">${esc(subjectName(p.subject))} · ${who} · ${fmtDate(p.updatedAt)}${p.cap ? ` · עד ${p.cap} נקודות` : ''}${p.status === 'graded' ? ` · <b>ניתנו ${p.awarded} נקודות בונוס</b>` : ''}</div>
    <p>${esc(p.summary)}</p>${p.steps && p.steps.length ? `<ol class="steps-l">${p.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>` : ''}
    ${p.submission ? `<div class="sub-box"><b>ההגשה:</b> ${esc(p.submission.text)} ${p.submission.link ? `<a href="${esc(p.submission.link)}" target="_blank" rel="noopener noreferrer">קישור ↗</a>` : ''}</div>` : ''}
    ${p.comment && p.status !== 'returned' ? `<div class="hint">הערת המורה: ${esc(p.comment)}</div>` : ''}${actions}</article>`;
}
function bindProjectCards(root, ctx) {
  const find = id => P.byId(id);
  const msg = (el, m) => { el.querySelector('.pmsg').innerHTML = `<p class="err">${esc(m)}</p>`; };
  const redo = () => (ctx.role === 'teacher' ? renderTeacherProjects() : renderProject());
  root.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => { editing = find(b.dataset.edit); renderProject(); });
  root.querySelectorAll('[data-submit]').forEach(f => f.onsubmit = e => { e.preventDefault(); try { P.submit(find(f.dataset.submit), { text: f.t.value, link: f.l.value }); E.live('הפרויקט הוגש'); redo(); } catch (err) { msg(f, err.message); } });
  root.querySelectorAll('[data-approve]').forEach(f => f.onsubmit = e => { e.preventDefault(); try { P.approve(ctx, find(f.dataset.approve), +f.cap.value, f.c.value); redo(); E.refreshSide(); } catch (err) { msg(f, err.message); } });
  root.querySelectorAll('[data-grade]').forEach(f => f.onsubmit = e => { e.preventDefault(); try { P.grade(ctx, find(f.dataset.grade), +f.pts.value, f.c.value); redo(); E.refreshSide(); } catch (err) { msg(f, err.message); } });
  root.querySelectorAll('[data-return]').forEach(b => b.onclick = () => { const f = b.closest('form'); try { P.returnBack(ctx, find(b.dataset.return), f.c.value); redo(); E.refreshSide(); } catch (err) { msg(f, err.message); } });
}

// ---------- teacher: project approvals ----------
export function renderTeacherProjects() {
  const v = view(); const ctx = E.ctx();
  const list = P.forTeacher(ctx.userId);
  const open = list.filter(p => ['pending', 'submitted'].includes(p.status)), rest = list.filter(p => !['pending', 'submitted'].includes(p.status));
  v.innerHTML = `<section class="panel"><h2 class="ph">${icon('bulb', 20)} פרויקטים אישיים</h2>
    <form class="formrow" id="maxf"><label for="maxb">מקסימום נקודות בונוס לתלמיד/ה בסמסטר</label><input id="maxb" type="number" min="0" max="100" value="${P.maxBonus(ctx.userId)}" style="width:80px"><button class="btn">שמירה</button><span class="hint">ברירת מחדל: ${P.DEFAULT_MAX_BONUS}</span><span id="maxmsg"></span></form>
    <h3>מחכים לך (${open.length})</h3>${open.map(p => projectCard(p, 'teacher')).join('') || '<p class="hint">אין הצעות או הגשות שמחכות. כשתלמיד/ה ישלח/תשלח הצעה – היא תופיע כאן.</p>'}
    ${rest.length ? `<h3>טופלו</h3>${rest.map(p => projectCard(p, 'teacher')).join('')}` : ''}</section>`;
  v.querySelector('#maxf').onsubmit = e => { e.preventDefault(); P.setMaxBonus(ctx.userId, +v.querySelector('#maxb').value); v.querySelector('#maxmsg').innerHTML = '<span class="sent">נשמר ✓</span>'; };
  bindProjectCards(v, ctx);
}

// ---------- generated paths & decks ----------
// how many units and how many lessons in each unit (5 questions a lesson); default 3×3, like the basic path
const shapeSelects = (pre = 's') => `<span class="pshape"><label for="${pre}u" style="min-width:auto">יחידות</label><select id="${pre}u">${Array.from({ length: L.MAX_PATH_UNITS }, (_, i) => `<option value="${i + 1}" ${i === 2 ? 'selected' : ''}>${i + 1}</option>`).join('')}</select>
  <label for="${pre}l" style="min-width:auto">שיעורים בכל יחידה</label><select id="${pre}l">${Array.from({ length: L.MAX_PATH_LESSONS }, (_, i) => `<option value="${i + 1}" ${i === 2 ? 'selected' : ''}>${i + 1}</option>`).join('')}</select></span>`;
const shapeOf = (root, pre = 's') => ({ units: +root.querySelector(`#${pre}u`).value, lessons: +root.querySelector(`#${pre}l`).value });
export function createForm(ctx, { kind = 'path', forTeacher = false } = {}) {
  const subs = forTeacher ? ctx.subjects : (ctx.live ? LIVE.courses.map(c => c.name) : L.LEARN_SUBJECTS.concat(['literature', 'hebrew', 'bible']));
  return `<form class="studio" id="studio">
    <div class="formrow"><label for="sk">מה ליצור</label><select id="sk"><option value="path" ${kind === 'path' ? 'selected' : ''}>מסלול תרגול</option><option value="cards" ${kind === 'cards' ? 'selected' : ''}>כרטיסיות זיכרון</option></select>
      <label for="ss" style="min-width:auto">מקצוע</label><select id="ss"><option value="">לפי הבקשה</option>${subs.map(s => `<option value="${esc(s)}">${esc(subjectName(s))}</option>`).join('')}</select>
      ${forTeacher ? `<label for="sc" style="min-width:auto">לכיתה</label><select id="sc">${CLASSES.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select>` : ''}</div>
    <div class="formrow" id="sshape" ${kind === 'cards' ? 'hidden' : ''}>${shapeSelects()}<span class="hint">כל שיעור – 5 שאלות</span></div>
    <label for="sr" class="sr-only">הבקשה</label><textarea id="sr" rows="2" maxlength="500" placeholder="${forTeacher ? 'למשל: מסלול חזרה על המהפכה הצרפתית לקראת המבחן, עם דגש על הצהרת זכויות האדם' : 'למשל: כרטיסיות על זמן עבר באנגלית, או מסלול על התא החי'}"></textarea>
    <div class="formrow"><label class="filebtn">${icon('clip', 16)} העלאת קובץ עם החומר<input type="file" id="sf" accept=".txt,.md,.pdf,.docx,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" hidden></label><span id="sfn" class="hint">TXT, PDF או Word · נשאר בדפדפן</span>
      <span class="spacer"></span>${forTeacher ? '' : `<button class="btn primary" id="sgo">${icon('sparkle', 16)} יצירה</button>`}</div>
    ${forTeacher ? `<div class="formrow vidrow"><label for="svu" style="min-width:auto">${icon('play', 16)} סרטון</label><input id="svu" type="url" dir="ltr" placeholder="קישור YouTube (לא חובה)" autocomplete="off">
      <label class="filebtn">או העלאת סרטון<input type="file" id="svf" accept="video/*" hidden></label><span id="svn" class="hint">עד ${Intro.MAX_VIDEO_MB}MB</span></div>
      <p class="hint">אלומה תכין <b>הסבר קצר לפני כל שיעור</b>, עם דוגמאות ואפשרות להסבר מפורט. העליתם מסמך או סרטון? ההסברים והשאלות יתבססו עליו – ואת הסרטון אלומה מסכמת קודם. לפני הפרסום תוכלו לקרוא ולתקן הכול.</p>
      <div class="btns"><span class="spacer"></span><button class="btn primary" id="sgo">${icon('sparkle', 16)} יצירת טיוטה לבדיקה</button></div>` : ''}
    <p class="hint">${forTeacher ? 'אלומה מתאימה את הרמה לפי ממוצע הכיתה במקצוע והנושאים האחרונים. מסלול שמורה מפרסם/ת <b>מזכה ב-XP</b>.' : 'אלומה מתאימה את הרמה לפי הציונים שלך וממוצע הכיתה. מסלולים שיצרת לעצמך הם <b>תרגול חופשי בלי XP</b>.'}</p><div id="smsg"></div></form>`;
}
export function bindCreateForm(root, ctx, onDone, { forTeacher = false } = {}) {
  const f = root.querySelector('#studio'); if (!f) return;
  let file = null;
  const kindSel = f.querySelector('#sk'); kindSel.onchange = () => { f.querySelector('#sshape').hidden = kindSel.value !== 'path'; };
  f.querySelector('#sf').onchange = async e => {
    const fl = e.target.files[0]; if (!fl) return;
    f.querySelector('#sfn').textContent = `קוראת את ${fl.name}…`;
    try { file = { name: fl.name, text: await S.fileToText(fl) }; f.querySelector('#sfn').innerHTML = `${icon('clip', 14)} ${esc(fl.name)} (${Math.round(file.text.length / 100) / 10}K תווים)`; }
    catch (err) { file = null; f.querySelector('#sfn').innerHTML = `<span class="err">${esc(err.message)}</span>`; }
  };
  let vfile = null;
  const vf = f.querySelector('#svf');
  if (vf) vf.onchange = e => {
    vfile = e.target.files[0] || null; const n = f.querySelector('#svn');
    if (!vfile) { n.textContent = `עד ${Intro.MAX_VIDEO_MB}MB`; return; }
    if (vfile.size > Intro.MAX_VIDEO_MB * 1024 * 1024) { n.innerHTML = `<span class="err">הסרטון גדול מ-${Intro.MAX_VIDEO_MB}MB. לסרטון ארוך – הדביקו קישור YouTube.</span>`; vfile = null; return; }
    n.innerHTML = `${icon('play', 14)} ${esc(vfile.name)} (${Math.round(vfile.size / 1e5) / 10}MB)`;
  };
  f.onsubmit = async e => {
    e.preventDefault();
    const go = f.querySelector('#sgo'), label = go.innerHTML; go.disabled = true;
    const kind = f.querySelector('#sk').value, url = (f.querySelector('#svu') || {}).value || '';
    try {
      let video = null;
      if (forTeacher && kind === 'path' && (vfile || url.trim())) {
        go.textContent = 'אלומה צופה בסרטון ומסכמת…';
        video = { ...(await Intro.summarizeVideo(vfile ? { file: vfile } : { url })), from: vfile ? vfile.name : url.trim() };
      }
      go.textContent = kind === 'path' ? 'אלומה בונה שאלות והסברים…' : 'אלומה בונה…';
      const path = await S.create(ctx, { kind, subject: f.querySelector('#ss').value || null, request: f.querySelector('#sr').value, fileText: file ? file.text : '', fileName: file ? file.name : '', classId: forTeacher ? f.querySelector('#sc').value : null, studentId: ctx.role === 'student' ? ctx.userId : null, video, ...shapeOf(f) });
      onDone(path);
    } catch (err) { go.disabled = false; go.innerHTML = label; f.querySelector('#smsg').innerHTML = `<p class="err">${esc(err.message)}</p>`; }
  };
}
export function pathCard(p, ctx, { manage = false } = {}) {
  const n = p.units.reduce((a, u) => a + u.qs.length, 0);
  const done = ctx.role === 'student' ? p.units.filter((u, i) => L.pathUnitDone(ctx.userId, p, i)).length : 0;
  const per = L.pathLessons(p), lessonsDone = ctx.role === 'student' ? p.units.reduce((a, u, i) => a + L.pathUnitState(ctx.userId, p, i).filter(Boolean).length, 0) : 0;
  return `<article class="gpath"><div class="proj-h"><b>${esc(p.title)}</b>${p.xp ? '<span class="tag ok">עם XP</span>' : '<span class="tag">בלי XP</span>'}</div>
    <div class="hint">${esc(subjectName(p.subject))} · רמה ${esc(p.level)} · ${p.units.length} יחידות × ${per} ${per === 1 ? 'שיעור' : 'שיעורים'} · ${n} שאלות · ${p.cards.length} כרטיסיות${p.classId ? ` · ${esc((CLASSES.find(c => c.id === p.classId) || {}).name)} · מאת ${esc(p.ownerName)}` : ''}${p.fileName ? ` · מתוך ${esc(p.fileName)}` : ''} · ${p.source === 'gemini' ? 'נוצר ב-Gemini' : 'נבנה מהמאגר'}</div>
    ${p.basedOn && (p.basedOn.my != null || p.basedOn.classAvg != null) ? `<div class="hint">מותאם לפי: ${p.basedOn.my != null ? `הממוצע ${ctx.role === 'teacher' ? 'של התלמיד/ה' : 'שלך'} ${p.basedOn.my}` : ''}${p.basedOn.my != null && p.basedOn.classAvg != null ? ' · ' : ''}${p.basedOn.classAvg != null ? `ממוצע הכיתה ${p.basedOn.classAvg}` : ''}${p.basedOn.weak && p.basedOn.weak.length ? ` · לחיזוק: ${p.basedOn.weak.map(esc).join(', ')}` : ''}</div>` : ''}
    ${ctx.role === 'student' && p.units.length ? `<div class="pprog"><div class="bar" role="progressbar" aria-label="התקדמות במסלול" aria-valuemin="0" aria-valuemax="${p.units.length * per}" aria-valuenow="${lessonsDone}"><i style="width:${lessonsDone / (p.units.length * per) * 100}%"></i></div><span class="hint">${lessonsDone}/${p.units.length * per} שיעורים · ${done}/${p.units.length} יחידות</span></div>` : ''}
    <div class="btns">${p.units.length ? `<button class="btn ${ctx.role === 'student' ? 'primary' : ''}" data-open="${p.id}">${icon('sparkle', 15)} ${ctx.role === 'student' ? (lessonsDone ? 'המשך במסלול' : 'כניסה למסלול') : 'צפייה במפת המסלול'}</button>` : ''}${p.cards.length && ctx.role === 'student' ? `<button class="btn" data-deck="${p.id}">${icon('layers', 15)} כרטיסיות</button>` : ''}${manage ? `<button class="btn link" data-delpath="${p.id}">מחיקה</button>` : ''}</div>
    ${ctx.role === 'teacher' ? `<details><summary>תצוגה מקדימה</summary>${p.units.map(u => `<b>${esc(u.title)}</b><ol>${u.qs.map(q => `<li>${esc(q.q)} <span class="hint">(${esc(q.options[q.answer])})</span></li>`).join('')}</ol>`).join('')}</details>` : ''}</article>`;
}
export function bindPathCards(root, ctx, redo) {
  root.querySelectorAll('[data-open]').forEach(b => b.onclick = () => E.openPath(b.dataset.open));
  root.querySelectorAll('[data-deck]').forEach(b => b.onclick = () => E.openDeck(b.dataset.deck));
  root.querySelectorAll('[data-delpath]').forEach(b => b.onclick = () => { if (confirm('למחוק?')) { L.deletePath(b.dataset.delpath); redo(); } });
}
// student path tabs other than the built-in one
export function pathTab(box, tab) {
  const ctx = E.ctx(); const uid = ctx.userId;
  const cls = Game.classOf(ctx);
  const redo = () => E.render();
  if (tab === 'adaptive') {
    const list = L.adaptivePaths(uid);
    const subs = ctx.live ? LIVE.courses.filter(c => c.role === 'student').map(c => c.name) : L.LEARN_SUBJECTS;
    box.innerHTML = `<p class="hint">אלומה בודקת את הציונים שלך, את ממוצע הכיתה ואת המטלות והמבחנים האחרונים${ctx.live ? ' ב-Classroom' : ' (משוב ו-Classroom)'}, ובונה מסלול ברמה שמתאימה לך. המסלול המותאם <b>מזכה ב-XP</b>.</p>
      <form class="formrow" id="adf"><label for="ads">מקצוע</label><select id="ads">${subs.map(s => `<option value="${esc(s)}">${esc(subjectName(s))}</option>`).join('')}</select>${shapeSelects('ad')}<button class="btn primary" id="adgo">${icon('sparkle', 16)} בניית מסלול מותאם</button></form><div id="admsg"></div>
      ${list.map(p => pathCard(p, ctx, { manage: true })).join('') || '<p class="hint">עוד אין מסלולים מותאמים.</p>'}`;
    box.querySelector('#adf').onsubmit = async e => {
      e.preventDefault(); const b = box.querySelector('#adgo'); b.disabled = true; b.textContent = 'בודקת את הרמה ובונה…';
      try { await S.create(ctx, { kind: 'path', subject: box.querySelector('#ads').value, adaptive: true, studentId: uid, ...shapeOf(box, 'ad') }); redo(); }
      catch (err) { b.disabled = false; b.textContent = 'בניית מסלול מותאם'; box.querySelector('#admsg').innerHTML = `<p class="err">${esc(err.message)}</p>`; }
    };
  } else if (tab === 'teacher') {
    const list = cls ? L.classPaths(cls.id) : [];
    box.innerHTML = `<p class="hint">מסלולים שהמורים פרסמו לכיתה ${cls ? esc(cls.name) : ''}. הם <b>מזכים ב-XP</b>.</p>${list.map(p => pathCard(p, ctx)).join('') || '<p class="hint">המורים עוד לא פרסמו מסלולים לכיתה.</p>'}`;
  } else {
    const list = L.ownPaths(uid);
    box.innerHTML = `${createForm(ctx)}<h3>מה שיצרתי</h3>${list.map(p => pathCard(p, ctx, { manage: true })).join('') || '<p class="hint">עוד לא יצרת מסלולים או כרטיסיות. כתבו בקשה למעלה, או בקשו בצ׳אט: "תיצרי לי כרטיסיות על…".</p>'}`;
    bindCreateForm(box, ctx, () => redo());
  }
  bindPathCards(box, ctx, redo);
}
// teacher: paths for the class
export function renderTeacherPaths() {
  const v = view(); const ctx = E.ctx();
  const list = L.publishedBy(ctx.userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const drafts = L.draftsBy(ctx.userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  v.innerHTML = `<section class="panel lpanel"><h2 class="ph">${icon('sparkle', 20)} מסלולים לכיתה</h2>
    <p class="hint">כתבו מה אתם רוצים – אלומה תבנה מסלול תרגול או כרטיסיות לפי הבקשה, לפי הרמה של הכיתה ולפי מסמך או סרטון שתעלו. מסלול נשמר קודם כטיוטה: בודקים את ההסברים, ורק אז מפרסמים לכיתה. אפשר גם לבקש בצ׳אט: "תבני מסלול לט׳2 על…".</p>
    ${drafts.length ? `<h3>מחכים לבדיקה שלך (${drafts.length})</h3>${drafts.map(draftEditor).join('')}` : ''}
    ${createForm(ctx, { forTeacher: true })}<h3>פורסמו (${list.length})</h3>${list.map(p => pathCard(p, ctx, { manage: true })).join('') || '<p class="hint">עוד לא פרסמת מסלולים.</p>'}</section>`;
  bindCreateForm(v, ctx, p => { E.live(p.draft ? `טיוטה מוכנה לבדיקה: ${p.title}` : `פורסם לכיתה: ${p.title}`); renderTeacherPaths(); if (p.draft) v.querySelector(`[data-draft="${p.id}"]`)?.scrollIntoView({ block: 'start' }); }, { forTeacher: true });
  bindPathCards(v, ctx, renderTeacherPaths);
  bindDrafts(v, renderTeacherPaths);
}
// a draft class path: the teacher reads and fixes the video summary and every lesson's explanation, then publishes
function draftEditor(p) {
  const per = L.pathLessons(p);
  const cls = (CLASSES.find(c => c.id === p.classId) || {}).name || '';
  const missing = p.units.length * per - Object.keys(p.intros || {}).length;
  return `<article class="gpath draft" data-draft="${p.id}"><div class="proj-h"><b>${esc(p.title)}</b><span class="tag warn">טיוטה · ${esc(cls)}</span></div>
    <div class="hint">${esc(subjectName(p.subject))} · ${p.units.length} יחידות × ${per} ${per === 1 ? 'שיעור' : 'שיעורים'}${p.fileName ? ` · מתוך ${esc(p.fileName)}` : ''}</div>
    ${p.video ? `<label class="dlab">סיכום הסרטון שאלומה הכינה – אפשר לתקן<textarea data-f="summary" rows="5" maxlength="4000">${esc(p.video.summary)}</textarea></label>` : ''}
    ${missing ? `<p class="hint warn-line">Gemini היה עמוס, אז ${missing === 1 ? 'הסבר אחד עוד לא נכתב' : `${missing} הסברים עוד לא נכתבו`}. אפשר לנסות שוב עכשיו, לכתוב בעצמכם, או להשאיר – אלומה תכתוב אותם כשהתלמיד/ה יפתח/תפתח את השיעור.</p>` : ''}
    <div class="btns"><button class="btn" type="button" data-regen="${p.id}">${icon('sparkle', 15)} ${missing && missing === p.units.length * per ? 'כתיבת ההסברים' : p.video ? 'כתיבת ההסברים מחדש לפי הסיכום' : 'כתיבת ההסברים מחדש'}</button></div>
    <details open><summary>ההסברים לפני כל שיעור (${p.units.length * per})</summary>
    ${p.units.map((u, ui) => Array.from({ length: per }, (_, l) => { const it = (p.intros || {})[`${ui}:${l}`] || { short: '', examples: [], more: '' }; return `<fieldset class="dintro" data-k="${ui}:${l}"><legend>יחידה ${ui + 1}: ${esc(u.title)}${per > 1 ? ` · שיעור ${l + 1}` : ''}</legend>
      <label>הסבר קצר – מלמד את הרעיון<textarea data-f="short" rows="3" maxlength="700" placeholder="${it.short ? '' : 'עוד לא נכתב'}">${esc(it.short)}</textarea></label>
      <label>דוגמאות פתורות (שורה לכל דוגמה)<textarea data-f="examples" rows="3" maxlength="1300">${esc(it.examples.join('\n'))}</textarea></label>
      <label>הסבר מפורט (למי שלוחץ "עוד")<textarea data-f="more" rows="4" maxlength="2400">${esc(it.more)}</textarea></label></fieldset>`; }).join('')).join('')}</details>
    <details><summary>השאלות</summary>${p.units.map(u => `<b>${esc(u.title)}</b><ol>${u.qs.map(q => `<li>${esc(q.q)} <span class="hint">(${esc(q.options[q.answer])})</span></li>`).join('')}</ol>`).join('')}</details>
    <div class="btns"><button class="btn primary" type="button" data-publish="${p.id}">${icon('check', 15)} שמירה ופרסום ל${esc(cls)}</button><button class="btn" type="button" data-savedraft="${p.id}">שמירת הטיוטה</button><button class="btn link" type="button" data-delpath="${p.id}">מחיקה</button></div><div class="pmsg"></div></article>`;
}
function readDraft(box, p) {
  p.intros = p.intros || {};
  box.querySelectorAll('.dintro').forEach(fs => {
    const val = f => fs.querySelector(`[data-f="${f}"]`).value.trim();
    const it = Intro.validIntro({ short: val('short'), examples: val('examples').split('\n'), more: val('more') });
    if (it) p.intros[fs.dataset.k] = it;
  });
  const sum = box.querySelector('[data-f="summary"]'); if (sum && p.video) p.video.summary = sum.value.trim().slice(0, 4000);
  L.savePath(p);
}
function bindDrafts(root, redo) {
  const box = id => root.querySelector(`[data-draft="${id}"]`);
  root.querySelectorAll('[data-savedraft]').forEach(b => b.onclick = () => { const p = L.getPath(b.dataset.savedraft); readDraft(box(p.id), p); box(p.id).querySelector('.pmsg').innerHTML = '<span class="sent">נשמר ✓</span>'; });
  root.querySelectorAll('[data-publish]').forEach(b => b.onclick = () => { const p = L.getPath(b.dataset.publish); readDraft(box(p.id), p); L.publishPath(p.id); E.live(`פורסם לכיתה: ${p.title}`); redo(); });
  root.querySelectorAll('[data-regen]').forEach(b => b.onclick = async () => {
    const p = L.getPath(b.dataset.regen); readDraft(box(p.id), p);
    b.disabled = true; b.textContent = 'אלומה כותבת מחדש…';
    await Intro.forPath(p, { sourceText: p.video ? `סיכום הסרטון:\n${p.video.summary}` : '' }); L.savePath(p); redo();
  });
}
