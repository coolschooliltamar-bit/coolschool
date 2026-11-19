// Sync of a real Google account's conversations and memories with Aluma's server (D1).
// Demo accounts never leave the browser. Failures are silent: the browser copy still works.
import { GEMINI_PROXY_URL } from './config.js';
import * as G from './google.js';
import { db, save } from './store.js';

const on = () => !!(GEMINI_PROXY_URL && G.accessToken());
async function req(method, path, body) {
  const r = await fetch(`${GEMINI_PROXY_URL}/db/${path}`, { method, headers: { Authorization: `Bearer ${G.accessToken()}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
}
export const status = { last: null, error: null };

export async function pull(userId) {
  if (!on()) return;
  try {
    const [c, m, g] = await Promise.all([req('GET', 'convs'), req('GET', 'memories'), req('GET', 'game').catch(() => ({}))]);
    const key = `${userId}|${userId}`;
    if (c.data && Array.isArray(c.data)) { (db().convs = db().convs || {})[key] = c.data; }
    if (m.data && Array.isArray(m.data)) db().memories[userId] = m.data;
    if (g.data && typeof g.data === 'object') restoreGame(userId, g.data);
    save(); status.last = new Date().toISOString(); status.error = null;
  } catch (e) { status.error = e.message; }
}
let timer = null;
export function push(userId) {
  if (!on()) return;
  clearTimeout(timer);
  timer = setTimeout(async () => {
    try {
      const key = `${userId}|${userId}`;
      const convs = ((db().convs || {})[key] || []).slice(0, 30);
      await Promise.all([req('PUT', 'convs', convs), req('PUT', 'memories', db().memories[userId] || []), req('PUT', 'game', gameDoc(userId))]);
      status.last = new Date().toISOString(); status.error = null;
    } catch (e) { status.error = e.message; }
  }, 1500);
}
export async function wipe() { if (on()) { try { await fetch(`${GEMINI_PROXY_URL}/db/me`, { method: 'DELETE', headers: { Authorization: `Bearer ${G.accessToken()}` } }); } catch { /* ignore */ } } }

// rewards, practice progress, own paths, projects and the interests questionnaire of a real account
function gameDoc(userId) {
  const mine = Object.values(db().paths || {}).filter(p => p.ownerId === userId).slice(-20);
  return { game: (db().game || {})[userId] || null, learn: (db().learn || {})[userId] || null, paths: mine,
    projects: (db().projects || []).filter(p => p.studentId === userId), interests: (db().interests || {})[userId] || null };
}
function restoreGame(userId, d) {
  if (d.game) (db().game = db().game || {})[userId] = d.game;
  if (d.learn) (db().learn = db().learn || {})[userId] = d.learn;
  if (Array.isArray(d.paths)) { db().paths = db().paths || {}; d.paths.forEach(p => { if (p && p.id && p.ownerId === userId) db().paths[p.id] = p; }); }
  if (Array.isArray(d.projects)) db().projects = (db().projects || []).filter(p => p.studentId !== userId).concat(d.projects.filter(p => p && p.studentId === userId));
  if (d.interests) (db().interests = db().interests || {})[userId] = d.interests;
}
// class view for real accounts: the server checks with Google Classroom that the user is in the course
export async function shareGame(courseId, profile) {
  if (!on()) return;
  try { await fetch(`${GEMINI_PROXY_URL}/game/share`, { method: 'POST', headers: { Authorization: `Bearer ${G.accessToken()}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ courseId, profile }) }); } catch { /* ignore */ }
}
export async function classGame(courseId) {
  if (!on()) return null;
  try { const r = await fetch(`${GEMINI_PROXY_URL}/game/class/${encodeURIComponent(courseId)}`, { headers: { Authorization: `Bearer ${G.accessToken()}` } }); if (!r.ok) return null; return (await r.json()).members || []; }
  catch { return null; }
}
