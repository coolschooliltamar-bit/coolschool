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
const MAX_DOC = 300_000;                                      // bytes per stored document

const tokenCache = new Map();                                 // access token -> { sub, exp }

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
        if (body && body.length > 400_000) return json({ error: { message: 'Request too large' } }, 413);
        const up = await fetch(`https://generativelanguage.googleapis.com${url.pathname}${isList ? '?pageSize=200' : ''}`, {
          method: req.method, body, headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY } });
        return new Response(up.body, { status: up.status, headers: { ...cors, 'Content-Type': 'application/json' } });
      }

      // ---------- class view of the rewards (opt-in) ----------
      // A student shares a tiny profile (first name, level, card ids, badges) with one Classroom course.
      // Membership is checked with Google Classroom using the student's own token, so only members
      // of a course can share to it or read it. No XP numbers, no grades.
      if (url.pathname === '/game/share' && req.method === 'POST') {
        if (!who) return json({ error: { message: 'Unauthorized' } }, 401);
        const b = JSON.parse((await req.text()).slice(0, 8000) || '{}');
        const courseId = String(b.courseId || '').slice(0, 40);
        if (!/^[\w-]+$/.test(courseId) || !(await inCourse(req, courseId))) return json({ error: { message: 'Not a member' } }, 403);
        if (!b.profile) { await env.DB.prepare('DELETE FROM class_members WHERE course_id = ? AND user_sub = ?').bind(courseId, who.sub).run(); return json({ ok: true }); }
        const p = b.profile, ints = (a, max) => (Array.isArray(a) ? a : []).map(Number).filter(n => Number.isInteger(n) && n >= 1 && n <= max).slice(0, 40);
        const profile = { first: String(p.first || '').replace(/[<>]/g, '').slice(0, 24), level: Math.max(0, Math.min(10, p.level | 0)), cards: ints(p.cards, 40),
          badges: (Array.isArray(p.badges) ? p.badges : []).map(String).filter(x => /^[a-z0-9_]{2,20}$/.test(x)).slice(0, 12), avatar: ints([p.avatar], 40)[0] || null, race: !!p.race, week: Math.max(0, Math.min(200, p.week | 0)) };
        await env.DB.prepare(`INSERT INTO class_members (course_id, user_sub, profile, updated_at) VALUES (?, ?, ?, ?)
          ON CONFLICT(course_id, user_sub) DO UPDATE SET profile = excluded.profile, updated_at = excluded.updated_at`).bind(courseId, who.sub, JSON.stringify(profile), new Date().toISOString()).run();
        return json({ ok: true });
      }
      const gm = url.pathname.match(/^\/game\/class\/([\w-]{1,40})$/);
      if (gm && req.method === 'GET') {
        if (!who) return json({ error: { message: 'Unauthorized' } }, 401);
        if (!(await inCourse(req, gm[1]))) return json({ error: { message: 'Not a member' } }, 403);
        const rows = await env.DB.prepare('SELECT user_sub, profile FROM class_members WHERE course_id = ? ORDER BY updated_at DESC LIMIT 60').bind(gm[1]).all();
        return json({ members: (rows.results || []).map(r => ({ ...JSON.parse(r.profile), me: r.user_sub === who.sub })) });
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
