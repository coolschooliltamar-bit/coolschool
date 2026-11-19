// New screens: rewards & collection (א), personal project (ב), generated paths & decks (ג/ד),
// teacher approvals and class paths. app.js passes an env with the session and navigation.
import * as Game from './game.js';
import * as P from './projects.js';
import * as S from './studio.js';
import * as L from './learn.js';
import * as Cloud from './cloud.js';
import { CARDS, RARITY, RARITY_ORDER, cardById, unlockText } from './cards.js';
import { cardArt } from './cardart.js';
import { STUDENTS, CLASSES, TEACHERS, subjectName } from './data.js';
import { icon } from './icons.js';
import { db, save, audit } from './store.js';
import { LIVE } from './google.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDate = d => { d = new Date(d); return `${d.getDate()}.${d.getMonth() + 1}`; };
const nameOf = id => (STUDENTS.find(s => s.id === id) || TEACHERS.find(t => t.id === id) || { name: '?' }).name;
const first = n => String(n || '').split(' ')[0];
let E = null;
export function init(env) { E = env; }
const view = () => document.getElementById('view');

// ---------- sticker card (small, in-app) ----------
export function cardTile(c, { locked = false, isNew = false, size = 'm', pick = false, on = false } = {}) {
  const r = RARITY[c.rarity];
  return `<button class="stk ${c.rarity} ${locked ? 'locked' : ''} ${size} ${on ? 'on' : ''}" ${pick && !locked ? `data-avatar="${c.id}"` : 'tabindex="-1"'} aria-label="${esc(c.name)} – ${r.he}${locked ? ' – נעול: ' + esc(unlockText(c, Game.achName)) : ''}">
    <span class="stk-art">${locked ? `<span class="stk-lock">${icon('lock', 22)}</span>` : cardArt(c, { mini: true })}</span>
    <span class="stk-name">${locked ? '???' : esc(c.name)}</span>
    <span class="stk-foot"><span class="stk-r" style="color:${r.color}">${r.symbol} ${r.he}</span><span class="stk-no">${c.no}/40</span></span>
    ${locked ? `<span class="stk-hint">${esc(unlockText(c, Game.achName))}</span>` : ''}${isNew ? '<span class="stk-new">חדש!</span>' : ''}
  </button>`;
}

// ---------- rewards: progress · album · class ----------
let gameTab = 'progress', peek = null;
export function renderGame() {
  const v = view(); const ctx = E.ctx();
  const sid = ctx.role === 'parent' ? E.sid() : ctx.userId;
  if (!sid) { v.innerHTML = '<section class="panel"><p class="hint">אין ילד/ה מקושר/ת.</p></section>'; return; }
  const s = Game.score(ctx, sid);
  const own = ctx.role === 'student';
  const av = Game.avatarOf(sid, s);
  const lv = s.level, inLevel = s.xp - lv * 100, last = lv === Game.LEVELS.length - 1;
  const fresh = own ? Game.newCards(sid, s) : [];
  if (!own) gameTab = gameTab === 'class' ? 'progress' : gameTab;
  const tabs = [['progress', 'התקדמות'], ['album', `אלבום (${Game.unlockedCards(s).length}/40)`], ...(own ? [['class', 'הכיתה']] : [])];
  v.innerHTML = `<section class="panel lpanel"><h2 class="ph">${icon('trophy', 20)} ${own ? 'פרסים והישגים' : `ההתקדמות של ${esc(first(nameOf(sid)))}`}</h2>
    <div class="lvl">
      <div class="lvl-av">${av ? cardArt(av, { mini: true }) : '<span class="lvl-empty">?</span>'}</div>
      <div class="lvl-main"><div class="lvl-t">רמה ${lv} · <b>${esc(Game.LEVELS[lv])}</b></div>
        <div class="bar big" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${last ? 100 : inLevel}" aria-label="התקדמות לרמה הבאה"><i style="width:${last ? 100 : inLevel}%"></i></div>
        <div class="hint">${s.xp} XP מתוך ${Game.SEMESTER_MAX} בסמסטר${last ? ' · הרמה הגבוהה ביותר!' : ` · עוד ${100 - inLevel} XP לרמה ${lv + 1} (${esc(Game.LEVELS[lv + 1])})`}</div></div>
    </div>
    <div class="note-xp">${icon('sparkle', 15)} <span><b>XP הוא מדד – לא המטרה.</b> הוא משקף כמה ${own ? 'את/ה משקיע/ה' : 'יש השקעה'} בלמידה: הגשות בזמן ובאיכות, מבחנים ותרגול. אין מה לקנות, אין הגרלות ואין לחץ זמן – כל פרס נפתח לפי כלל קבוע שרואים מראש.</span></div>
    <div class="subj-tabs" role="tablist">${tabs.map(([k, l]) => `<button class="tab" role="tab" aria-selected="${gameTab === k}" data-gtab="${k}">${l}</button>`).join('')}</div>
    <div id="gbody"></div></section>`;
  v.querySelectorAll('[data-gtab]').forEach(b => b.onclick = () => { gameTab = b.dataset.gtab; peek = null; renderGame(); });
  const body = v.querySelector('#gbody');
  if (gameTab === 'progress') body.innerHTML = progressTab(s, own, fresh);
  if (gameTab === 'album') body.innerHTML = albumTab(sid, s, own, fresh);
  if (gameTab === 'class') { classTab(body, ctx, s); return; }
  body.querySelectorAll('[data-avatar]').forEach(b => b.onclick = () => { Game.setState(sid, { avatar: +b.dataset.avatar }); E.live(`הדמות שלך עכשיו: ${cardById(b.dataset.avatar).name}`); renderGame(); E.refreshSide(); });
  const go = body.querySelector('[data-goto]'); if (go) go.onclick = () => { gameTab = go.dataset.goto; renderGame(); };
  body.querySelectorAll('[data-go]').forEach(b => b.onclick = () => E.go(b.dataset.go));
  if (own && gameTab === 'album') { Game.markSeen(sid, s); E.refreshSide(); }
}
function progressTab(s, own, fresh) {
  const bar = (k, label, w, facts) => `<div class="xpart"><div class="xpart-h"><b>${label}</b><span class="tag">${w}</span><span class="xpart-n">${s.parts[k]} / ${Game.CAPS[k]}</span></div>
    <div class="bar"><i style="width:${s.parts[k] / Game.CAPS[k] * 100}%"></i></div><div class="hint">${facts}</div></div>`;
  const f = s.facts, R = Game.RULES;
  const next = Game.nextRewards(s);
  return `${fresh.length ? `<div class="reco">${icon('star', 16)} <b>${fresh.length === 1 ? 'קלף חדש נפתח' : `${fresh.length} קלפים חדשים נפתחו`}:</b> ${fresh.slice(0, 4).map(c => esc(c.name)).join(', ')} <button class="btn link" data-goto="album">לאלבום</button></div>` : ''}
    <h3>מאיפה מגיע ה-XP</h3>
    ${bar('submissions', 'הגשות בזמן ובאיכות', '40%', `${f.onTime} הגשות בזמן (+${R.onTime} כל אחת) · ${f.late} באיחור (+${R.late}) · ${f.missing} שלא הוגשו · איכות העבודות: +${f.quality}`)}
    ${bar('exams', 'מבחנים ובחנים', '20%', `${f.examsN} ציונים · כל מבחן נותן עד ${R.examMax} XP לפי הציון, בוחן עד ${R.quizMax}, ושיפור של 5+ נקודות באותו מקצוע: +${R.improve}`)}
    ${bar('learning', 'כלי הלמידה של אלומה', '40%', `${f.lessons} שיעורים הושלמו · ${f.reviews} חזרות בכרטיסיות · היום: ${f.today}/${L.DAILY_LEARNING_XP} XP (תקרה יומית, כדי שלא יהיה שווה "לטחון")`)}
    <p class="hint">האחוזים הם החלק המקסימלי של כל מקור מתוך ${Game.SEMESTER_MAX} XP בסמסטר. מסלולים וכרטיסיות שיצרת לעצמך הם תרגול חופשי – בלי XP. מסלולים שהמורה פרסם/ה והמסלול המותאם של אלומה – עם XP.</p>
    <h3>הישגים ומדבקות</h3>
    <div class="badges">${Object.entries(Game.ACHIEVEMENTS).map(([k, a]) => `<div class="badge-i ${s.ach[k] ? 'got' : ''}" title="${esc(a.desc)}"><span class="bs">${a.sticker}</span><b>${esc(a.name)}</b><small>${esc(a.desc)}</small></div>`).join('')}</div>
    ${next.length ? `<h3>הפרסים הבאים</h3><div class="stk-row">${next.map(c => `<div class="next-r">${cardTile(c, { locked: true, size: 's' })}<span class="hint">עוד ${c.unlock.xp - s.xp} XP</span></div>`).join('')}</div>` : ''}
    ${own ? `<div class="btns"><button class="btn primary" data-go="path">${icon('sparkle', 16)} לתרגל עכשיו</button><button class="btn" data-go="project">${icon('bulb', 16)} פרויקט אישי</button></div>` : ''}`;
}
function albumTab(sid, s, own, fresh) {
  const st = Game.state(sid); const av = Game.avatarOf(sid, s);
  const isNew = new Set(fresh.map(c => c.id));
  return `<p class="hint">${own ? 'לחצו על קלף שפתחתם כדי לבחור אותו כדמות שלכם. ' : ''}כל הקלפים מוצגים מראש עם הכלל שפותח אותם – בלי הפתעות ובלי קנייה. ההתפלגות באוסף: ${RARITY_ORDER.map(r => `${RARITY[r].he} ${RARITY[r].count} (${RARITY[r].share})`).join(' · ')}.</p>
    ${RARITY_ORDER.map(r => { const list = CARDS.filter(c => c.rarity === r); const got = list.filter(c => Game.unlocked(s, c)).length;
      return `<div class="alb-h ${r}"><span style="color:${RARITY[r].color}">${RARITY[r].symbol}</span> <b>${RARITY[r].he}</b> · ${RARITY[r].en} <span class="hint">${got}/${list.length} · ${RARITY[r].share} מהאוסף</span></div>
        <div class="stk-grid">${list.map(c => cardTile(c, { locked: !Game.unlocked(s, c), isNew: isNew.has(c.id), pick: own, on: av && av.id === c.id })).join('')}</div>`; }).join('')}`;
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
    <div class="mates">${shared.map(m => `<button class="mate" ${st.share ? `data-peek="${m.id}"` : 'disabled'}><span class="mate-av">${m.avatar ? cardArt(m.avatar, { mini: true }) : ''}</span><b>${esc(m.first)}</b><small>רמה ${m.level} · ${esc(m.levelName)}</small><small>${m.cards.length}/40 קלפים · ${m.badges.map(k => Game.ACHIEVEMENTS[k].sticker).join('')}</small></button>`).join('')}</div>
    ${mates.length - shared.length ? `<p class="hint">עוד ${mates.length - shared.length} חברים בחרו לא לשתף.</p>` : ''}`;
  bind();
}
// live accounts: the class is a Google Classroom course; profiles go through Aluma's server
function shareLive(ctx, s) {
  const course = LIVE.courses.find(c => c.role === 'student'); if (!course) return;
  const st = Game.state(ctx.userId);
  Cloud.shareGame(course.id, st.share ? { first: first(ctx.user.name), level: s.level, cards: Game.unlockedCards(s).map(c => c.id), badges: Object.keys(s.ach).filter(k => s.ach[k]),
    avatar: (Game.avatarOf(ctx.userId, s) || {}).id || null, race: !!st.race, week: L.weekLessons(ctx.userId) } : null);
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
    <h3>מה יש לחברים</h3>${others.length ? `<div class="mates">${others.map(m => `<div class="mate"><span class="mate-av">${m.avatar ? cardArt(cardById(m.avatar), { mini: true }) : ''}</span><b>${esc(m.first)}</b><small>רמה ${m.level} · ${esc(Game.LEVELS[m.level] || '')}</small><small>${m.cards.length}/40 קלפים</small></div>`).join('')}</div>` : '<p class="hint">עוד אף אחד מהכיתה לא שיתף. אפשר להזמין חברים להתחבר לאלומה.</p>'}`;
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
export function createForm(ctx, { kind = 'path', forTeacher = false } = {}) {
  const subs = forTeacher ? ctx.subjects : (ctx.live ? LIVE.courses.map(c => c.name) : L.LEARN_SUBJECTS.concat(['literature', 'hebrew', 'bible']));
  return `<form class="studio" id="studio">
    <div class="formrow"><label for="sk">מה ליצור</label><select id="sk"><option value="path" ${kind === 'path' ? 'selected' : ''}>מסלול תרגול</option><option value="cards" ${kind === 'cards' ? 'selected' : ''}>כרטיסיות זיכרון</option></select>
      <label for="ss" style="min-width:auto">מקצוע</label><select id="ss"><option value="">לפי הבקשה</option>${subs.map(s => `<option value="${esc(s)}">${esc(subjectName(s))}</option>`).join('')}</select>
      ${forTeacher ? `<label for="sc" style="min-width:auto">לכיתה</label><select id="sc">${CLASSES.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select>` : ''}</div>
    <label for="sr" class="sr-only">הבקשה</label><textarea id="sr" rows="2" maxlength="500" placeholder="${forTeacher ? 'למשל: מסלול חזרה על המהפכה הצרפתית לקראת המבחן, עם דגש על הצהרת זכויות האדם' : 'למשל: כרטיסיות על זמן עבר באנגלית, או מסלול על התא החי'}"></textarea>
    <div class="formrow"><label class="filebtn">${icon('clip', 16)} העלאת קובץ עם החומר<input type="file" id="sf" accept=".txt,.md,.pdf,.docx,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" hidden></label><span id="sfn" class="hint">TXT, PDF או Word · נשאר בדפדפן</span>
      <span class="spacer"></span><button class="btn primary" id="sgo">${icon('sparkle', 16)} ${forTeacher ? 'יצירה ופרסום לכיתה' : 'יצירה'}</button></div>
    <p class="hint">${forTeacher ? 'אלומה מתאימה את הרמה לפי ממוצע הכיתה במקצוע והנושאים האחרונים. מסלול שמורה מפרסם/ת <b>מזכה ב-XP</b>.' : 'אלומה מתאימה את הרמה לפי הציונים שלך וממוצע הכיתה. מסלולים שיצרת לעצמך הם <b>תרגול חופשי בלי XP</b>.'}</p><div id="smsg"></div></form>`;
}
export function bindCreateForm(root, ctx, onDone, { forTeacher = false } = {}) {
  const f = root.querySelector('#studio'); if (!f) return;
  let file = null;
  f.querySelector('#sf').onchange = async e => {
    const fl = e.target.files[0]; if (!fl) return;
    f.querySelector('#sfn').textContent = `קוראת את ${fl.name}…`;
    try { file = { name: fl.name, text: await S.fileToText(fl) }; f.querySelector('#sfn').innerHTML = `${icon('clip', 14)} ${esc(fl.name)} (${Math.round(file.text.length / 100) / 10}K תווים)`; }
    catch (err) { file = null; f.querySelector('#sfn').innerHTML = `<span class="err">${esc(err.message)}</span>`; }
  };
  f.onsubmit = async e => {
    e.preventDefault();
    const go = f.querySelector('#sgo'); go.disabled = true; go.textContent = 'אלומה בונה…';
    try {
      const path = await S.create(ctx, { kind: f.querySelector('#sk').value, subject: f.querySelector('#ss').value || null, request: f.querySelector('#sr').value, fileText: file ? file.text : '', fileName: file ? file.name : '', classId: forTeacher ? f.querySelector('#sc').value : null, studentId: ctx.role === 'student' ? ctx.userId : null });
      onDone(path);
    } catch (err) { go.disabled = false; go.textContent = 'יצירה'; f.querySelector('#smsg').innerHTML = `<p class="err">${esc(err.message)}</p>`; }
  };
}
export function pathCard(p, ctx, { manage = false } = {}) {
  const n = p.units.reduce((a, u) => a + u.qs.length, 0);
  const done = ctx.role === 'student' ? p.units.filter((u, i) => L.pathUnitDone(ctx.userId, p.id, i)).length : 0;
  return `<article class="gpath"><div class="proj-h"><b>${esc(p.title)}</b>${p.xp ? '<span class="tag ok">עם XP</span>' : '<span class="tag">בלי XP</span>'}</div>
    <div class="hint">${esc(subjectName(p.subject))} · רמה ${esc(p.level)} · ${p.units.length} יחידות · ${n} שאלות · ${p.cards.length} כרטיסיות${p.classId ? ` · ${esc((CLASSES.find(c => c.id === p.classId) || {}).name)} · מאת ${esc(p.ownerName)}` : ''}${p.fileName ? ` · מתוך ${esc(p.fileName)}` : ''} · ${p.source === 'gemini' ? 'נוצר ב-Gemini' : 'נבנה מהמאגר'}</div>
    ${p.basedOn && (p.basedOn.my != null || p.basedOn.classAvg != null) ? `<div class="hint">מותאם לפי: ${p.basedOn.my != null ? `הממוצע ${ctx.role === 'teacher' ? 'של התלמיד/ה' : 'שלך'} ${p.basedOn.my}` : ''}${p.basedOn.my != null && p.basedOn.classAvg != null ? ' · ' : ''}${p.basedOn.classAvg != null ? `ממוצע הכיתה ${p.basedOn.classAvg}` : ''}${p.basedOn.weak && p.basedOn.weak.length ? ` · לחיזוק: ${p.basedOn.weak.map(esc).join(', ')}` : ''}</div>` : ''}
    ${ctx.role === 'student' && p.units.length ? `<div class="punits">${p.units.map((u, i) => `<button class="punit ${L.pathUnitDone(ctx.userId, p.id, i) ? 'done' : ''}" data-start="${p.id}:${i}">${L.pathUnitDone(ctx.userId, p.id, i) ? '✓' : i + 1}. ${esc(u.title)}</button>`).join('')}</div><div class="hint">${done}/${p.units.length} יחידות הושלמו</div>` : ''}
    <div class="btns">${p.cards.length && ctx.role === 'student' ? `<button class="btn" data-deck="${p.id}">${icon('layers', 15)} כרטיסיות</button>` : ''}${manage ? `<button class="btn link" data-delpath="${p.id}">מחיקה</button>` : ''}</div>
    ${ctx.role === 'teacher' ? `<details><summary>תצוגה מקדימה</summary>${p.units.map(u => `<b>${esc(u.title)}</b><ol>${u.qs.map(q => `<li>${esc(q.q)} <span class="hint">(${esc(q.options[q.answer])})</span></li>`).join('')}</ol>`).join('')}</details>` : ''}</article>`;
}
export function bindPathCards(root, ctx, redo) {
  root.querySelectorAll('[data-start]').forEach(b => b.onclick = () => { const [id, u] = b.dataset.start.split(':'); E.startPath(id, +u); });
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
      <form class="formrow" id="adf"><label for="ads">מקצוע</label><select id="ads">${subs.map(s => `<option value="${esc(s)}">${esc(subjectName(s))}</option>`).join('')}</select><button class="btn primary" id="adgo">${icon('sparkle', 16)} בניית מסלול מותאם</button></form><div id="admsg"></div>
      ${list.map(p => pathCard(p, ctx, { manage: true })).join('') || '<p class="hint">עוד אין מסלולים מותאמים.</p>'}`;
    box.querySelector('#adf').onsubmit = async e => {
      e.preventDefault(); const b = box.querySelector('#adgo'); b.disabled = true; b.textContent = 'בודקת את הרמה ובונה…';
      try { await S.create(ctx, { kind: 'path', subject: box.querySelector('#ads').value, adaptive: true, studentId: uid }); redo(); }
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
  v.innerHTML = `<section class="panel lpanel"><h2 class="ph">${icon('sparkle', 20)} מסלולים לכיתה</h2>
    <p class="hint">כתבו מה אתם רוצים – אלומה תבנה מסלול תרגול או כרטיסיות לפי הבקשה, לפי הרמה של הכיתה ולפי קובץ שתעלו, ותפרסם לכיתה. אפשר גם לבקש בצ׳אט: "תבני מסלול לט׳2 על…".</p>
    ${createForm(ctx, { forTeacher: true })}<h3>פורסמו (${list.length})</h3>${list.map(p => pathCard(p, ctx, { manage: true })).join('') || '<p class="hint">עוד לא פרסמת מסלולים.</p>'}</section>`;
  bindCreateForm(v, ctx, p => { E.live(`פורסם לכיתה: ${p.title}`); renderTeacherPaths(); }, { forTeacher: true });
  bindPathCards(v, ctx, renderTeacherPaths);
}
