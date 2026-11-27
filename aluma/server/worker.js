// Aluma server on Cloudflare Workers (spec 01/16, prototype stage).
//  - /v1beta/...  Gemini proxy: the GEMINI_API_KEY secret stays here, never in the site.
//  - /db/...      small per-user store in D1 (conversations, memories) for real Google accounts.
// Who may call:
//  - signed-in Google users: the Google access token is checked with Google and must belong to
//    Aluma's OAuth client (azp) – then they get their own daily limit and their own storage;
//  - demo visitors (no Google sign-in): Gemini only, with a small per-IP daily limit, no storage.
// Only requests from the Aluma site are accepted (CORS + Origin check).

const ALLOWED_ORIGINS = ['https://coolschooliltamar-bit.github.io', 'http://localhost:8765'];
const GOOGLE_CLIENT_ID = '1054746371715-vpsff7knc52n61rmhgrgotf0ag3t90u2.apps.googleusercontent.com';
const LIMITS = { user: 400, demoIp: 600, total: 8000 };     // Gemini calls per day (a whole school shares one IP behind NAT, so the demo limit per IP is high)
const DOC_COLLECTIONS = ['convs', 'memories', 'settings', 'game'];
const VIDEO_COST = 10;                                        // a video summary uses this many of the daily Gemini calls
const MAX_DOC = 300_000;                                      // bytes per stored document

const tokenCache = new Map();                                 // access token -> { sub, exp }
// shared router learning
const ROUTER_K = 3;                                           // different voters before a word is shared
const ROUTER_DAILY = 80;                                      // votes per voter per day
const ROUTER_TOPICS = new Set(['grades', 'average', 'assignments', 'attendance', 'announcements', 'schedule', 'progress', 'teachers']);
const ROUTER_BLOCK = new Set(('לא אל למה איך כדי אם צריך עצוב לחוץ מפחד הוגן לשפר טיפים זה אומר דורש לעשות לדחות עזרה כועס קשה ' +
  'חולה מחלה בריאות דיכאון חרדה תרופה טיפול פסיכולוג אבא אמא הורים גירושים כסף משכורת חוב כתובת טלפון רחוב דת מוות אלימות מכות סמים אלכוהול סקס הריון משטרה עונש').split(' '));
const routerBlocked = k => { const w = k.replace(/^~/, ''); return ROUTER_BLOCK.has(w) || [...ROUTER_BLOCK].some(b => b.length >= 3 && w === b.replace(/[םןץףך]/g, c => ({ 'ם': 'מ', 'ן': 'נ', 'ץ': 'צ', 'ף': 'פ', 'ך': 'כ' }[c])).replace(/(?!^)[וי]/g, '')); };
let vocabCache = null;
const MAX_CARD = 1000;
const METRIC_EVENTS = new Set(['visit', 'question_fast', 'question_ai', 'lesson_done', 'path_created', 'tool_used', 'reminders_opened']);                                        // cards 1–1000
const handleOf = async (env, course, sub) => (await hmac(env, `member|${course}|${sub}`)).slice(0, 16);
async function hmac(env, text) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.GEMINI_API_KEY || 'aluma'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode('router|' + text)));
  return [...sig.slice(0, 16)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
    const cors = { 'Access-Control-Allow-Origin': allow, 'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Max-Age': '86400', Vary: 'Origin' };
    const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    const url = new URL(req.url);
    if (url.pathname === '/health') return json({ ok: true, gemini: !!env.GEMINI_API_KEY, db: !!env.DB });
    if (!ALLOWED_ORIGINS.includes(origin)) return json({ error: { message: 'Forbidden origin' } }, 403);

    try {
      const who = await identify(req, env);                    // { sub } for Google users, null for demo

      // ---------- Gemini proxy ----------
      if (url.pathname.startsWith('/v1beta/')) {
        if (!env.GEMINI_API_KEY) return json({ error: { message: 'השרת עוד לא הוגדר: חסר GEMINI_API_KEY.' } }, 503);
        const isList = req.method === 'GET' && url.pathname === '/v1beta/models';
        const isGen = req.method === 'POST' && /^\/v1beta\/models\/gemini-[\w.-]+:generateContent$/.test(url.pathname);
        if (!isList && !isGen) return json({ error: { message: 'Not found' } }, 404);
        if (isGen) {
          const ip = req.headers.get('CF-Connecting-IP') || 'unknown';
          if (!(await take(env, `total`, LIMITS.total))) return json({ error: { message: 'הגענו למכסה היומית של אלומה. נסו מחר.' } }, 429);
          const ok = who ? await take(env, `u:${who.sub}`, LIMITS.user) : await take(env, `ip:${ip}`, LIMITS.demoIp);
          if (!ok) return json({ error: { message: who ? 'הגעת למכסת השאלות היומית.' : 'מכסת ההדגמה היומית נגמרה. התחברו עם Google כדי להמשיך.' } }, 429);
        }
        const body = isGen ? await req.text() : undefined;
        // a teacher's short video (inline, for a lesson summary) may be up to ~20MB; everything else stays small.
        // A video request counts as VIDEO_COST calls of the daily limits.
        const video = body && body.length > 400_000 && /"inlineData"\s*:\s*\{\s*"mimeType"\s*:\s*"video\/[\w.+-]+"/.test(body.slice(0, 4000));
        if (body && body.length > (video ? 20_000_000 : 400_000)) return json({ error: { message: 'Request too large' } }, 413);
        if (video) {
          const ip = req.headers.get('CF-Connecting-IP') || 'unknown';
          for (let i = 1; i < VIDEO_COST; i++) {
            const ok = who ? await take(env, `u:${who.sub}`, LIMITS.user) : await take(env, `ip:${ip}`, LIMITS.demoIp);
            if (!ok) return json({ error: { message: 'הגעת למכסה היומית – אי אפשר לסכם עוד סרטונים היום.' } }, 429);
          }
        }
        const up = await fetch(`https://generativelanguage.googleapis.com${url.pathname}${isList ? '?pageSize=200' : ''}`, {
          method: req.method, body, headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY } });
        return new Response(up.body, { status: up.status, headers: { ...cors, 'Content-Type': 'application/json' } });
      }

      // ---------- pilot metrics: daily counters only (no names, e-mails, IPs or question text) ----------
      // An active user is counted with a hash that changes every day, so days cannot be linked to one person.
      if (url.pathname === '/metrics/event' && req.method === 'POST') {
        const b = JSON.parse((await req.text()).slice(0, 500) || '{}');
        if (!METRIC_EVENTS.has(b.e)) return json({ error: { message: 'bad request' } }, 400);
        const ip = req.headers.get('CF-Connecting-IP') || 'unknown';
        if (!(await take(env, `m:${ip}`, 600))) return json({ ok: true, counted: false });
        const day = new Date().toISOString().slice(0, 10), mode = who ? 'live' : 'demo';
        await env.DB.prepare(`INSERT INTO metrics (day, event, mode, count) VALUES (?, ?, ?, 1)
          ON CONFLICT(day, event, mode) DO UPDATE SET count = count + 1`).bind(day, b.e, mode).run();
        const uh = (await hmac(env, `metric|${day}|${who ? who.sub : ip}`)).slice(0, 20);
        await env.DB.prepare('INSERT OR IGNORE INTO metrics_users (day, mode, uh) VALUES (?, ?, ?)').bind(day, mode, uh).run();
        if (Math.random() < 0.01) {   // keep 120 days
          const old = new Date(Date.now() - 120 * 864e5).toISOString().slice(0, 10);
          await env.DB.batch([env.DB.prepare('DELETE FROM metrics WHERE day < ?').bind(old), env.DB.prepare('DELETE FROM metrics_users WHERE day < ?').bind(old)]);
        }
        return json({ ok: true, counted: true });
      }
      if (url.pathname === '/metrics' && req.method === 'GET') {
        const days = Math.max(1, Math.min(120, +url.searchParams.get('days') || 30));
        const from = new Date(Date.now() - (days - 1) * 864e5).toISOString().slice(0, 10);
        const ev = (await env.DB.prepare('SELECT day, event, mode, count FROM metrics WHERE day >= ? ORDER BY day').bind(from).all()).results || [];
        const us = (await env.DB.prepare('SELECT day, mode, COUNT(*) AS n FROM metrics_users WHERE day >= ? GROUP BY day, mode ORDER BY day').bind(from).all()).results || [];
        return new Response(JSON.stringify({ from, days, events: ev, users: us }), { headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'max-age=60' } });
      }

      // ---------- shared learning of the fast-answer router ----------
      // Votes are single word stems for a topic – never sentences. A voter is stored only as an HMAC
      // (Google account or network), so no e-mail or IP address is kept. A word is published only when
      // ROUTER_K different voters taught it and few voted against it.
      if (url.pathname === '/router/learn' && req.method === 'POST') {
        const b = JSON.parse((await req.text()).slice(0, 4000) || '{}');
        if (!ROUTER_TOPICS.has(b.intent) || ![1, -1].includes(b.vote) || !Array.isArray(b.keys)) return json({ error: { message: 'bad request' } }, 400);
        const keys = [...new Set(b.keys.map(String))].filter(k => /^~?[\u05D0-\u05EAa-z0-9]{2,20}$/.test(k) && !routerBlocked(k)).slice(0, 12);
        if (!keys.length) return json({ ok: true, stored: 0 });
        const voter = await hmac(env, who ? `u:${who.sub}` : `ip:${req.headers.get('CF-Connecting-IP') || 'unknown'}`);
        if (!(await take(env, `rl:${voter}`, ROUTER_DAILY))) return json({ error: { message: 'limit' } }, 429);
        const now = new Date().toISOString();
        await env.DB.batch(keys.map(k => env.DB.prepare(`INSERT INTO router_votes (word, intent, voter, vote, at) VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(word, intent, voter) DO UPDATE SET vote = excluded.vote, at = excluded.at`).bind(k, b.intent, voter, b.vote, now)));
        return json({ ok: true, stored: keys.length });
      }
      if (url.pathname === '/router/vocab' && req.method === 'GET') {
        if (!vocabCache || vocabCache.exp < Date.now()) {
          const rows = await env.DB.prepare(`SELECT word, intent, SUM(CASE WHEN vote > 0 THEN 1 ELSE 0 END) AS pos, SUM(CASE WHEN vote < 0 THEN 1 ELSE 0 END) AS neg
            FROM router_votes GROUP BY word, intent HAVING pos >= ? AND pos >= 2 * neg LIMIT 5000`).bind(ROUTER_K).all();
          const vocab = {}; for (const r of rows.results || []) (vocab[r.intent] = vocab[r.intent] || {})[r.word] = 1;
          vocabCache = { vocab, exp: Date.now() + 300000 };
        }
        return new Response(JSON.stringify({ vocab: vocabCache.vocab, k: ROUTER_K }), { headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'max-age=300' } });
      }

      // ---------- class view of the rewards (opt-in) ----------
      // A student shares a tiny profile (first name, level, card ids, badges) with one Classroom course.
      // Membership is checked with Google Classroom using the student's own token, so only members
      // of a course can share to it or read it. No XP numbers, no grades.
      if (url.pathname === '/game/share' && req.method === 'POST') {
        if (!who) return json({ error: { message: 'Unauthorized' } }, 401);
        const b = JSON.parse((await req.text()).slice(0, 16000) || '{}');
        const courseId = String(b.courseId || '').slice(0, 40);
        if (!/^[\w-]+$/.test(courseId) || !(await inCourse(req, courseId))) return json({ error: { message: 'Not a member' } }, 403);
        if (!b.profile) { await env.DB.prepare('DELETE FROM class_members WHERE course_id = ? AND user_sub = ?').bind(courseId, who.sub).run(); return json({ ok: true }); }
        const p = b.profile, ints = (a, max) => (Array.isArray(a) ? a : []).map(Number).filter(n => Number.isInteger(n) && n >= 1 && n <= max).slice(0, 1000);
        const profile = { first: String(p.first || '').replace(/[<>]/g, '').slice(0, 24), level: Math.max(0, Math.min(10, p.level | 0)), cards: [...new Set(ints(p.cards, MAX_CARD))],
          badges: (Array.isArray(p.badges) ? p.badges : []).map(String).filter(x => /^[a-z0-9_]{2,20}$/.test(x)).slice(0, 12), avatar: ints([p.avatar], MAX_CARD)[0] || null, race: !!p.race, week: Math.max(0, Math.min(200, p.week | 0)) };
        await env.DB.prepare(`INSERT INTO class_members (course_id, user_sub, profile, updated_at) VALUES (?, ?, ?, ?)
          ON CONFLICT(course_id, user_sub) DO UPDATE SET profile = excluded.profile, updated_at = excluded.updated_at`).bind(courseId, who.sub, JSON.stringify(profile), new Date().toISOString()).run();
        return json({ ok: true });
      }
      const gm = url.pathname.match(/^\/game\/class\/([\w-]{1,40})$/);
      if (gm && req.method === 'GET') {
        if (!who) return json({ error: { message: 'Unauthorized' } }, 401);
        if (!(await inCourse(req, gm[1]))) return json({ error: { message: 'Not a member' } }, 403);
        const rows = await env.DB.prepare('SELECT user_sub, profile FROM class_members WHERE course_id = ? ORDER BY updated_at DESC LIMIT 60').bind(gm[1]).all();
        const members = [];
        for (const r of rows.results || []) members.push({ ...JSON.parse(r.profile), me: r.user_sub === who.sub, handle: r.user_sub === who.sub ? null : await handleOf(env, gm[1], r.user_sub) });
        return json({ members });
      }

      // ---------- card trading between members of one course (both must share their profile) ----------
      // Members are addressed by a per-course handle (HMAC), never by their Google id. The server keeps the
      // offers; each client applies an answered trade to its own collection once. Limits: 1–3 cards a side,
      // 5 open offers, offers expire after 7 days, 40 trade actions a day.
      if (url.pathname.startsWith('/game/trade')) {
        if (!who) return json({ error: { message: 'צריך להתחבר עם Google.' } }, 401);
        const now = new Date().toISOString(), weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();
        await env.DB.prepare("UPDATE card_trades SET status = 'expired', updated_at = ? WHERE status = 'pending' AND created_at < ?").bind(now, weekAgo).run();
        const tl = url.pathname.match(/^\/game\/trades\/([\w-]{1,40})$/);
        if (tl && req.method === 'GET') {
          if (!(await inCourse(req, tl[1]))) return json({ error: { message: 'Not a member' } }, 403);
          const names = new Map(((await env.DB.prepare('SELECT user_sub, profile FROM class_members WHERE course_id = ?').bind(tl[1]).all()).results || []).map(r => [r.user_sub, JSON.parse(r.profile).first]));
          const rows = (await env.DB.prepare('SELECT * FROM card_trades WHERE course_id = ? AND (from_sub = ? OR to_sub = ?) AND created_at > ? ORDER BY created_at DESC LIMIT 60')
            .bind(tl[1], who.sub, who.sub, new Date(Date.now() - 30 * 864e5).toISOString()).all()).results || [];
          return json({ trades: rows.map(t => { const out = t.from_sub === who.sub; return { id: t.id, dir: out ? 'out' : 'in', other: names.get(out ? t.to_sub : t.from_sub) || 'חבר/ה', give: JSON.parse(t.give), want: JSON.parse(t.want), status: t.status, at: t.created_at }; }) });
        }
        if (req.method !== 'POST') return json({ error: { message: 'Not found' } }, 404);
        const b = JSON.parse((await req.text()).slice(0, 2000) || '{}');
        const courseId = String(b.courseId || '').slice(0, 40);
        if (!/^[\w-]+$/.test(courseId) || !(await inCourse(req, courseId))) return json({ error: { message: 'Not a member' } }, 403);
        if (!(await take(env, `trade:${who.sub}`, 40))) return json({ error: { message: 'הגעת למספר ההחלפות היומי. נסו שוב מחר.' } }, 429);
        if (url.pathname === '/game/trade') {
          const ids = a => [...new Set((Array.isArray(a) ? a : []).map(Number).filter(n => Number.isInteger(n) && n >= 1 && n <= MAX_CARD))];
          const give = ids(b.give), want = ids(b.want);
          if (!give.length || !want.length || give.length > 3 || want.length > 3) return json({ error: { message: 'אפשר 1–3 קלפים בכל צד.' } }, 400);
          const rows = (await env.DB.prepare('SELECT user_sub, profile FROM class_members WHERE course_id = ?').bind(courseId).all()).results || [];
          const me = rows.find(r => r.user_sub === who.sub);
          if (!me) return json({ error: { message: 'כדי להחליף צריך לשתף את האוסף עם הכיתה.' } }, 403);
          let to = null; for (const r of rows) if (r.user_sub !== who.sub && (await handleOf(env, courseId, r.user_sub)) === String(b.to || '')) to = r;
          if (!to) return json({ error: { message: 'החבר/ה לא נמצא/ה בכיתה או הפסיק/ה לשתף.' } }, 404);
          const mine = JSON.parse(me.profile).cards || [], theirs = JSON.parse(to.profile).cards || [];
          if (!give.every(id => mine.includes(id))) return json({ error: { message: 'אחד הקלפים שהצעת לא נמצא באוסף ששיתפת.' } }, 409);
          if (!want.every(id => theirs.includes(id))) return json({ error: { message: 'אחד הקלפים שביקשת כבר לא אצל החבר/ה.' } }, 409);
          const open = await env.DB.prepare("SELECT COUNT(*) AS n FROM card_trades WHERE from_sub = ? AND status = 'pending'").bind(who.sub).first();
          if (open.n >= 5) return json({ error: { message: 'יש לך כבר 5 הצעות פתוחות. חכו לתשובה או בטלו אחת.' } }, 429);
          const id = crypto.randomUUID();
          await env.DB.prepare('INSERT INTO card_trades (id, course_id, from_sub, to_sub, give, want, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
            .bind(id, courseId, who.sub, to.user_sub, JSON.stringify(give), JSON.stringify(want), 'pending', now, now).run();
          await audit(env, who.sub, 'trade_offer');
          return json({ ok: true, id });
        }
        const ta = url.pathname.match(/^\/game\/trade\/([\w-]{8,40})$/);
        if (ta) {
          const action = String(b.action || '');
          const rule = { accept: ['to_sub', 'accepted'], decline: ['to_sub', 'declined'], cancel: ['from_sub', 'cancelled'] }[action];
          if (!rule) return json({ error: { message: 'פעולה לא מוכרת' } }, 400);
          const r = await env.DB.prepare(`UPDATE card_trades SET status = ?, updated_at = ? WHERE id = ? AND course_id = ? AND ${rule[0]} = ? AND status = 'pending'`).bind(rule[1], now, ta[1], courseId, who.sub).run();
          if (!r.meta || r.meta.changes !== 1) return json({ error: { message: 'ההצעה כבר לא פתוחה.' } }, 409);
          await audit(env, who.sub, `trade_${action}`);
          return json({ ok: true, status: rule[1] });
        }
        return json({ error: { message: 'Not found' } }, 404);
      }

      // ---------- per-user storage ----------
      const m = url.pathname.match(/^\/db\/([a-z]+)$/);
      if (m) {
        if (!who) return json({ error: { message: 'צריך להתחבר עם Google כדי לשמור.' } }, 401);
        if (!DOC_COLLECTIONS.includes(m[1])) return json({ error: { message: 'Unknown collection' } }, 404);
        if (req.method === 'GET') {
          const row = await env.DB.prepare('SELECT data, updated_at FROM user_docs WHERE user_sub = ? AND collection = ?').bind(who.sub, m[1]).first();
          return json(row ? { data: JSON.parse(row.data), updatedAt: row.updated_at } : { data: null });
        }
        if (req.method === 'PUT') {
          const text = await req.text();
          if (text.length > MAX_DOC) return json({ error: { message: 'Too large' } }, 413);
          JSON.parse(text);                                    // must be valid JSON
          const now = new Date().toISOString();
          await env.DB.prepare(`INSERT INTO user_docs (user_sub, collection, data, updated_at) VALUES (?, ?, ?, ?)
            ON CONFLICT(user_sub, collection) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`).bind(who.sub, m[1], text, now).run();
          await audit(env, who.sub, `save_${m[1]}`);
          return json({ ok: true, updatedAt: now });
        }
      }
      if (url.pathname === '/db/me' && req.method === 'DELETE') {
        if (!who) return json({ error: { message: 'Unauthorized' } }, 401);
        await env.DB.prepare('DELETE FROM user_docs WHERE user_sub = ?').bind(who.sub).run();
        await audit(env, who.sub, 'delete_all');
        return json({ ok: true });
      }
      return json({ error: { message: 'Not found' } }, 404);
    } catch (e) {
      return json({ error: { message: e.status === 401 ? 'ההתחברות ל-Google לא תקפה. התחברו מחדש.' : 'שגיאת שרת.' } }, e.status || 500);
    }
  },
};

// Verify a Google access token: it must be valid AND issued to Aluma's own OAuth client.
async function identify(req, env) {
  const h = req.headers.get('Authorization') || '';
  if (!h.startsWith('Bearer ')) return null;
  const token = h.slice(7);
  const hit = tokenCache.get(token);
  if (hit && hit.exp > Date.now()) return hit;
  const r = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(token)}`);
  const info = r.ok ? await r.json() : null;
  if (!info || (info.azp !== GOOGLE_CLIENT_ID && info.aud !== GOOGLE_CLIENT_ID) || !info.sub) { const e = new Error('bad token'); e.status = 401; throw e; }
  const who = { sub: info.sub, exp: Date.now() + Math.min(300, Number(info.expires_in) || 60) * 1000 };
  tokenCache.set(token, who);
  if (tokenCache.size > 5000) tokenCache.clear();
  await env.DB.prepare('INSERT INTO users (sub, first_seen, last_seen) VALUES (?, ?, ?) ON CONFLICT(sub) DO UPDATE SET last_seen = excluded.last_seen')
    .bind(info.sub, new Date().toISOString(), new Date().toISOString()).run();
  return who;
}

// Is the signed-in user a member (student or teacher) of this Classroom course? Asked with their own token.
const courseCache = new Map();
async function inCourse(req, courseId) {
  const token = (req.headers.get('Authorization') || '').slice(7);
  const k = token + '|' + courseId, hit = courseCache.get(k);
  if (hit && hit.exp > Date.now()) return hit.ok;
  const r = await fetch(`https://classroom.googleapis.com/v1/courses/${encodeURIComponent(courseId)}?fields=id`, { headers: { Authorization: `Bearer ${token}` } });
  courseCache.set(k, { ok: r.ok, exp: Date.now() + 300000 });
  if (courseCache.size > 5000) courseCache.clear();
  return r.ok;
}

// Daily counters in D1. Returns false when the limit is reached.
async function take(env, key, limit) {
  const day = new Date().toISOString().slice(0, 10);
  const row = await env.DB.prepare(`INSERT INTO usage (key, day, count) VALUES (?, ?, 1)
    ON CONFLICT(key, day) DO UPDATE SET count = count + 1 RETURNING count`).bind(key, day).first();
  return row.count <= limit;
}

async function audit(env, sub, action) {
  await env.DB.prepare('INSERT INTO audit_log (user_sub, action, at) VALUES (?, ?, ?)').bind(sub, action, new Date().toISOString()).run();
}
